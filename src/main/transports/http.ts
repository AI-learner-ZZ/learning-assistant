import express, { type Request, type Response, type NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import type { Server } from 'http'
import { app as electronApp } from 'electron'
import { HANDLERS, type Ctx } from '../handlers/registry'
import { addSink, busEmit } from './bus'
import { routeChannel } from './channels'
import { authenticate, checkCredentials, hasCredentials, loginLimiter, tokenStore } from './auth'

interface BufferedEvent {
  at: number
  event: string
  data: unknown
}

const streamClients = new Map<string, Response>()
const eventClients = new Set<Response>()
const pending = new Map<string, BufferedEvent[]>()

const PENDING_TTL_MS = 60_000
const PENDING_MAX = 200

let server: Server | null = null
let sinkInstalled = false

function sseWrite(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function bufferEvent(id: string, event: string, data: unknown): void {
  const list = pending.get(id) ?? []
  const now = Date.now()
  const kept = list.filter(e => now - e.at < PENDING_TTL_MS).slice(-PENDING_MAX)
  kept.push({ at: now, event, data })
  pending.set(id, kept)
}

function httpSink(channel: string, data: unknown): void {
  const route = routeChannel(channel)
  if (route.kind === 'stream' || route.kind === 'search') {
    const event = route.kind
    const res = streamClients.get(route.id)
    if (res) sseWrite(res, event, data)
    else bufferEvent(route.id, event, data)
    return
  }
  for (const res of eventClients) {
    sseWrite(res, route.name, data)
  }
}

export function webRoot(): string | null {
  const candidates = [
    path.join(electronApp.getAppPath(), 'web-dist'),
    path.join(process.resourcesPath ?? '', 'web-dist')
  ]
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) return dir
  }
  return null
}

function tokenFrom(req: Request): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const q = req.query.token
  return typeof q === 'string' ? q : null
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = authenticate(tokenFrom(req))
  if (!session) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  ;(req as Request & { session: typeof session }).session = session
  next()
}

export function buildApp(): express.Express {
  const httpApp = express()
  httpApp.use(express.json({ limit: '20mb' }))

  httpApp.post('/api/login', (req, res) => {
    if (!loginLimiter.canAttempt()) {
      res.status(429).json({ error: 'too_many_attempts' })
      return
    }
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string }
    if (!hasCredentials() || !checkCredentials(username ?? '', password ?? '')) {
      loginLimiter.recordFailure()
      res.status(401).json({ error: 'invalid_credentials' })
      return
    }
    loginLimiter.recordSuccess()
    const label = String(req.headers['user-agent'] ?? 'unknown device').slice(0, 120)
    const { token, session } = tokenStore.create(label)
    res.json({ token, session })
  })

  httpApp.get('/api/me', requireAuth, (req, res) => {
    const session = (req as Request & { session: { label: string } }).session
    res.json({ ok: true, label: session.label })
  })

  httpApp.post('/api/logout', requireAuth, (req, res) => {
    const session = (req as Request & { session: { id: string } }).session
    tokenStore.revoke(session.id)
    res.json({ ok: true })
  })

  httpApp.post('/api/invoke/:name', requireAuth, async (req, res) => {
    const name = String(req.params.name)
    const def = HANDLERS[name]
    if (!def || def.scope !== 'both') {
      res.status(404).json({ error: 'unknown_or_desktop_only' })
      return
    }
    const args = Array.isArray((req.body ?? {}).args) ? (req.body.args as unknown[]) : []
    const ctx: Ctx = { emit: busEmit, getWindow: () => null }
    try {
      const result = await def.fn(args, ctx)
      res.json({ result: result ?? null })
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  httpApp.get('/api/stream/:channelId', requireAuth, (req, res) => {
    const id = String(req.params.channelId)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write(': connected\n\n')
    streamClients.set(id, res)
    const buffered = pending.get(id) ?? []
    pending.delete(id)
    const now = Date.now()
    for (const e of buffered) {
      if (now - e.at < PENDING_TTL_MS) sseWrite(res, e.event, e.data)
    }
    req.on('close', () => {
      if (streamClients.get(id) === res) streamClients.delete(id)
    })
  })

  httpApp.get('/api/events', requireAuth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write(': connected\n\n')
    eventClients.add(res)
    req.on('close', () => eventClients.delete(res))
  })

  const root = webRoot()
  if (root) {
    httpApp.use(express.static(root))
    httpApp.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next()
        return
      }
      res.sendFile(path.join(root, 'index.html'))
    })
  } else {
    httpApp.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next()
        return
      }
      res.status(503).send('Web build missing. Run: npm run web:build')
    })
  }

  return httpApp
}

export function startHttpServer(port: number): Promise<{ running: boolean; port?: number; error?: string }> {
  return new Promise(resolve => {
    if (server) {
      resolve({ running: true, port })
      return
    }
    if (!sinkInstalled) {
      addSink(httpSink)
      sinkInstalled = true
    }
    try {
      const httpApp = buildApp()
      const s = httpApp.listen(port, '0.0.0.0')
      s.on('listening', () => {
        server = s
        const address = s.address()
        const actualPort = typeof address === 'object' && address ? address.port : port
        resolve({ running: true, port: actualPort })
      })
      s.on('error', err => {
        resolve({ running: false, error: err instanceof Error ? err.message : String(err) })
      })
    } catch (e) {
      resolve({ running: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

export function stopHttpServer(): void {
  if (server) {
    server.close()
    server = null
  }
  for (const res of streamClients.values()) {
    try { res.end() } catch {  }
  }
  streamClients.clear()
  for (const res of eventClients) {
    try { res.end() } catch {  }
  }
  eventClients.clear()
}

export function isHttpRunning(): boolean {
  return server !== null
}
