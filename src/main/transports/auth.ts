import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { getPref, setPref } from '../database'

const KEY_USER = 'lan_username'
const KEY_SALT = 'lan_pass_salt'
const KEY_HASH = 'lan_pass_hash'

export function hashPassword(password: string, salt: string = randomBytes(16).toString('hex')): { salt: string; hash: string } {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  if (!password || !salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const stored = Buffer.from(hash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export function setupCredentials(username: string, password: string): boolean {
  if (!username.trim() || password.length < 4) return false
  const { salt, hash } = hashPassword(password)
  setPref(KEY_USER, username.trim())
  setPref(KEY_SALT, salt)
  setPref(KEY_HASH, hash)
  return true
}

export function hasCredentials(): boolean {
  return !!getPref(KEY_USER) && !!getPref(KEY_HASH)
}

export function checkCredentials(username: string, password: string): boolean {
  const storedUser = getPref(KEY_USER)
  const salt = getPref(KEY_SALT)
  const hash = getPref(KEY_HASH)
  if (!storedUser || !salt || !hash) return false
  if (username.trim() !== storedUser) return false
  return verifyPassword(password, salt, hash)
}

export interface SessionInfo {
  id: string
  label: string
  createdAt: number
  expiresAt: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export class TokenStore {
  private sessions = new Map<string, SessionInfo>()

  constructor(
    private ttlMs: number = WEEK_MS,
    private now: () => number = Date.now
  ) {}

  create(label: string): { token: string; session: SessionInfo } {
    const token = randomBytes(32).toString('hex')
    const session: SessionInfo = {
      id: randomUUID().slice(0, 8),
      label: label.slice(0, 120),
      createdAt: this.now(),
      expiresAt: this.now() + this.ttlMs
    }
    this.sessions.set(token, session)
    return { token, session }
  }

  validate(token: string | undefined | null): SessionInfo | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null
    if (this.now() > session.expiresAt) {
      this.sessions.delete(token)
      return null
    }
    return session
  }

  revoke(id: string): boolean {
    for (const [token, session] of this.sessions) {
      if (session.id === id) {
        this.sessions.delete(token)
        return true
      }
    }
    return false
  }

  list(): SessionInfo[] {
    const now = this.now()
    for (const [token, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(token)
    }
    return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt)
  }
}

export class LoginLimiter {
  private failures = 0
  private lockedUntil = 0

  constructor(
    private maxFailures = 5,
    private lockMs = 60_000,
    private now: () => number = Date.now
  ) {}

  canAttempt(): boolean {
    return this.now() >= this.lockedUntil
  }

  recordFailure(): void {
    this.failures += 1
    if (this.failures >= this.maxFailures) {
      this.lockedUntil = this.now() + this.lockMs
      this.failures = 0
    }
  }

  recordSuccess(): void {
    this.failures = 0
    this.lockedUntil = 0
  }
}

export const tokenStore = new TokenStore()
export const loginLimiter = new LoginLimiter()

export function authenticate(token: string | undefined | null): SessionInfo | null {
  return tokenStore.validate(token)
}
