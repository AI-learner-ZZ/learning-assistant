import { describe, it, expect } from 'vitest'
import {
  nextCombo,
  comboMultiplier,
  pointsFor,
  summarizeWarmup,
  warmupGrade,
  BASE_POINTS,
  MAX_MULTIPLIER
} from './warmup'

describe('nextCombo', () => {
  it('grows on a correct answer and resets on a wrong one', () => {
    expect(nextCombo(2, true)).toBe(3)
    expect(nextCombo(5, false)).toBe(0)
  })
})

describe('comboMultiplier', () => {
  it('starts at 1x for the first three in a row', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(3)).toBe(1)
  })

  it('steps up every three consecutive correct answers', () => {
    expect(comboMultiplier(4)).toBe(2)
    expect(comboMultiplier(7)).toBe(3)
  })

  it('caps at the maximum multiplier', () => {
    expect(comboMultiplier(50)).toBe(MAX_MULTIPLIER)
  })
})

describe('pointsFor', () => {
  it('awards base points at 1x', () => {
    expect(pointsFor(1)).toBe(BASE_POINTS)
  })

  it('awards multiplied points on a hot streak', () => {
    expect(pointsFor(4)).toBe(BASE_POINTS * 2)
    expect(pointsFor(7)).toBe(BASE_POINTS * 3)
  })
})

describe('summarizeWarmup', () => {
  it('summarises an empty run', () => {
    expect(summarizeWarmup([])).toEqual({ score: 0, correct: 0, total: 0, bestCombo: 0 })
  })

  it('counts correct answers and total', () => {
    const r = summarizeWarmup([true, false, true])
    expect(r.correct).toBe(2)
    expect(r.total).toBe(3)
  })

  it('resets the combo after a wrong answer', () => {
    const r = summarizeWarmup([true, true, true, false, true])
    expect(r.bestCombo).toBe(3)
  })

  it('scores an all-correct run with escalating multipliers', () => {
    const r = summarizeWarmup([true, true, true, true])
    expect(r.bestCombo).toBe(4)
    expect(r.score).toBe(BASE_POINTS * 3 + BASE_POINTS * 2)
  })
})

describe('warmupGrade', () => {
  it('handles a run with no questions', () => {
    expect(warmupGrade({ score: 0, correct: 0, total: 0, bestCombo: 0 }, false)).toContain('Nothing answered')
  })

  it('praises a perfect run', () => {
    expect(warmupGrade({ score: 40, correct: 4, total: 4, bestCombo: 4 }, false)).toContain('Perfect')
  })

  it('suggests a review when recall is weak', () => {
    expect(warmupGrade({ score: 10, correct: 1, total: 5, bestCombo: 1 }, false)).toContain('need a proper review')
  })

  it('renders Chinese', () => {
    expect(warmupGrade({ score: 40, correct: 4, total: 4, bestCombo: 4 }, true)).toContain('全对')
  })
})
