import { describe, it, expect } from 'vitest'
import { goalProgress, goalMessage } from './goal'

describe('goalProgress', () => {
  it('returns zero for an empty tree', () => {
    expect(goalProgress(0, 0)).toEqual({ percent: 0, remaining: 0 })
  })

  it('computes percent and remaining', () => {
    expect(goalProgress(3, 4)).toEqual({ percent: 75, remaining: 1 })
  })

  it('rounds to the nearest percent', () => {
    expect(goalProgress(1, 3).percent).toBe(33)
  })

  it('clamps mastered above the total', () => {
    expect(goalProgress(9, 4)).toEqual({ percent: 100, remaining: 0 })
  })

  it('clamps negative mastered to zero', () => {
    expect(goalProgress(-2, 4).percent).toBe(0)
  })
})

describe('goalMessage', () => {
  it('celebrates completion', () => {
    expect(goalMessage(100, false)).toContain('Goal reached')
  })

  it('varies by band', () => {
    expect(goalMessage(70, false)).toContain('within reach')
    expect(goalMessage(40, false)).toContain('midpoint')
    expect(goalMessage(10, false)).toContain('on your way')
    expect(goalMessage(0, false)).toContain('clear goal')
  })

  it('renders Chinese', () => {
    expect(goalMessage(100, true)).toContain('目标达成')
    expect(goalMessage(0, true)).toContain('刚起步')
  })
})
