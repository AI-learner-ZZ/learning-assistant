import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

const prefs = new Map<string, string>()

vi.mock('electron', () => ({
  app: { getAppPath: () => 'Z:/nonexistent-for-tests' }
}))
vi.mock('../database', () => ({
  getPref: vi.fn((key: string) => prefs.get(key) ?? null),
  setPref: vi.fn((key: string, value: string) => { prefs.set(key, value) })
}))
vi.mock('../handlers/registry', () => ({
  HANDLERS: {
    't:echo': { scope: 'both', fn: (args: unknown[]) => ({ echoed: args }) },
    't:boom': { scope: 'both', fn: () => { throw new Error('kaboom') } },
    't:desktop': { scope: 'ipc', fn: () => 'desktop-secret' }
  }
}))

import { startHttpServer, stopHttpServer, isHttpRunning } from './http'
import { setupCredentials } from './auth'
import { busEmit } from './bus'

let base = ''
let token = ''

beforeAll(async () => {
  setupCredentials('tester', 'secret1')
  const result = await startHttpServer(0)
  expect(result.running).toBe(true)
  base = `http://127.0.0.1:${result.port}`
})

afterAll(() => {
  stopHttpServer()
})

describe('http transport', () => {
  it('reports running state', () => {
    expect(isHttpRunning()).toBe(true)
  })

  it('logs in with the right credentials and returns a token', async () => {
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tester', password: 'secret1' })
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { token: string }
    expect(data.token.length).toBeGreaterThan(30)
    token = data.token
  })

  it('identifies the session via /api/me', async () => {
    const res = await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
  })

  it('rejects invoke calls without a token', async () => {
    const res = await fetch(`${base}/api/invoke/t:echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [1] })
    })
    expect(res.status).toBe(401)
  })

  it('invokes a both-scoped handler and round-trips args', async () => {
    const res = await fetch(`${base}/api/invoke/t:echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ args: ['a', { b: 2 }] })
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { result: { echoed: unknown[] } }
    expect(data.result.echoed).toEqual(['a', { b: 2 }])
  })

  it('surfaces handler errors as 500 with a message', async () => {
    const res = await fetch(`${base}/api/invoke/t:boom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ args: [] })
    })
    expect(res.status).toBe(500)
    const data = await res.json() as { error: string }
    expect(data.error).toContain('kaboom')
  })

  it('hides desktop-only and unknown handlers from HTTP', async () => {
    for (const name of ['t:desktop', 'no:such']) {
      const res = await fetch(`${base}/api/invoke/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ args: [] })
      })
      expect(res.status).toBe(404)
    }
  })

  it('delivers bus events over the channel SSE, including buffered ones', async () => {
    busEmit('chat-stream-tt1', { delta: 'early', done: false })
    const res = await fetch(`${base}/api/stream/tt1?token=${token}`, {
      headers: { Accept: 'text/event-stream' }
    })
    expect(res.status).toBe(200)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let received = ''
    const deadline = Date.now() + 3000
    setTimeout(() => busEmit('chat-stream-tt1', { delta: 'live', done: true }), 50)
    while (Date.now() < deadline && !(received.includes('early') && received.includes('live'))) {
      const { value, done } = await reader.read()
      if (done) break
      received += decoder.decode(value)
    }
    await reader.cancel()
    expect(received).toContain('event: stream')
    expect(received).toContain('early')
    expect(received).toContain('live')
  })

  it('rejects wrong credentials and locks out after repeated failures', async () => {
    const attempt = (): Promise<Response> =>
      fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'tester', password: 'wrong' })
      })
    const first = await attempt()
    expect(first.status).toBe(401)
    for (let i = 0; i < 5; i++) await attempt()
    const locked = await attempt()
    expect(locked.status).toBe(429)
  })
})
