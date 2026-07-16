import { describe, it, expect } from 'vitest'
import { buildDailyNudge } from './nudge'

describe('buildDailyNudge', () => {
  it('returns null when already nudged today', () => {
    expect(buildDailyNudge({ dueCount: 5, streakCount: 3, streakAtRisk: true, alreadyNudgedToday: true, language: 'zh' })).toBeNull()
  })

  it('prioritises due reviews', () => {
    const nudge = buildDailyNudge({ dueCount: 3, streakCount: 4, streakAtRisk: true, alreadyNudgedToday: false, language: 'zh' })
    expect(nudge?.body).toContain('3')
    expect(nudge?.title).toContain('复习')
  })

  it('nudges about the streak when nothing is due', () => {
    const nudge = buildDailyNudge({ dueCount: 0, streakCount: 7, streakAtRisk: true, alreadyNudgedToday: false, language: 'en' })
    expect(nudge?.body).toContain('7-day streak')
  })

  it('returns null when there is nothing to nudge about', () => {
    expect(buildDailyNudge({ dueCount: 0, streakCount: 0, streakAtRisk: false, alreadyNudgedToday: false, language: 'en' })).toBeNull()
  })

  it('does not nudge about a streak that is not at risk', () => {
    expect(buildDailyNudge({ dueCount: 0, streakCount: 5, streakAtRisk: false, alreadyNudgedToday: false, language: 'en' })).toBeNull()
  })

  it('uses English framing for the due-review nudge', () => {
    const nudge = buildDailyNudge({ dueCount: 1, streakCount: 0, streakAtRisk: false, alreadyNudgedToday: false, language: 'en' })
    expect(nudge?.title).toContain('review')
    expect(nudge?.body).toContain('1 topic is')
  })
})
