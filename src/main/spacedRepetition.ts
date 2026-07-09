import {
  getReviewState,
  upsertReviewState,
  getAllReviewStates,
  getAllNodes,
  type ReviewState
} from './database'

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(fromIso: string, to: Date = new Date()): number {
  const from = new Date(fromIso).getTime()
  if (Number.isNaN(from)) return 0
  return Math.max(0, (to.getTime() - from) / DAY_MS)
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * DAY_MS).toISOString()
}

export function correctRateToQuality(correctRate: number): number {
  return Math.round(Math.max(0, Math.min(5, correctRate * 5)))
}

export function defaultReviewState(nodeId: string): ReviewState {
  return {
    node_id: nodeId,
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    last_correct_rate: 0,
    last_reviewed_at: null,
    next_review_date: null
  }
}

export function computeNextState(prev: ReviewState, correctRate: number, now: Date = new Date()): ReviewState {
  const quality = correctRateToQuality(correctRate)
  let { ease_factor, interval_days, repetitions } = prev

  if (quality < 3) {
    repetitions = 0
    interval_days = 1
  } else {
    repetitions += 1
    if (repetitions === 1) interval_days = 1
    else if (repetitions === 2) interval_days = 6
    else interval_days = Math.round(interval_days * ease_factor)
  }

  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease_factor < 1.3) ease_factor = 1.3

  return {
    node_id: prev.node_id,
    ease_factor: Number(ease_factor.toFixed(3)),
    interval_days,
    repetitions,
    last_correct_rate: correctRate,
    last_reviewed_at: now.toISOString(),
    next_review_date: addDays(now, interval_days)
  }
}

export function recordReview(nodeId: string, correctRate: number): ReviewState {
  const prev = getReviewState(nodeId) ?? defaultReviewState(nodeId)
  const updated = computeNextState(prev, correctRate)
  upsertReviewState(updated)
  return updated
}

export function forgettingRisk(state: ReviewState): number {
  if (!state.last_reviewed_at) return 1
  const t = daysBetween(state.last_reviewed_at)

  const strength = Math.max(1, state.interval_days) * (0.5 + state.last_correct_rate)
  const retention = Math.exp(-t / strength)
  return Math.max(0, Math.min(1, 1 - retention))
}

export interface NodeRisk {
  node_id: string
  name: string
  risk: number
  daysUntilDue: number
  lastReviewedAt: string | null
}

export function computeAllRisks(): NodeRisk[] {
  const states = getAllReviewStates()
  if (states.length === 0) return []

  const nameById = new Map<string, string>()
  for (const n of getAllNodes()) nameById.set(n.id, n.name)

  const risks: NodeRisk[] = states.map(s => ({
    node_id: s.node_id,
    name: nameById.get(s.node_id) ?? s.node_id,
    risk: forgettingRisk(s),
    daysUntilDue: s.next_review_date
      ? (new Date(s.next_review_date).getTime() - Date.now()) / DAY_MS
      : 0,
    lastReviewedAt: s.last_reviewed_at
  }))

  return risks.sort((a, b) => b.risk - a.risk)
}

export function getHighRiskNodes(topN: number, withinDays: number): NodeRisk[] {
  return computeAllRisks()
    .filter(r => r.daysUntilDue <= withinDays)
    .slice(0, topN)
}
