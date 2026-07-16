import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./database', () => ({ getPref: vi.fn(), setPref: vi.fn() }))

import {
  dayDiff,
  emptyStreak,
  updateStreakOnActivity,
  getStreakView,
  recordActivity,
  getStreak,
  type StreakState
} from './streak'
import { getPref, setPref } from './database'

beforeEach(() => vi.clearAllMocks())

describe('dayDiff', () => {
  it('counts whole days between dates', () => {
    expect(dayDiff('2026-07-01', '2026-07-01')).toBe(0)
    expect(dayDiff('2026-07-01', '2026-07-02')).toBe(1)
    expect(dayDiff('2026-07-01', '2026-07-10')).toBe(9)
  })

  it('returns 0 for invalid input', () => {
    expect(dayDiff('nope', '2026-07-02')).toBe(0)
  })
})

describe('updateStreakOnActivity', () => {
  it('starts a streak on the first activity', () => {
    const next = updateStreakOnActivity(emptyStreak(), '2026-07-01')
    expect(next.count).toBe(1)
    expect(next.lastActiveDate).toBe('2026-07-01')
  })

  it('increments on a consecutive day', () => {
    const state: StreakState = { count: 3, longest: 3, lastActiveDate: '2026-07-01', freezes: 2 }
    expect(updateStreakOnActivity(state, '2026-07-02').count).toBe(4)
  })

  it('does nothing when already active today', () => {
    const state: StreakState = { count: 3, longest: 3, lastActiveDate: '2026-07-02', freezes: 2 }
    expect(updateStreakOnActivity(state, '2026-07-02')).toBe(state)
  })

  it('consumes a freeze to survive a single missed day', () => {
    const state: StreakState = { count: 5, longest: 5, lastActiveDate: '2026-07-01', freezes: 2 }
    const next = updateStreakOnActivity(state, '2026-07-03')
    expect(next.count).toBe(6)
    expect(next.freezes).toBe(1)
  })

  it('resets when the gap is too large or no freeze remains', () => {
    expect(updateStreakOnActivity({ count: 5, longest: 5, lastActiveDate: '2026-07-01', freezes: 0 }, '2026-07-03').count).toBe(1)
    expect(updateStreakOnActivity({ count: 5, longest: 5, lastActiveDate: '2026-07-01', freezes: 2 }, '2026-07-10').count).toBe(1)
  })

  it('tracks the longest streak', () => {
    const state: StreakState = { count: 9, longest: 9, lastActiveDate: '2026-07-01', freezes: 2 }
    expect(updateStreakOnActivity(state, '2026-07-02').longest).toBe(10)
  })
})

describe('getStreakView', () => {
  it('is active on the same day', () => {
    const v = getStreakView({ count: 4, longest: 4, lastActiveDate: '2026-07-02', freezes: 2 }, '2026-07-02')
    expect(v).toMatchObject({ count: 4, active: true, atRisk: false, broken: false })
  })

  it('is at risk the day after', () => {
    const v = getStreakView({ count: 4, longest: 4, lastActiveDate: '2026-07-01', freezes: 2 }, '2026-07-02')
    expect(v).toMatchObject({ count: 4, active: false, atRisk: true, broken: false })
  })

  it('is broken after too long', () => {
    const v = getStreakView({ count: 4, longest: 4, lastActiveDate: '2026-07-01', freezes: 0 }, '2026-07-05')
    expect(v).toMatchObject({ count: 0, broken: true })
  })

  it('reports zero for a fresh state', () => {
    expect(getStreakView(emptyStreak(), '2026-07-02').count).toBe(0)
  })
})

describe('recordActivity and getStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T09:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('advances and persists the streak', () => {
    vi.mocked(getPref).mockImplementation((key: string) => {
      const map: Record<string, string> = {
        streak_last_active: '2026-07-01',
        streak_count: '3',
        streak_longest: '3',
        streak_freezes: '2'
      }
      return map[key] ?? null
    })
    const view = recordActivity()
    expect(view.count).toBe(4)
    expect(view.active).toBe(true)
    expect(setPref).toHaveBeenCalledWith('streak_count', '4')
  })

  it('reports an at-risk streak without mutating storage', () => {
    vi.mocked(getPref).mockImplementation((key: string) => {
      const map: Record<string, string> = {
        streak_last_active: '2026-07-01',
        streak_count: '3',
        streak_longest: '3',
        streak_freezes: '2'
      }
      return map[key] ?? null
    })
    const view = getStreak()
    expect(view.atRisk).toBe(true)
    expect(setPref).not.toHaveBeenCalled()
  })
})
