import { contextBridge, ipcRenderer } from 'electron'

const api = {

  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    isSetupComplete: () => ipcRenderer.invoke('settings:is-setup-complete'),
    saveSetup: (setup: {
      language: string
      theme: string
      apiProvider: string
      apiBaseUrl: string
      apiKey: string
      dataDir: string
    }) => ipcRenderer.invoke('settings:save-setup', setup),
    update: (key: string, value: string) => ipcRenderer.invoke('settings:update', key, value),
    chooseDirectory: () => ipcRenderer.invoke('settings:choose-directory'),
    hasApiKey: () => ipcRenderer.invoke('settings:has-api-key')
  },

  subjects: {
    getAll: () => ipcRenderer.invoke('subjects:get-all'),
    count: () => ipcRenderer.invoke('subjects:count'),
    create: (name: string, description: string) => ipcRenderer.invoke('subjects:create', name, description),
    createFromDomain: (domain: string) => ipcRenderer.invoke('subjects:create-from-domain', domain),
    delete: (id: string) => ipcRenderer.invoke('subjects:delete', id),
    getActive: () => ipcRenderer.invoke('subjects:get-active'),
    setActive: (id: string) => ipcRenderer.invoke('subjects:set-active', id)
  },

  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    load: (file: string) => ipcRenderer.invoke('templates:load', file)
  },

  project: {
    coverage: (subjectId: string) => ipcRenderer.invoke('project:coverage', subjectId),
    list: (subjectId: string) => ipcRenderer.invoke('project:list', subjectId),
    generate: (subjectId: string) => ipcRenderer.invoke('project:generate', subjectId),
    updateStep: (stepId: string, status: string) => ipcRenderer.invoke('project:update-step', stepId, status),
    complete: (projectId: string, title: string, stepTitles: string[]) =>
      ipcRenderer.invoke('project:complete', projectId, title, stepTitles),
    stepHistory: (stepId: string) => ipcRenderer.invoke('project:step-history', stepId),
    stepChat: (payload: {
      stepId: string; stepTitle: string; stepDescription: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>; channelId: string
    }) => ipcRenderer.invoke('project:step-chat', payload)
  },

  defense: {
    questions: (subjectId: string) => ipcRenderer.invoke('defense:questions', subjectId),
    grade: (payload: { question: string; answer: string }) => ipcRenderer.invoke('defense:grade', payload),
    export: (payload: { content: string }) => ipcRenderer.invoke('defense:export', payload)
  },

  bottleneck: {
    check: () => ipcRenderer.invoke('bottleneck:check'),
    report: (nodeId: string) => ipcRenderer.invoke('bottleneck:report', nodeId),
    export: (content: string) => ipcRenderer.invoke('bottleneck:export', content)
  },

  tree: {
    getNodes: (subjectId: string) => ipcRenderer.invoke('tree:get-nodes', subjectId),
    updateStatus: (id: string, status: string, progress?: number) =>
      ipcRenderer.invoke('tree:update-status', id, status, progress),
    upsertNode: (node: unknown) => ipcRenderer.invoke('tree:upsert-node', node),
    explainNecessity: (nodeName: string) => ipcRenderer.invoke('tree:explain-necessity', nodeName),
    reparent: (childId: string, newParentId: string | null, subjectId: string) =>
      ipcRenderer.invoke('tree:reparent', childId, newParentId, subjectId),
    reorder: (updates: { id: string; parent_id: string | null; sort_order: number }[]) =>
      ipcRenderer.invoke('tree:reorder', updates),
    addNode: (payload: { subjectId: string; parentId: string | null; name: string; description?: string }) =>
      ipcRenderer.invoke('tree:add-node', payload),
    deleteNode: (id: string, cascade: boolean) => ipcRenderer.invoke('tree:delete-node', id, cascade),
    export: (subjectId: string) => ipcRenderer.invoke('tree:export', subjectId),
    import: () => ipcRenderer.invoke('tree:import')
  },

  node: {
    primer: (payload: { nodeId: string; nodeName: string; nodeDescription: string | null; learnedNodes: string[] }) =>
      ipcRenderer.invoke('node:primer', payload)
  },

  resources: {
    find: (nodeName: string) => ipcRenderer.invoke('resources:find', nodeName)
  },

  chat: {
    getHistory: (nodeId: string) => ipcRenderer.invoke('chat:get-history', nodeId),
    clear: (nodeId: string) => ipcRenderer.invoke('chat:clear', nodeId),
    send: (payload: {
      nodeId: string | null
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      systemContext: {
        nodeName?: string
        nodeDescription?: string
        learnedNodes?: string[]
        weakPoints?: string[]
      }
      lectureStyle?: string
      channelId: string
    }) => ipcRenderer.invoke('chat:send', payload),
    onStream: (channelId: string, cb: (data: { delta: string; done: boolean; full?: string; error?: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { delta: string; done: boolean; full?: string; error?: boolean }) => cb(data)
      ipcRenderer.on(`chat-stream-${channelId}`, handler)
      return () => ipcRenderer.removeListener(`chat-stream-${channelId}`, handler)
    },
    onSearch: (channelId: string, cb: (data: { query: string; sources: unknown[] }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { query: string; sources: unknown[] }) => cb(data)
      ipcRenderer.on(`chat-search-${channelId}`, handler)
      return () => ipcRenderer.removeListener(`chat-search-${channelId}`, handler)
    }
  },

  explore: {
    chat: (payload: { messages: Array<{ role: 'user' | 'assistant'; content: string }>; channelId: string }) =>
      ipcRenderer.invoke('explore:chat', payload)
  },

  errors: {
    getAll: () => ipcRenderer.invoke('errors:get-all')
  },

  lecture: {
    getStyle: () => ipcRenderer.invoke('lecture:get-style'),
    setStyle: (style: string) => ipcRenderer.invoke('lecture:set-style', style)
  },

  learning: {
    complete: (payload: { nodeId: string; durationMinutes: number; correctRate: number }) =>
      ipcRenderer.invoke('learning:complete', payload)
  },

  streak: {
    get: () => ipcRenderer.invoke('streak:get')
  },

  dashboard: {
    coverage: (subjectId?: string) => ipcRenderer.invoke('dashboard:coverage', subjectId),
    risks: () => ipcRenderer.invoke('dashboard:risks'),
    accuracy: (days: number) => ipcRenderer.invoke('dashboard:accuracy', days),
    heatmap: () => ipcRenderer.invoke('dashboard:heatmap'),
    bestTime: () => ipcRenderer.invoke('dashboard:best-time')
  },

  contrast: {
    check: () => ipcRenderer.invoke('contrast:check'),
    generate: () => ipcRenderer.invoke('contrast:generate'),
    submit: (payload: { errorType: string; question: string; options: string[]; chosenIndex: number; correctIndex: number }) =>
      ipcRenderer.invoke('contrast:submit', payload),
    onAvailable: (cb: (data: { errorType: string; count: number; nodeNames: string[] }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { errorType: string; count: number; nodeNames: string[] }) => cb(data)
      ipcRenderer.on('contrast-available', handler)
      return () => ipcRenderer.removeListener('contrast-available', handler)
    }
  },

  search: {
    getConfig: () => ipcRenderer.invoke('search:get-config'),
    setConfig: (cfg: { provider: string; key?: string; searxngUrl?: string }) =>
      ipcRenderer.invoke('search:set-config', cfg),
    test: (query: string) => ipcRenderer.invoke('search:test', query)
  },

  summary: {
    generate: (payload: { nodeName: string; messages: Array<{ role: string; content: string }> }) =>
      ipcRenderer.invoke('summary:generate', payload),
    save: (payload: { nodeName: string; content: string }) =>
      ipcRenderer.invoke('summary:save', payload)
  },

  daily: {
    getTasks: (date: string) => ipcRenderer.invoke('daily:get-tasks', date),
    generate: (context: {
      currentNodeId: string | null
      currentNodeName: string | null
      unlearnedNodes: string[]
      learnedNodes: string[]
    }) => ipcRenderer.invoke('daily:generate', context),
    updateTask: (id: string, status: string, feedback?: string) =>
      ipcRenderer.invoke('daily:update-task', id, status, feedback),
    feedback: (taskId: string, feedback: 'too_hard' | 'too_easy' | 'not_interested') =>
      ipcRenderer.invoke('daily:feedback', taskId, feedback)
  },

  file: {
    choose: () => ipcRenderer.invoke('file:choose'),
    parse: (filePath: string) => ipcRenderer.invoke('file:parse', filePath),
    generateOutline: (text: string) => ipcRenderer.invoke('file:generate-outline', text)
  },

  data: {
    export: () => ipcRenderer.invoke('data:export'),
    openExternal: (url: string) => ipcRenderer.invoke('data:open-external', url)
  },

  pref: {
    get: (key: string) => ipcRenderer.invoke('pref:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('pref:set', key, value)
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
