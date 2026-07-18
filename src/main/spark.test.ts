import { describe, it, expect } from 'vitest'
import { shouldRefreshSpark, parseSpark } from './spark'

describe('shouldRefreshSpark', () => {
  it('refreshes when there is no cache', () => {
    expect(shouldRefreshSpark(null, '2026-07-10')).toBe(true)
  })

  it('refreshes on a new day', () => {
    expect(shouldRefreshSpark('2026-07-09', '2026-07-10')).toBe(true)
  })

  it('keeps the cache on the same day', () => {
    expect(shouldRefreshSpark('2026-07-10', '2026-07-10')).toBe(false)
  })
})

describe('parseSpark', () => {
  it('returns empty for empty input', () => {
    expect(parseSpark('')).toBe('')
  })

  it('strips a surrounding code fence', () => {
    expect(parseSpark('```\nEntropy limits every zip file.\n```')).toBe('Entropy limits every zip file.')
  })

  it('strips surrounding quotes', () => {
    expect(parseSpark('"Entropy limits every zip file."')).toBe('Entropy limits every zip file.')
    expect(parseSpark('「熵决定了压缩极限」')).toBe('熵决定了压缩极限')
  })

  it('drops a leading label', () => {
    expect(parseSpark('Did you know: gradients point uphill.')).toBe('gradients point uphill.')
    expect(parseSpark('你知道吗：梯度指向上坡。')).toBe('梯度指向上坡。')
  })

  it('collapses whitespace', () => {
    expect(parseSpark('a   b\n\nc')).toBe('a b c')
  })

  it('caps very long output', () => {
    expect(parseSpark('x'.repeat(400)).length).toBe(240)
  })
})
