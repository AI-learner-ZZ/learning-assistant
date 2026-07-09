import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cn, formatDate, today, uuid } from './utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c')
  })

  it('lets a later tailwind class win a conflict', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('today', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns the current date as YYYY-MM-DD', () => {
    expect(today()).toBe('2026-07-01')
  })
})

describe('formatDate', () => {
  it('returns a non-empty string containing digits', () => {
    const out = formatDate('2026-07-01T08:30:00Z')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
    expect(out).toMatch(/\d/)
  })
})

describe('uuid', () => {
  it('matches the UUID format', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('produces unique values', () => {
    const set = new Set(Array.from({ length: 500 }, () => uuid()))
    expect(set.size).toBe(500)
  })
})
