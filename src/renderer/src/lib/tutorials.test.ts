import { describe, it, expect } from 'vitest'
import { GUIDES, GUIDE_MAP } from './tutorials'

describe('tutorial content integrity', () => {
  it('gives every guide between 1 and 3 tips', () => {
    for (const g of GUIDES) {
      expect(g.tips.length).toBeGreaterThanOrEqual(1)
      expect(g.tips.length).toBeLessThanOrEqual(3)
    }
  })

  it('provides both Chinese and English for every name and tip', () => {
    for (const g of GUIDES) {
      expect(g.name[0].trim()).not.toBe('')
      expect(g.name[1].trim()).not.toBe('')
      for (const tip of g.tips) {
        expect(tip.title[0].trim()).not.toBe('')
        expect(tip.title[1].trim()).not.toBe('')
        expect(tip.body[0].trim()).not.toBe('')
        expect(tip.body[1].trim()).not.toBe('')
      }
    }
  })

  it('uses unique keys', () => {
    const keys = GUIDES.map(g => g.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('exposes a guide for every triggerable surface', () => {
    for (const key of ['welcome', 'chat', 'tree', 'daily', 'dashboard', 'errors', 'settings']) {
      expect(GUIDE_MAP[key]).toBeDefined()
    }
  })
})
