import { getPref, setPref } from './database'

export interface StreakState {
  count: number
  longest: number
  lastActiveDate: string | null
  freezes: number
}

export interface StreakView {
  count: number
  longest: number
  active: boolean
  atRisk: boolean
  broken: boolean
  freezes: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_FREEZES = 2

export function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / DAY_MS)
}

export function emptyStreak(): StreakState {
  return { count: 0, longest: 0, lastActiveDate: null, freezes: DEFAULT_FREEZES }
}

export function updateStreakOnActivity(state: StreakState, today: string): StreakState {
  if (!state.lastActiveDate) {
    return { count: 1, longest: Math.max(1, state.longest), lastActiveDate: today, freezes: state.freezes }
  }
  const diff = dayDiff(state.lastActiveDate, today)
  if (diff <= 0) return state

  let count: number
  let freezes = state.freezes
  if (diff === 1) {
    count = state.count + 1
  } else if (diff === 2 && state.freezes > 0) {
    count = state.count + 1
    freezes = state.freezes - 1
  } else {
    count = 1
  }
  return { count, longest: Math.max(count, state.longest), lastActiveDate: today, freezes }
}

export function getStreakView(state: StreakState, today: string): StreakView {
  const base = { longest: state.longest, freezes: state.freezes }
  if (!state.lastActiveDate) return { count: 0, active: false, atRisk: false, broken: false, ...base }
  const diff = dayDiff(state.lastActiveDate, today)
  if (diff <= 0) return { count: state.count, active: true, atRisk: false, broken: false, ...base }
  if (diff === 1) return { count: state.count, active: false, atRisk: true, broken: false, ...base }
  if (diff === 2 && state.freezes > 0) return { count: state.count, active: false, atRisk: true, broken: false, ...base }
  return { count: 0, active: false, atRisk: false, broken: true, ...base }
}

const K_COUNT = 'streak_count'
const K_LONGEST = 'streak_longest'
const K_LAST = 'streak_last_active'
const K_FREEZES = 'streak_freezes'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadStreak(): StreakState {
  const last = getPref(K_LAST)
  if (!last) return emptyStreak()
  return {
    count: parseInt(getPref(K_COUNT) || '0', 10) || 0,
    longest: parseInt(getPref(K_LONGEST) || '0', 10) || 0,
    lastActiveDate: last,
    freezes: parseInt(getPref(K_FREEZES) ?? String(DEFAULT_FREEZES), 10) || 0
  }
}

function persistStreak(s: StreakState): void {
  setPref(K_COUNT, String(s.count))
  setPref(K_LONGEST, String(s.longest))
  if (s.lastActiveDate) setPref(K_LAST, s.lastActiveDate)
  setPref(K_FREEZES, String(s.freezes))
}

export function recordActivity(): StreakView {
  const next = updateStreakOnActivity(loadStreak(), todayStr())
  persistStreak(next)
  return getStreakView(next, todayStr())
}

export function getStreak(): StreakView {
  return getStreakView(loadStreak(), todayStr())
}
