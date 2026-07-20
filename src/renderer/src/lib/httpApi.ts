import type { API } from '../../../preload/index'

const TOKEN_KEY = 'lan-token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function invoke<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
  const res = await fetch(`/api/invoke/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ args })
  })
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string }
  if (!res.ok) throw new Error(data.error || `http_${res.status}`)
  return data.result as T
}

interface ChannelConn {
  es: EventSource
  refs: number
}

const channels = new Map<string, ChannelConn>()

function subscribeChannel(channelId: string, event: string, cb: (data: never) => void): () => void {
  let conn = channels.get(channelId)
  if (!conn) {
    conn = { es: new EventSource(`/api/stream/${encodeURIComponent(channelId)}?token=${getToken()}`), refs: 0 }
    channels.set(channelId, conn)
  }
  conn.refs += 1
  const handler = (e: MessageEvent): void => {
    try {
      cb(JSON.parse(e.data as string) as never)
    } catch {  }
  }
  conn.es.addEventListener(event, handler)
  return () => {
    conn.es.removeEventListener(event, handler)
    conn.refs -= 1
    if (conn.refs <= 0) {
      conn.es.close()
      channels.delete(channelId)
    }
  }
}

let eventsSource: EventSource | null = null

function subscribeEvent(name: string, cb: (data: never) => void): () => void {
  if (!eventsSource) {
    eventsSource = new EventSource(`/api/events?token=${getToken()}`)
  }
  const es = eventsSource
  const handler = (e: MessageEvent): void => {
    try {
      cb(JSON.parse(e.data as string) as never)
    } catch {  }
  }
  es.addEventListener(name, handler)
  return () => es.removeEventListener(name, handler)
}

function download(filename: string, content: string, type = 'text/plain'): boolean {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

export const httpApi: API = {
  settings: {
    getAll: () => invoke('settings:get-all'),
    isSetupComplete: () => invoke('settings:is-setup-complete'),
    saveSetup: (setup) => invoke('settings:save-setup', setup),
    update: (key, value) => invoke('settings:update', key, value),
    chooseDirectory: () => Promise.resolve(null),
    hasApiKey: () => invoke('settings:has-api-key')
  },

  subjects: {
    getAll: () => invoke('subjects:get-all'),
    count: () => invoke('subjects:count'),
    create: (name, description) => invoke('subjects:create', name, description),
    createFromDomain: (domain) => invoke('subjects:create-from-domain', domain),
    delete: (id) => invoke('subjects:delete', id),
    getActive: () => invoke('subjects:get-active'),
    setActive: (id) => invoke('subjects:set-active', id)
  },

  templates: {
    list: () => invoke('templates:list'),
    load: (file) => invoke('templates:load', file)
  },

  project: {
    coverage: (subjectId) => invoke('project:coverage', subjectId),
    list: (subjectId) => invoke('project:list', subjectId),
    generate: (subjectId) => invoke('project:generate', subjectId),
    updateStep: (stepId, status) => invoke('project:update-step', stepId, status),
    complete: (projectId, title, stepTitles) => invoke('project:complete', projectId, title, stepTitles),
    stepHistory: (stepId) => invoke('project:step-history', stepId),
    stepChat: (payload) => invoke('project:step-chat', payload)
  },

  defense: {
    questions: (subjectId) => invoke('defense:questions', subjectId),
    grade: (payload) => invoke('defense:grade', payload),
    export: (payload) => Promise.resolve(download(`defense-report-${new Date().toISOString().slice(0, 10)}.md`, payload.content, 'text/markdown'))
  },

  bottleneck: {
    check: () => invoke('bottleneck:check'),
    report: (nodeId) => invoke('bottleneck:report', nodeId),
    export: (content) => Promise.resolve(download(`bottleneck-report-${new Date().toISOString().slice(0, 10)}.md`, content, 'text/markdown'))
  },

  tree: {
    getNodes: (subjectId) => invoke('tree:get-nodes', subjectId),
    updateStatus: (id, status, progress) => invoke('tree:update-status', id, status, progress),
    upsertNode: (node) => invoke('tree:upsert-node', node),
    explainNecessity: (nodeName) => invoke('tree:explain-necessity', nodeName),
    reparent: (childId, newParentId, subjectId) => invoke('tree:reparent', childId, newParentId, subjectId),
    reorder: (updates) => invoke('tree:reorder', updates),
    addNode: (payload) => invoke('tree:add-node', payload),
    deleteNode: (id, cascade) => invoke('tree:delete-node', id, cascade),
    export: async (subjectId) => {
      const nodes = await invoke('tree:get-nodes', subjectId)
      const subjects = await invoke<{ id: string; name: string }[]>('subjects:get-all')
      const subject = subjects.find(s => s.id === subjectId)
      return download(`${subject?.name || 'knowledge-tree'}.json`, JSON.stringify({ subject, nodes }, null, 2), 'application/json')
    },
    import: () => Promise.resolve(null)
  },

  node: {
    primer: (payload) => invoke('node:primer', payload)
  },

  resources: {
    find: (nodeName) => invoke('resources:find', nodeName)
  },

  material: {
    suggest: (subjectName) => invoke('material:suggest', subjectName),
    fetch: (payload) => invoke('material:fetch', payload)
  },

  rag: {
    ingest: (payload) => invoke('rag:ingest', payload),
    list: (subjectId) => invoke('rag:list', subjectId),
    delete: (sourceId) => invoke('rag:delete', sourceId),
    autoFetchEnabled: () => invoke('rag:auto-fetch-enabled'),
    treeFromMaterials: (subjectId) => invoke('tree:from-materials', subjectId)
  },

  chat: {
    getHistory: (nodeId) => invoke('chat:get-history', nodeId),
    clear: (nodeId) => invoke('chat:clear', nodeId),
    send: (payload) => invoke('chat:send', payload),
    onStream: (channelId, cb) => subscribeChannel(channelId, 'stream', cb),
    onSearch: (channelId, cb) => subscribeChannel(channelId, 'search', cb)
  },

  explore: {
    chat: (payload) => invoke('explore:chat', payload)
  },

  errors: {
    getAll: () => invoke('errors:get-all')
  },

  lecture: {
    getStyle: () => invoke('lecture:get-style'),
    setStyle: (style) => invoke('lecture:set-style', style)
  },

  learning: {
    complete: (payload) => invoke('learning:complete', payload)
  },

  streak: {
    get: () => invoke('streak:get')
  },

  recap: {
    get: () => invoke('recap:get'),
    markShown: () => invoke('recap:mark-shown')
  },

  warmup: {
    generate: () => invoke('warmup:generate'),
    complete: () => invoke('warmup:complete')
  },

  spark: {
    get: () => invoke('spark:get')
  },

  dashboard: {
    coverage: (subjectId) => invoke('dashboard:coverage', subjectId),
    risks: () => invoke('dashboard:risks'),
    accuracy: (days) => invoke('dashboard:accuracy', days),
    heatmap: () => invoke('dashboard:heatmap'),
    bestTime: () => invoke('dashboard:best-time')
  },

  contrast: {
    check: () => invoke('contrast:check'),
    generate: () => invoke('contrast:generate'),
    submit: (payload) => invoke('contrast:submit', payload),
    onAvailable: (cb) => subscribeEvent('contrast-available', cb)
  },

  search: {
    getConfig: () => invoke('search:get-config'),
    setConfig: (cfg) => invoke('search:set-config', cfg),
    test: (query) => invoke('search:test', query)
  },

  summary: {
    generate: (payload) => invoke('summary:generate', payload),
    save: (payload) => Promise.resolve(download(`${payload.nodeName}-summary-${new Date().toISOString().slice(0, 10)}.md`, payload.content, 'text/markdown'))
  },

  daily: {
    getTasks: (date) => invoke('daily:get-tasks', date),
    generate: (context) => invoke('daily:generate', context),
    updateTask: (id, status, feedback) => invoke('daily:update-task', id, status, feedback),
    feedback: (taskId, feedback) => invoke('daily:feedback', taskId, feedback)
  },

  file: {
    choose: () => Promise.resolve(null),
    parse: () => Promise.resolve({ text: '', filename: '' }),
    generateOutline: (text) => invoke('file:generate-outline', text)
  },

  data: {
    export: () => Promise.resolve(false),
    openExternal: (url) => {
      window.open(url, '_blank', 'noopener')
      return Promise.resolve()
    }
  },

  pref: {
    get: (key) => invoke('pref:get', key),
    set: (key, value) => invoke('pref:set', key, value)
  },

  app: {
    getVersion: () => invoke('app:get-version')
  },

  lan: {
    info: () => invoke('lan:info'),
    setup: () => Promise.resolve(false),
    enable: () => Promise.resolve({ running: false, error: 'desktop_only' }),
    sessions: () => invoke('lan:sessions'),
    revoke: (id) => invoke('lan:revoke', id)
  },

  isWeb: true
}
