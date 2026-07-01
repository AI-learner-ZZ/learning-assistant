import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { initDatabase, getNodes, getAllNodes, getNodeById, upsertNode, updateNodeStatus, deleteNode, updateNodeRelations, updateTaskStatus, saveMessage, getMessages, clearMessages, logError, getErrors, setPref, getPref, getTodayTasks, upsertSubject, getSubjects, deleteSubject, countSubjects, insertLearningRecord, getDailyAccuracy, resolveErrorsByType, createProject, getProjects, updateProjectStatus, createProjectStep, getProjectSteps, updateProjectStepStatus, getBottleneckCandidates, getStudyTimeDistribution, getAccuracyByHour, type KnowledgeNode } from './database'
import { saveApiKey, getApiKey, setSetting, getSetting, getAllSettings, isSetupComplete } from './settings'
import { streamChat, buildSystemPrompt, generateOutline, explainNodeNecessity, generateSummary, generateContrastWorkshop, gradeChoice, generateKnowledgeTree, generateProject, buildProjectStepPrompt, generateProjectReport, generateDefenseQuestions, gradeDefense, generateBottleneckReport, resetClient as resetAiClient, type LectureStyle, type ChatMessage } from './aiService'
import { parseFile } from './fileParser'
import { listTemplates, loadTemplate, createSubjectFromTree } from './templateLoader'
import { recordReview, getHighRiskNodes } from './spacedRepetition'
import { generatePlan, applyTaskFeedback, getDifficultyLevel, difficultyDescriptor } from './dailyPlanner'
import { getPendingContrast } from './errorAnalysis'
import { detectBottlenecks } from './bottleneckDetector'
import { validateReparent } from './treeValidator'
import {
  getSearchProvider, setSearchProvider, getSearxngUrl, setSearxngUrl,
  saveSearchKey, isSearchConfigured, performSearch, pickDualSources, formatResultsForAI,
  type SearchProvider
} from './searchService'
import { autoUpdater } from 'electron-updater'
import { randomUUID } from 'crypto'
import fs from 'fs'

