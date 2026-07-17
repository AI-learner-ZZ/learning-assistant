import { describe, it, expect } from 'vitest'
import { buildWeeklyRecap, shouldShowRecap, type RecapStats } from './recap'

function stats(overrides: Partial<RecapStats> = {}): RecapStats {
  return { masteredNames: [], sessions: 0, minutes: 0, accuracy: 0, streakCount: 0, ...overrides }
}

describe('shouldShowRecap', () => {
  it('is false when there is nothing to report', () => {
    expect(shouldShowRecap(null, '2026-07-10', stats())).toBe(false)
  })

  it('is true the first time when there is something to report', () => {
    expect(shouldShowRecap(null, '2026-07-10', stats({ sessions: 3 }))).toBe(true)
  })

  it('is false within the interval', () => {
    expect(shouldShowRecap('2026-07-08', '2026-07-10', stats({ sessions: 3 }))).toBe(false)
  })

  it('is true once a full interval has passed', () => {
    expect(shouldShowRecap('2026-07-01', '2026-07-08', stats({ sessions: 3 }))).toBe(true)
  })

  it('is false for an invalid stored date', () => {
    expect(shouldShowRecap('garbage', '2026-07-10', stats({ sessions: 3 }))).toBe(false)
  })
})

describe('buildWeeklyRecap', () => {
  it('is empty when nothing happened', () => {
    const recap = buildWeeklyRecap(stats(), 'en')
    expect(recap.empty).toBe(true)
    expect(recap.lines).toEqual([])
  })

  it('reports mastered nodes, sessions, and accuracy', () => {
    const recap = buildWeeklyRecap(
      stats({ masteredNames: ['A', 'B'], sessions: 4, minutes: 90, accuracy: 0.755 }),
      'en'
    )
    expect(recap.empty).toBe(false)
    expect(recap.lines[0]).toContain('Lit up 2 new nodes: A, B')
    expect(recap.lines[1]).toContain('4 sessions, 90 minutes')
    expect(recap.lines[2]).toContain('76% average accuracy')
  })

  it('summarises overflow when many nodes were mastered', () => {
    const recap = buildWeeklyRecap(stats({ masteredNames: ['A', 'B', 'C', 'D', 'E'], sessions: 1 }), 'en')
    expect(recap.lines[0]).toContain('and 2 more')
  })

  it('mentions a multi-day streak but not a single day', () => {
    expect(buildWeeklyRecap(stats({ sessions: 1, streakCount: 4 }), 'en').lines.some(l => l.includes('4-day streak'))).toBe(true)
    expect(buildWeeklyRecap(stats({ sessions: 1, streakCount: 1 }), 'en').lines.some(l => l.includes('streak'))).toBe(false)
  })

  it('renders Chinese', () => {
    const recap = buildWeeklyRecap(stats({ masteredNames: ['线性代数'], sessions: 2 }), 'zh')
    expect(recap.title).toBe('你这周走了多远')
    expect(recap.lines[0]).toContain('线性代数')
  })
})
