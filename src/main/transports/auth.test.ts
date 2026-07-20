import { describe, it, expect, vi, beforeEach } from 'vitest'

const prefs = new Map<string, string>()

vi.mock('../database', () => ({
  getPref: vi.fn((key: string) => prefs.get(key) ?? null),
  setPref: vi.fn((key: string, value: string) => { prefs.set(key, value) })
}))

import {
  hashPassword,
  verifyPassword,
  setupCredentials,
  hasCredentials,
  checkCredentials,
  TokenStore,
  LoginLimiter
} from './auth'

beforeEach(() => prefs.clear())

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', () => {
    const { salt, hash } = hashPassword('correct horse')
    expect(verifyPassword('correct horse', salt, hash)).toBe(true)
    expect(verifyPassword('wrong', salt, hash)).toBe(false)
  })

  it('produces different hashes for different salts', () => {
    const a = hashPassword('same', 'aa'.repeat(16))
    const b = hashPassword('same', 'bb'.repeat(16))
    expect(a.hash).not.toBe(b.hash)
  })

  it('never stores or returns the plaintext', () => {
    const { salt, hash } = hashPassword('topsecret')
    expect(salt).not.toContain('topsecret')
    expect(hash).not.toContain('topsecret')
  })
})

describe('credentials', () => {
  it('rejects an empty username or short password', () => {
    expect(setupCredentials('', 'longenough')).toBe(false)
    expect(setupCredentials('user', 'abc')).toBe(false)
    expect(hasCredentials()).toBe(false)
  })

  it('stores and checks valid credentials without plaintext', () => {
    expect(setupCredentials('user', 'pass1234')).toBe(true)
    expect(hasCredentials()).toBe(true)
    expect(checkCredentials('user', 'pass1234')).toBe(true)
    expect(checkCredentials('user', 'nope')).toBe(false)
    expect(checkCredentials('other', 'pass1234')).toBe(false)
    for (const value of prefs.values()) {
      expect(value).not.toContain('pass1234')
    }
  })
})

describe('TokenStore', () => {
  it('creates and validates a token', () => {
    const store = new TokenStore(1000, () => 0)
    const { token, session } = store.create('phone')
    expect(store.validate(token)?.id).toBe(session.id)
  })

  it('rejects unknown or empty tokens', () => {
    const store = new TokenStore()
    expect(store.validate('nope')).toBeNull()
    expect(store.validate(null)).toBeNull()
  })

  it('expires tokens after the ttl', () => {
    let now = 0
    const store = new TokenStore(1000, () => now)
    const { token } = store.create('phone')
    now = 1001
    expect(store.validate(token)).toBeNull()
  })

  it('revokes by session id and lists sessions newest first', () => {
    let now = 0
    const store = new TokenStore(10_000, () => now)
    const a = store.create('first')
    now = 100
    const b = store.create('second')
    expect(store.list().map(s => s.id)).toEqual([b.session.id, a.session.id])
    expect(store.revoke(a.session.id)).toBe(true)
    expect(store.validate(a.token)).toBeNull()
    expect(store.validate(b.token)).not.toBeNull()
  })
})

describe('LoginLimiter', () => {
  it('locks out after the failure threshold and unlocks after the window', () => {
    let now = 0
    const limiter = new LoginLimiter(3, 1000, () => now)
    expect(limiter.canAttempt()).toBe(true)
    limiter.recordFailure()
    limiter.recordFailure()
    expect(limiter.canAttempt()).toBe(true)
    limiter.recordFailure()
    expect(limiter.canAttempt()).toBe(false)
    now = 1001
    expect(limiter.canAttempt()).toBe(true)
  })

  it('resets the counter on success', () => {
    const limiter = new LoginLimiter(2, 1000, () => 0)
    limiter.recordFailure()
    limiter.recordSuccess()
    limiter.recordFailure()
    expect(limiter.canAttempt()).toBe(true)
  })
})