const SEARCH_MARKER = /FUNCTION_CALL:search:(.+)/

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Learning Assistant',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.learning-assistant.app')
  }

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  })

  initDatabase()

  const savedDir = getPref('dataDir')
  if (savedDir && savedDir !== path.join(app.getPath('userData'), 'data')) {
    initDatabase(savedDir)
  }

  createWindow()
  registerIpcHandlers()

  if (!process.env['ELECTRON_RENDERER_URL']) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {  })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpcHandlers(): void {

  ipcMain.handle('settings:get-all', () => getAllSettings())

  ipcMain.handle('settings:is-setup-complete', () => isSetupComplete())

  ipcMain.handle('settings:save-setup', (_, setup: {
    language: string
    theme: string
    apiProvider: string
    apiBaseUrl: string
    apiKey: string
    dataDir: string
  }) => {
    saveApiKey(setup.apiKey)
    setSetting('language', setup.language as 'zh' | 'en')
    setSetting('theme', setup.theme as 'light' | 'dark')
    setSetting('apiProvider', setup.apiProvider)
    setSetting('apiBaseUrl', setup.apiBaseUrl)
    setSetting('dataDir', setup.dataDir)
    setSetting('setupComplete', true)
    resetAiClient()

    initDatabase(setup.dataDir)
  })

  ipcMain.handle('settings:update', (_, key: string, value: string) => {
    if (key === 'apiKey') {
      saveApiKey(value)
      resetAiClient()
    } else {
      setSetting(key as Parameters<typeof setSetting>[0], value as never)
    }
  })

  ipcMain.handle('settings:choose-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select data storage directory'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('settings:has-api-key', () => getApiKey() !== null)

  ipcMain.handle('subjects:get-all', () => getSubjects())

  ipcMain.handle('subjects:count', () => countSubjects())

  ipcMain.handle('subjects:create', (_, name: string, description: string) => {
    const id = randomUUID()
    upsertSubject({ id, name, description })
    return id
  })

  ipcMain.handle('subjects:create-from-domain', async (_, domain: string) => {
    const lang = getSetting('language')
    const tree = await generateKnowledgeTree(domain, lang)
    const isPrimary = countSubjects() === 0
    const subjectId = createSubjectFromTree(tree.name || domain, tree.description || '', tree.nodes, isPrimary)
    setPref('active_subject', subjectId)
    return subjectId
  })

  ipcMain.handle('subjects:delete', (_, id: string) => {
    deleteSubject(id)
    if (getPref('active_subject') === id) {
      const remaining = getSubjects()
      setPref('active_subject', remaining[0]?.id ?? '')
    }
  })

  ipcMain.handle('subjects:get-active', () => {
    const active = getPref('active_subject')
    if (active && getSubjects().some(s => s.id === active)) return active
    return getSubjects()[0]?.id ?? null
  })

  ipcMain.handle('subjects:set-active', (_, id: string) => setPref('active_subject', id))

  ipcMain.handle('templates:list', () => listTemplates())

  ipcMain.handle('templates:load', (_, file: string) => {
    const isPrimary = countSubjects() === 0
    const subjectId = loadTemplate(file, isPrimary)
    if (subjectId) setPref('active_subject', subjectId)
    return subjectId
  })

  ipcMain.handle('tree:get-nodes', (_, subjectId: string) => getNodes(subjectId))

  ipcMain.handle('tree:update-status', (_, id: string, status: string, progress?: number) => {
    updateNodeStatus(id, status, progress)
  })

  ipcMain.handle('tree:upsert-node', (_, node) => upsertNode(node))

  ipcMain.handle('tree:explain-necessity', async (_, nodeName: string) => {
    const lang = getSetting('language')
    return explainNodeNecessity(nodeName, lang)
  })

  ipcMain.handle('chat:get-history', (_, nodeId: string) => getMessages(nodeId))

  ipcMain.handle('chat:clear', (_, nodeId: string) => clearMessages(nodeId))

  ipcMain.handle('chat:send', async (_, payload: {
    nodeId: string | null
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    systemContext: {
      nodeName?: string
      nodeDescription?: string
      learnedNodes?: string[]
      weakPoints?: string[]
    }
    lectureStyle?: LectureStyle
    channelId: string
  }) => {
    if (!mainWindow) return
    const lang = getSetting('language')
    const isZh = lang === 'zh'
    const lectureStyle = payload.lectureStyle || (getPref('lecture_style') as LectureStyle) || undefined
    const searchEnabled = isSearchConfigured()
    const systemPrompt = buildSystemPrompt({
      ...payload.systemContext,
      language: lang,
      lectureStyle,
      difficulty: difficultyDescriptor(getDifficultyLevel(), isZh),
      searchEnabled
    })

    const userMsg = payload.messages[payload.messages.length - 1]
    if (userMsg && userMsg.role === 'user') {
      saveMessage({
        id: randomUUID(),
        node_id: payload.nodeId,
        subject_id: null,
        role: 'user',
        content: userMsg.content
      })
    }

    try {
      const convo: ChatMessage[] = payload.messages.map(m => ({ role: m.role, content: m.content }))
      let fullResponse = await streamChat(convo, mainWindow, payload.channelId, systemPrompt)

      const searchMatch = fullResponse.match(SEARCH_MARKER)
      if (searchMatch && searchEnabled) {
        const query = searchMatch[1].trim()
        try {
          const results = await performSearch(query)
          const dual = pickDualSources(results)

          mainWindow.webContents.send(`chat-search-${payload.channelId}`, { query, sources: dual })

          const injected = formatResultsForAI(query, results, isZh)
          const continuation: ChatMessage[] = [
            ...convo,
            { role: 'assistant', content: fullResponse },
            { role: 'user', content: injected }
          ]
          const more = await streamChat(continuation, mainWindow, payload.channelId, systemPrompt)
          fullResponse = `${fullResponse}\n\n${more}`
        } catch {
          mainWindow.webContents.send(`chat-stream-${payload.channelId}`, {
            delta: isZh ? '\n\n（搜索失败，请检查搜索配置）' : '\n\n(Search failed, check search config)',
            done: true,
            full: fullResponse
          })
        }
      }

      saveMessage({
        id: randomUUID(),
        node_id: payload.nodeId,
        subject_id: null,
        role: 'assistant',
        content: fullResponse
      })

      const errorMatch = fullResponse.match(/\[SCORE\]\s*(正确|部分正确|错误|Correct|Partial|Incorrect)\s*\[ERROR_TYPE\]\s*([^\n]+)/)
      if (errorMatch && errorMatch[1] !== '正确' && errorMatch[1] !== 'Correct' && payload.nodeId) {
        const errorType = errorMatch[2].trim()
        logError({
          id: randomUUID(),
          node_id: payload.nodeId,
          error_type: errorType,
          error_content: fullResponse.slice(0, 300)
        })

        const pending = getPendingContrast()
        if (pending) {
          mainWindow.webContents.send('contrast-available', pending)
        }
      }

      return { success: true }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`chat-stream-${payload.channelId}`, {
          delta: `\n\n❌ Error: ${errorMsg}`,
          done: true,
          full: errorMsg,
          error: true
        })
      }
      return { success: false, error: errorMsg }
    }
  })

  ipcMain.handle('explore:chat', async (_, payload: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    channelId: string
  }) => {
    if (!mainWindow) return { success: false }
    const isZh = getSetting('language') === 'zh'
    const systemPrompt = isZh
      ? '你是一位博学、友好的通用助手。自由地回答用户的任何问题，简洁清晰。'
      : 'You are a knowledgeable, friendly general assistant. Answer freely, concise and clear.'
    try {
      const convo: ChatMessage[] = payload.messages.map(m => ({ role: m.role, content: m.content }))
      await streamChat(convo, mainWindow, payload.channelId, systemPrompt)
      return { success: true }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`chat-stream-${payload.channelId}`, { delta: `\n\n❌ ${errorMsg}`, done: true, full: errorMsg, error: true })
      }
      return { success: false, error: errorMsg }
    }
  })

  ipcMain.handle('errors:get-all', () => getErrors())

  ipcMain.handle('daily:get-tasks', (_, date: string) => getTodayTasks(date))

  ipcMain.handle('daily:generate', async (_, context: {
    currentNodeId: string | null
    currentNodeName: string | null
    unlearnedNodes: string[]
    learnedNodes: string[]
  }) => {
    const lang = getSetting('language')
    return generatePlan({ ...context, language: lang })
  })

  ipcMain.handle('daily:update-task', (_, id: string, status: string, feedback?: string) => {
    updateTaskStatus(id, status, feedback)
  })

  ipcMain.handle('daily:feedback', (_, taskId: string, feedback: 'too_hard' | 'too_easy' | 'not_interested') => {
    applyTaskFeedback(taskId, feedback)
    return getDifficultyLevel()
  })

  ipcMain.handle('lecture:get-style', () => getPref('lecture_style') || 'intuitive')
  ipcMain.handle('lecture:set-style', (_, style: string) => setPref('lecture_style', style))

  ipcMain.handle('learning:complete', (_, payload: { nodeId: string; durationMinutes: number; correctRate: number }) => {
    insertLearningRecord({
      id: randomUUID(),
      node_id: payload.nodeId,
      session_date: new Date().toISOString().slice(0, 10),
      duration_minutes: payload.durationMinutes,
      correct_rate: payload.correctRate
    })
    return recordReview(payload.nodeId, payload.correctRate)
  })

  ipcMain.handle('dashboard:coverage', (_, subjectId?: string) => {
    const nodes = subjectId ? getNodes(subjectId) : getAllNodes()
    const total = nodes.length
    const mastered = nodes.filter(n => n.status === 'mastered').length
    const learning = nodes.filter(n => n.status === 'learning').length
    return { total, mastered, learning, percent: total ? Math.round((mastered / total) * 100) : 0 }
  })

  ipcMain.handle('dashboard:risks', () => getHighRiskNodes(5, 3))

  ipcMain.handle('dashboard:accuracy', (_, days: number) => getDailyAccuracy(days || 7))

  ipcMain.handle('contrast:check', () => getPendingContrast())

  ipcMain.handle('contrast:generate', async () => {
    const pending = getPendingContrast()
    if (!pending) return null
    const lang = getSetting('language')
    return generateContrastWorkshop(pending.errorType, pending.nodeNames, lang)
  })

  ipcMain.handle('contrast:submit', async (_, payload: {
    errorType: string
    question: string
    options: string[]
    chosenIndex: number
    correctIndex: number
  }) => {
    const lang = getSetting('language')
    const result = await gradeChoice(payload.question, payload.options, payload.chosenIndex, payload.correctIndex, lang)
    if (result.correct) {
      resolveErrorsByType(payload.errorType)
    }
    return result
  })

  ipcMain.handle('tree:reparent', (_, childId: string, newParentId: string | null, subjectId: string) => {
    const nodes = getNodes(subjectId).map(n => ({ id: n.id, parent_id: n.parent_id }))
    const result = validateReparent(nodes, childId, newParentId)
    if (result.hasCycle) {
      return { success: false, cycleEdges: result.cycleEdges }
    }
    const node = getNodeById(childId)
    if (node) {
      upsertNode({ ...node, parent_id: newParentId })
    }
    return { success: true }
  })

  ipcMain.handle('tree:reorder', (_, updates: { id: string; parent_id: string | null; sort_order: number }[]) => {
    updateNodeRelations(updates)
  })

  ipcMain.handle('tree:add-node', (_, payload: { subjectId: string; parentId: string | null; name: string; description?: string }) => {
    const id = randomUUID()
    const siblings = getNodes(payload.subjectId)
    upsertNode({
      id,
      subject_id: payload.subjectId,
      parent_id: payload.parentId,
      name: payload.name,
      description: payload.description ?? null,
      sort_order: siblings.length
    })
    return id
  })

  ipcMain.handle('tree:delete-node', (_, id: string, cascade: boolean) => {
    deleteNode(id, cascade)
  })

  ipcMain.handle('tree:export', async (_, subjectId: string) => {
    const subject = getSubjects().find(s => s.id === subjectId)
    const nodes = getNodes(subjectId)
    const exportData = { subject, nodes }
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `${subject?.name || 'knowledge-tree'}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('tree:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const raw = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'))
    const newSubjectId = randomUUID()
    const subjectName = raw.subject?.name || raw.name || 'Imported Subject'
    upsertSubject({ id: newSubjectId, name: subjectName, description: raw.subject?.description ?? null })

    const idMap = new Map<string, string>()
    const nodes: KnowledgeNode[] = raw.nodes || []
    for (const n of nodes) idMap.set(n.id, randomUUID())
    for (const n of nodes) {
      upsertNode({
        id: idMap.get(n.id)!,
        subject_id: newSubjectId,
        parent_id: n.parent_id ? idMap.get(n.parent_id) ?? null : null,
        name: n.name,
        description: n.description ?? null,
        sort_order: n.sort_order ?? 0,
        estimated_minutes: n.estimated_minutes ?? 30
      })
    }
    return newSubjectId
  })

  ipcMain.handle('search:get-config', () => ({
    provider: getSearchProvider(),
    searxngUrl: getSearxngUrl(),
    configured: isSearchConfigured()
  }))

  ipcMain.handle('search:set-config', (_, cfg: { provider: SearchProvider; key?: string; searxngUrl?: string }) => {
    setSearchProvider(cfg.provider)
    if (cfg.searxngUrl !== undefined) setSearxngUrl(cfg.searxngUrl)
    if (cfg.key) saveSearchKey(cfg.key)
    return isSearchConfigured()
  })

  ipcMain.handle('search:test', async (_, query: string) => {
    try {
      const results = await performSearch(query || 'hello world')
      return { success: true, count: results.length }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('summary:generate', async (_, payload: { nodeName: string; messages: ChatMessage[] }) => {
    const lang = getSetting('language')
    return generateSummary(payload.nodeName, payload.messages, lang)
  })

  ipcMain.handle('summary:save', async (_, payload: { nodeName: string; content: string }) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `${payload.nodeName}-summary-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, payload.content, 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('project:coverage', (_, subjectId: string) => {
    const nodes = getNodes(subjectId)
    const total = nodes.length
    const mastered = nodes.filter(n => n.status === 'mastered').length
    return { total, mastered, percent: total ? Math.round((mastered / total) * 100) : 0 }
  })

  ipcMain.handle('project:list', (_, subjectId: string) => {
    const projects = getProjects(subjectId)
    return projects.map(p => ({ ...p, steps: getProjectSteps(p.id) }))
  })

  ipcMain.handle('project:generate', async (_, subjectId: string) => {
    const subject = getSubjects().find(s => s.id === subjectId)
    const mastered = getNodes(subjectId).filter(n => n.status === 'mastered').map(n => n.name)
    const lang = getSetting('language')
    const gen = await generateProject(subject?.name || '', mastered, lang)
    const projectId = randomUUID()
    createProject({ id: projectId, subject_id: subjectId, title: gen.title, description: gen.description })
    gen.steps.forEach((s, i) => {
      createProjectStep({ id: randomUUID(), project_id: projectId, title: s.title, description: s.description, sort_order: i })
    })
    const projects = getProjects(subjectId).filter(p => p.id === projectId)
    return { ...projects[0], steps: getProjectSteps(projectId) }
  })

  ipcMain.handle('project:update-step', (_, stepId: string, status: string) => {
    updateProjectStepStatus(stepId, status)
  })

  ipcMain.handle('project:complete', async (_, projectId: string, title: string, stepTitles: string[]) => {
    updateProjectStatus(projectId, 'completed')
    const lang = getSetting('language')
    return generateProjectReport(title, stepTitles, lang)
  })

  ipcMain.handle('project:step-chat', async (_, payload: {
    stepId: string
    stepTitle: string
    stepDescription: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    channelId: string
  }) => {
    if (!mainWindow) return { success: false }
    const lang = getSetting('language')
    const systemPrompt = buildProjectStepPrompt(payload.stepTitle, payload.stepDescription, lang)
    const userMsg = payload.messages[payload.messages.length - 1]
    if (userMsg?.role === 'user') {
      saveMessage({ id: randomUUID(), node_id: payload.stepId, subject_id: null, role: 'user', content: userMsg.content })
    }
    try {
      const convo: ChatMessage[] = payload.messages.map(m => ({ role: m.role, content: m.content }))
      const full = await streamChat(convo, mainWindow, payload.channelId, systemPrompt)
      saveMessage({ id: randomUUID(), node_id: payload.stepId, subject_id: null, role: 'assistant', content: full })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('project:step-history', (_, stepId: string) => getMessages(stepId))

  ipcMain.handle('defense:questions', async (_, subjectId: string) => {
    const subject = getSubjects().find(s => s.id === subjectId)
    const mastered = getNodes(subjectId).filter(n => n.status === 'mastered').map(n => n.name)
    const lang = getSetting('language')
    return generateDefenseQuestions(subject?.name || '', mastered, lang)
  })

  ipcMain.handle('defense:grade', async (_, payload: { question: string; answer: string }) => {
    const lang = getSetting('language')
    return gradeDefense(payload.question, payload.answer, lang)
  })

  ipcMain.handle('defense:export', async (_, payload: { content: string }) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `defense-report-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, payload.content, 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('bottleneck:check', () => detectBottlenecks())

  ipcMain.handle('bottleneck:report', async (_, nodeId: string) => {
    const node = getNodeById(nodeId)
    const errors = getErrors().filter(e => e.node_id === nodeId).slice(0, 8)
    const lang = getSetting('language')
    return generateBottleneckReport(node?.name || '', errors, lang)
  })

  ipcMain.handle('bottleneck:export', async (_, content: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `bottleneck-report-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('dashboard:heatmap', () => getStudyTimeDistribution())
  ipcMain.handle('dashboard:best-time', () => getAccuracyByHour())

  ipcMain.handle('file:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('file:parse', async (_, filePath: string) => {
    const { text, filename } = await parseFile(filePath)
    return { text: text.slice(0, 20000), filename }
  })

  ipcMain.handle('file:generate-outline', async (_, text: string) => {
    const lang = getSetting('language')
    return generateOutline(text, lang)
  })

  ipcMain.handle('data:export', async () => {
    const dataDir = getSetting('dataDir')
    const dbPath = path.join(dataDir, 'data.db')
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `learning-assistant-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(dbPath, result.filePath)
      return true
    }
    return false
  })

  ipcMain.handle('data:open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('pref:get', (_, key: string) => getPref(key))
  ipcMain.handle('pref:set', (_, key: string, value: string) => setPref(key, value))
}
