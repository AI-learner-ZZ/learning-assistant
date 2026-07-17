import { describe, it, expect } from 'vitest'
import { conquerProgress, conquerHeadline, CONQUER_THRESHOLD } from './conquer'

describe('conquerProgress', () => {
  it('reports cleared when there is nothing outstanding', () => {
    const p = conquerProgress(0, false)
    expect(p.level).toBe('clear')
    expect(p.percent).toBe(0)
  })

  it('treats negative counts as cleared', () => {
    expect(conquerProgress(-3, false).level).toBe('clear')
  })

  it('shows partial progress below the threshold', () => {
    const p = conquerProgress(1, false)
    expect(p.level).toBe('working')
    expect(p.percent).toBe(Math.round((1 / CONQUER_THRESHOLD) * 100))
    expect(p.hint).toContain(`${CONQUER_THRESHOLD - 1} more`)
  })

  it('is ready to level up at the threshold', () => {
    const p = conquerProgress(CONQUER_THRESHOLD, false)
    expect(p.level).toBe('ready')
    expect(p.percent).toBe(100)
  })

  it('stays ready beyond the threshold', () => {
    expect(conquerProgress(CONQUER_THRESHOLD + 5, false).level).toBe('ready')
  })

  it('renders Chinese labels', () => {
    expect(conquerProgress(1, true).label).toBe('攻克中')
    expect(conquerProgress(CONQUER_THRESHOLD, true).label).toBe('可以升级了')
  })
})

describe('conquerHeadline', () => {
  it('celebrates having nothing to conquer', () => {
    expect(conquerHeadline(0, false)).toContain('Nothing to conquer')
    expect(conquerHeadline(0, true)).toContain('没有正在攻克')
  })

  it('counts active concepts', () => {
    expect(conquerHeadline(1, false)).toBe('Conquering 1 concept')
    expect(conquerHeadline(3, false)).toBe('Conquering 3 concepts')
    expect(conquerHeadline(2, true)).toBe('正在攻克 2 个概念')
  })
})
