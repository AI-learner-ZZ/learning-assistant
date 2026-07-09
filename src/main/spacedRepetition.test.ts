import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReviewState } from './database'

vi.mock('./database', () => ({
  getReviewState: vi.fn(),
  upsertReviewState: vi.fn(),
  getAllReviewStates: vi.fn(() => []),
  getAllNodes: vi.fn(() => [])
}))

import {
  correctRateToQuality,
  defaultReviewState,
  computeNextState,
  forgettingRisk,
  computeAllRisks,
  getHighRiskNodes
} from './spacedRepetition'
import { getAllReviewStates, getAllNodes } from './database'

const NOW = new Date('2026-07-01T00:00:00Z')

function state(overrides: Partial<ReviewState> = {}): ReviewState {
  return { ...defaultReviewState('n1'), ...overrides }
}

describe('correctRateToQuality', () => {
  it('maps 1.0 to quality 5 and 0 to 0', () => {
    expect(correctRateToQuality(1)).toBe(5)
    expect(correctRateToQuality(0)).toBe(0)
  })

  it('rounds the midpoint and clamps out-of-range input', () => {
    expect(correctRateToQuality(0.5)).toBe(3)
    expect(correctRateToQuality(5)).toBe(5)
    expect(correctRateToQuality(-1)).toBe(0)
  })
})

describe('computeNextState', () => {
  it('sets interval to 1 on the first correct review', () => {
    const next = computeNextState(state(), 1, NOW)
    expect(next.repetitions).toBe(1)
    expect(next.interval_days).toBe(1)
  })

  it('sets interval to 6 on the second correct review', () => {
    const next = computeNextState(state({ repetitions: 1, interval_days: 1 }), 1, NOW)
    expect(next.repetitions).toBe(2)
    expect(next.interval_days).toBe(6)
  })

  it('multiplies interval by ease from the third review on', () => {
    const next = computeNextState(state({ repetitions: 2, interval_days: 6, ease_factor: 2.5 }), 1, NOW)
    expect(next.interval_days).toBe(Math.round(6 * 2.5))
  })

  it('resets repetitions and interval to 1 on a failed review', () => {
    const next = computeNextState(state({ repetitions: 4, interval_days: 40 }), 0.2, NOW)
    expect(next.repetitions).toBe(0)
    expect(next.interval_days).toBe(1)
  })

  it('never lets ease factor drop below 1.3', () => {
    let s = state({ ease_factor: 1.3 })
    for (let i = 0; i < 5; i++) s = computeNextState(s, 0, NOW)
    expect(s.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('records the review timestamp and the next due date', () => {
    const next = computeNextState(state(), 1, NOW)
    expect(next.last_reviewed_at).toBe(NOW.toISOString())
    expect(next.last_correct_rate).toBe(1)
    expect(new Date(next.next_review_date as string).getTime()).toBeGreaterThan(NOW.getTime())
  })
})

describe('forgettingRisk', () => {
  it('returns maximum risk when never reviewed', () => {
    expect(forgettingRisk(state({ last_reviewed_at: null }))).toBe(1)
  })

  it('returns near-zero risk right after a review', () => {
    const risk = forgettingRisk(state({ last_reviewed_at: NOW.toISOString(), interval_days: 6, last_correct_rate: 1 }))
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(forgettingRisk(state({ last_reviewed_at: NOW.toISOString(), interval_days: 6, last_correct_rate: 1 }))).toBeCloseTo(0, 1)
    vi.useRealTimers()
    expect(risk).toBeGreaterThanOrEqual(0)
  })

  it('grows as more time passes since the last review', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'))
    const soon = forgettingRisk(state({ last_reviewed_at: '2026-07-02T00:00:00Z', interval_days: 3, last_correct_rate: 0.8 }))
    vi.setSystemTime(new Date('2026-07-20T00:00:00Z'))
    const later = forgettingRisk(state({ last_reviewed_at: '2026-07-02T00:00:00Z', interval_days: 3, last_correct_rate: 0.8 }))
    vi.useRealTimers()
    expect(later).toBeGreaterThan(soon)
  })

  it('stays within [0, 1]', () => {
    const r = forgettingRisk(state({ last_reviewed_at: '2000-01-01T00:00:00Z', interval_days: 1, last_correct_rate: 0 }))
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
  })
})

describe('computeAllRisks and getHighRiskNodes', () => {
  beforeEach(() => {
    vi.mocked(getAllNodes).mockReturnValue([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' }
    ] as unknown as ReturnType<typeof getAllNodes>)
  })

  it('returns an empty list when there are no review states', () => {
    vi.mocked(getAllReviewStates).mockReturnValue([])
    expect(computeAllRisks()).toEqual([])
  })

  it('sorts nodes by descending risk and resolves names', () => {
    vi.mocked(getAllReviewStates).mockReturnValue([
      state({ node_id: 'a', last_reviewed_at: '2026-06-01T00:00:00Z', interval_days: 20, last_correct_rate: 1, next_review_date: '2100-01-01T00:00:00Z' }),
      state({ node_id: 'b', last_reviewed_at: null, next_review_date: '2100-01-01T00:00:00Z' })
    ])
    const risks = computeAllRisks()
    expect(risks[0].node_id).toBe('b')
    expect(risks[0].risk).toBeGreaterThanOrEqual(risks[1].risk)
    expect(risks.find(r => r.node_id === 'a')?.name).toBe('Alpha')
  })

  it('filters out nodes whose due date is beyond the window', () => {
    vi.mocked(getAllReviewStates).mockReturnValue([
      state({ node_id: 'a', last_reviewed_at: null, next_review_date: '2100-01-01T00:00:00Z' })
    ])
    expect(getHighRiskNodes(10, 7)).toEqual([])
  })
})
