import { app, dialog, shell, type BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { randomUUID } from 'crypto'
import {
  getNodes, getAllNodes, getNodeById, upsertNode, updateNodeStatus, deleteNode, updateNodeRelations,
  updateTaskStatus, saveMessage, getMessages, clearMessages, logError, getErrors, setPref, getPref,
  getTodayTasks, upsertSubject, getSubjects, deleteSubject, countSubjects, insertLearningRecord,
  getDailyAccuracy, resolveErrorsByType, createProject, getProjects, updateProjectStatus,
  createProjectStep, getProjectSteps, updateProjectStepStatus, getStudyTimeDistribution,
  getAccuracyByHour, getReviewState, getUnresolvedErrorCounts, getMasteredSince, getRecordsSince,
  getSources, deleteSource, getChunksBySubject, initDatabase, type KnowledgeNode
} from '../database'
import { saveApiKey, getApiKey, setSetting, getSetting, getAllSettings, isSetupComplete } from '../settings'
import {
  streamChat, buildSystemPrompt, buildLearnerContext, generateOutline, explainNodeNecessity,
  generateSummary, generateContrastWorkshop, gradeChoice, generateKnowledgeTree, generateProject,
  buildProjectStepPrompt, generateProjectReport, generateDefenseQuestions, gradeDefense,
  generateBottleneckReport, generateNodePrimer, generateWarmup, generateSpark, suggestMaterials,
  curateResources, suggestResourceSearch, resetClient as resetAiClient,
  type LectureStyle, type TeachingStance, type ChatMessage
} from '../aiService'
import { shouldRefreshSpark } from '../spark'
import { ingestText, retrieve, formatRetrievedContext, buildCorpusDigest } from '../ragService'
import { isFetchableUrl, fetchPageText } from '../fetchService'
import { parseFile } from '../fileParser'
import { listTemplates, loadTemplate, createSubjectFromTree, replaceSubjectTree } from '../templateLoader'
import { recordReview, getHighRiskNodes } from '../spacedRepetition'
import { getStreak, recordActivity } from '../streak'
import { buildWeeklyRecap, shouldShowRecap, RECAP_INTERVAL_DAYS, type RecapStats } from '../recap'
import { generatePlan, applyTaskFeedback, getDifficultyLevel, difficultyDescriptor } from '../dailyPlanner'
import { getPendingContrast } from '../errorAnalysis'
import { detectBottlenecks } from '../bottleneckDetector'
import { validateReparent } from '../treeValidator'
import {
  getSearchProvider, setSearchProvider, getSearxngUrl, setSearxngUrl,
  saveSearchKey, isSearchConfigured, performSearch, pickDualSources, formatResultsForAI,
  type SearchProvider
} from '../searchService'
import { setupCredentials, hasCredentials, tokenStore } from '../transports/auth'

export interface Ctx {
  emit: (channel: string, data: unknown) => void
  getWindow: () => BrowserWindow | null
}

export type HandlerScope = 'ipc' | 'both'

export interface HandlerDef {
  scope: HandlerScope
  fn: (args: unknown[], ctx: Ctx) => unknown
}

export interface LanController {
  start: (port: number) => Promise<{ running: boolean; error?: string }>
  stop: () => void
  isRunning: () => boolean
}

let lanController: LanController | null = null

export function setLanController(controller: LanController): void {
  lanController = controller
}

export const LAN_DEFAULT_PORT = 8735

export function lanPort(): number {
  const raw = parseInt(getPref('lan_port') || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : LAN_DEFAULT_PORT
}

function lanIps(): string[] {
  const result: string[] = []
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) result.push(net.address)
    }
  }
  return result
}

const SEARCH_MARKER = /FUNCTION_CALL:search:(.+)/

function nodeMastery(nodeId: string | null): TeachingStance {
  if (!nodeId) return 'learning'
  const rs = getReviewState(nodeId)
  if (!rs || !rs.last_reviewed_at) return 'novice'
  if (rs.repetitions >= 2 && rs.last_correct_rate >= 0.7) return 'advanced'
  return 'learning'
}

function h(scope: HandlerScope, fn: (args: unknown[], ctx: Ctx) => unknown): HandlerDef {
  return { scope, fn }
}

export const HANDLERS: Record<string, HandlerDef> = {
  'settings:get-all': h('both', () => getAllSettings()),

  'settings:is-setup-complete': h('both', () => isSetupComplete()),

  'settings:save-setup': h('ipc', (args) => {
    const [setup] = args as [{ language: string; theme: string; apiProvider: string; apiBaseUrl: string; apiKey: string; dataDir: string }]
    saveApiKey(setup.apiKey)
    setSetting('language', setup.language as 'zh' | 'en')
    setSetting('theme', setup.theme as 'light' | 'dark')
    setSetting('apiProvider', setup.apiProvider)
    setSetting('apiBaseUrl', setup.apiBaseUrl)
    setSetting('dataDir', setup.dataDir)
    setSetting('setupComplete', true)
    resetAiClient()
    initDatabase(setup.dataDir)
  }),

  'settings:update': h('both', (args) => {
    const [key, value] = args as [string, string]
    if (key === 'apiKey') {
      saveApiKey(value)
      resetAiClient()
    } else {
      setSetting(key as Parameters<typeof setSetting>[0], value as never)
    }
  }),

  'settings:choose-directory': h('ipc', async (_args, ctx) => {
    const win = ctx.getWindow()
    const opts = { properties: ['openDirectory' as const], title: 'Select data storage directory' }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return result.canceled ? null : result.filePaths[0]
  }),

  'settings:has-api-key': h('both', () => getApiKey() !== null),

  'subjects:get-all': h('both', () => getSubjects()),

  'subjects:count': h('both', () => countSubjects()),

  'subjects:create': h('both', (args) => {
    const [name, description] = args as [string, string]
    const id = randomUUID()
    upsertSubject({ id, name, description })
    return id
  }),

  'subjects:create-from-domain': h('both', async (args) => {
    const [domain] = args as [string]
    const lang = getSetting('language')
    const tree = await generateKnowledgeTree(domain, lang)
    const isPrimary = countSubjects() === 0
    const subjectId = createSubjectFromTree(tree.name || domain, tree.description || '', tree.nodes, isPrimary)
    setPref('active_subject', subjectId)
    return subjectId
  }),

  'subjects:delete': h('both', (args) => {
    const [id] = args as [string]
    deleteSubject(id)
    if (getPref('active_subject') === id) {
      const remaining = getSubjects()
      setPref('active_subject', remaining[0]?.id ?? '')
    }
  }),

  'subjects:get-active': h('both', () => {
    const active = getPref('active_subject')
    if (active && getSubjects().some(s => s.id === active)) return active
    return getSubjects()[0]?.id ?? null
  }),

  'subjects:set-active': h('both', (args) => {
    const [id] = args as [string]
    return setPref('active_subject', id)
  }),

  'templates:list': h('both', () => listTemplates()),

  'templates:load': h('both', (args) => {
    const [file] = args as [string]
    const isPrimary = countSubjects() === 0
    const subjectId = loadTemplate(file, isPrimary)
    if (subjectId) setPref('active_subject', subjectId)
    return subjectId
  }),

  'tree:get-nodes': h('both', (args) => {
    const [subjectId] = args as [string]
    return getNodes(subjectId)
  }),

  'tree:update-status': h('both', (args) => {
    const [id, status, progress] = args as [string, string, number?]
    updateNodeStatus(id, status, progress)
  }),

  'tree:upsert-node': h('both', (args) => {
    const [node] = args as [Parameters<typeof upsertNode>[0]]
    return upsertNode(node)
  }),

  'tree:explain-necessity': h('both', async (args) => {
    const [nodeName] = args as [string]
    return explainNodeNecessity(nodeName, getSetting('language'))
  }),

  'node:primer': h('both', async (args) => {
    const [payload] = args as [{ nodeId: string; nodeName: string; nodeDescription: string | null; learnedNodes: string[] }]
    const lang = getSetting('language')
    const primer = await generateNodePrimer(payload.nodeName, payload.nodeDescription, payload.learnedNodes, lang)
    saveMessage({ id: randomUUID(), node_id: payload.nodeId, subject_id: null, role: 'assistant', content: primer })
    return primer
  }),

  'material:suggest': h('both', async (args) => {
    const [subjectName] = args as [string]
    const lang = getSetting('language')
    let results: { title: string; url: string }[] = []
    if (isSearchConfigured()) {
      try {
        const query = lang === 'zh' ? `${subjectName} 教程 官方文档 教材` : `${subjectName} tutorial official docs textbook`
        results = (await performSearch(query)).map(r => ({ title: r.title, url: r.url }))
      } catch {  }
    }
    return suggestMaterials(subjectName, lang, results)
  }),

  'material:fetch': h('both', async (args) => {
    const [payload] = args as [{ subjectId: string; url: string }]
    if (getPref('auto_fetch_enabled') !== '1') return { enabled: false }
    if (!isFetchableUrl(payload.url)) {
      return { enabled: true, error: 'invalid_or_blocked_url' }
    }
    try {
      const page = await fetchPageText(payload.url)
      if (!page.text || page.text.length < 200) return { enabled: true, error: 'empty_page' }
      const result = await ingestText({
        subjectId: payload.subjectId,
        kind: 'url',
        title: page.title || payload.url,
        origin: payload.url,
        text: page.text
      })
      return { enabled: true, ...result, title: page.title || payload.url }
    } catch (e) {
      return { enabled: true, error: e instanceof Error ? e.message : String(e) }
    }
  }),

  'rag:ingest': h('both', async (args) => {
    const [payload] = args as [{ subjectId: string; kind: string; title: string; origin: string | null; text: string }]
    return ingestText(payload)
  }),

  'rag:list': h('both', (args) => {
    const [subjectId] = args as [string]
    return getSources(subjectId)
  }),

  'rag:delete': h('both', (args) => {
    const [sourceId] = args as [string]
    deleteSource(sourceId)
    return { success: true }
  }),

  'rag:auto-fetch-enabled': h('both', () => getPref('auto_fetch_enabled') === '1'),

  'tree:from-materials': h('both', async (args) => {
    const [subjectId] = args as [string]
    const sources = getSources(subjectId)
    if (sources.length === 0) return { success: false, error: 'no_materials' }
    const chunks = getChunksBySubject(subjectId)
    const bySource = new Map<string, string[]>()
    for (const c of chunks) {
      const arr = bySource.get(c.source_id) ?? []
      arr.push(c.text)
      bySource.set(c.source_id, arr)
    }
    const digest = buildCorpusDigest(sources.map(s => ({ id: s.id, title: s.title })), bySource)
    const subject = getSubjects().find(s => s.id === subjectId)
    const lang = getSetting('language')
    const tree = await generateKnowledgeTree(subject?.name || '', lang, digest)
    if (!tree.nodes || tree.nodes.length === 0) return { success: false, error: 'generation_failed' }
    const count = replaceSubjectTree(subjectId, tree.nodes)
    return { success: true, nodes: count }
  }),

  'resources:find': h('both', async (args) => {
    const [nodeName] = args as [string]
    const lang = getSetting('language')
    if (!isSearchConfigured()) {
      const suggestion = await suggestResourceSearch(nodeName, lang)
      return { configured: false, items: [], suggestion }
    }
    try {
      const query = lang === 'zh' ? `${nodeName} 教程 入门 讲解` : `${nodeName} tutorial course beginner`
      const results = await performSearch(query)
      const items = await curateResources(nodeName, results, lang)
      return { configured: true, items, suggestion: '' }
    } catch (e) {
      return { configured: true, items: [], suggestion: '', error: e instanceof Error ? e.message : String(e) }
    }
  }),

  'chat:get-history': h('both', (args) => {
    const [nodeId] = args as [string]
    return getMessages(nodeId)
  }),

  'chat:clear': h('both', (args) => {
    const [nodeId] = args as [string]
    return clearMessages(nodeId)
  }),

  'chat:send': h('both', async (args, ctx) => {
    const [payload] = args as [{
      nodeId: string | null
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      systemContext: { nodeName?: string; nodeDescription?: string; learnedNodes?: string[]; weakPoints?: string[] }
      lectureStyle?: LectureStyle
      channelId: string
    }]
    const lang = getSetting('language')
    const isZh = lang === 'zh'
    const lectureStyle = payload.lectureStyle || (getPref('lecture_style') as LectureStyle) || undefined
    const searchEnabled = isSearchConfigured()
    const strugglingTypes = getUnresolvedErrorCounts()
      .filter(c => !['无', 'None', ''].includes(c.error_type))
      .map(c => c.error_type)
    const learnerContext = buildLearnerContext({
      recentlyMastered: getAllNodes().filter(n => n.status === 'mastered').map(n => n.name),
      strugglingWith: strugglingTypes,
      streakDays: getStreak().count,
      language: lang
    })

    let retrievedContext = ''
    if (payload.nodeId) {
      const node = getNodeById(payload.nodeId)
      if (node) {
        const lastUser = payload.messages[payload.messages.length - 1]
        const query = `${node.name} ${node.description ?? ''} ${lastUser?.content ?? ''}`.trim()
        const chunks = await retrieve(node.subject_id, query, 4)
        retrievedContext = formatRetrievedContext(chunks, isZh)
      }
    }

    const systemPrompt = buildSystemPrompt({
      ...payload.systemContext,
      language: lang,
      lectureStyle,
      difficulty: difficultyDescriptor(getDifficultyLevel(), isZh),
      searchEnabled,
      mastery: nodeMastery(payload.nodeId),
      learnerContext,
      retrievedContext
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
      let fullResponse = await streamChat(convo, ctx.emit, payload.channelId, systemPrompt)

      const searchMatch = fullResponse.match(SEARCH_MARKER)
      if (searchMatch && searchEnabled) {
        const query = searchMatch[1].trim()
        try {
          const results = await performSearch(query)
          const dual = pickDualSources(results)

          ctx.emit(`chat-search-${payload.channelId}`, { query, sources: dual })

          const injected = formatResultsForAI(query, results, isZh)
          const continuation: ChatMessage[] = [
            ...convo,
            { role: 'assistant', content: fullResponse },
            { role: 'user', content: injected }
          ]
          const more = await streamChat(continuation, ctx.emit, payload.channelId, systemPrompt)
          fullResponse = `${fullResponse}\n\n${more}`
        } catch {
          ctx.emit(`chat-stream-${payload.channelId}`, {
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
          ctx.emit('contrast-available', pending)
        }
      }

      return { success: true }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      ctx.emit(`chat-stream-${payload.channelId}`, {
        delta: `\n\n❌ Error: ${errorMsg}`,
        done: true,
        full: errorMsg,
        error: true
      })
      return { success: false, error: errorMsg }
    }
  }),

  'explore:chat': h('both', async (args, ctx) => {
    const [payload] = args as [{ messages: Array<{ role: 'user' | 'assistant'; content: string }>; channelId: string }]
    const isZh = getSetting('language') === 'zh'
    const systemPrompt = isZh
      ? '你是一位博学、友好的通用助手。自由地回答用户的任何问题，简洁清晰。'
      : 'You are a knowledgeable, friendly general assistant. Answer freely, concise and clear.'
    try {
      const convo: ChatMessage[] = payload.messages.map(m => ({ role: m.role, content: m.content }))
      await streamChat(convo, ctx.emit, payload.channelId, systemPrompt)
      return { success: true }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      ctx.emit(`chat-stream-${payload.channelId}`, { delta: `\n\n❌ ${errorMsg}`, done: true, full: errorMsg, error: true })
      return { success: false, error: errorMsg }
    }
  }),

  'errors:get-all': h('both', () => getErrors()),

  'daily:get-tasks': h('both', (args) => {
    const [date] = args as [string]
    return getTodayTasks(date)
  }),

  'daily:generate': h('both', async (args) => {
    const [context] = args as [{ currentNodeId: string | null; currentNodeName: string | null; unlearnedNodes: string[]; learnedNodes: string[] }]
    const lang = getSetting('language')
    return generatePlan({ ...context, language: lang })
  }),

  'daily:update-task': h('both', (args) => {
    const [id, status, feedback] = args as [string, string, string?]
    updateTaskStatus(id, status, feedback)
    if (status === 'done') recordActivity()
  }),

  'daily:feedback': h('both', (args) => {
    const [taskId, feedback] = args as [string, 'too_hard' | 'too_easy' | 'not_interested']
    applyTaskFeedback(taskId, feedback)
    return getDifficultyLevel()
  }),

  'lecture:get-style': h('both', () => getPref('lecture_style') || 'intuitive'),

  'lecture:set-style': h('both', (args) => {
    const [style] = args as [string]
    return setPref('lecture_style', style)
  }),

  'learning:complete': h('both', (args) => {
    const [payload] = args as [{ nodeId: string; durationMinutes: number; correctRate: number }]
    insertLearningRecord({
      id: randomUUID(),
      node_id: payload.nodeId,
      session_date: new Date().toISOString().slice(0, 10),
      duration_minutes: payload.durationMinutes,
      correct_rate: payload.correctRate
    })
    const review = recordReview(payload.nodeId, payload.correctRate)
    recordActivity()
    return review
  }),

  'streak:get': h('both', () => getStreak()),

  'recap:get': h('both', () => {
    const records = getRecordsSince(RECAP_INTERVAL_DAYS)
    const stats: RecapStats = {
      masteredNames: getMasteredSince(RECAP_INTERVAL_DAYS).map(n => n.name),
      sessions: records.sessions,
      minutes: Math.round(records.minutes),
      accuracy: records.accuracy,
      streakCount: getStreak().count
    }
    const today = new Date().toISOString().slice(0, 10)
    const due = shouldShowRecap(getPref('last_recap_date'), today, stats)
    return { due, recap: buildWeeklyRecap(stats, getSetting('language')) }
  }),

  'recap:mark-shown': h('both', () => {
    setPref('last_recap_date', new Date().toISOString().slice(0, 10))
  }),

  'warmup:generate': h('both', async () => {
    const studied = getAllNodes()
      .filter(n => n.status === 'mastered' || n.status === 'learning')
      .map(n => n.name)
    if (studied.length === 0) return []
    const active = getPref('active_subject')
    const grounding = active ? await retrieve(active, studied.slice(0, 8).join(' '), 6) : []
    return generateWarmup(studied, getSetting('language'), grounding)
  }),

  'warmup:complete': h('both', () => recordActivity()),

  'spark:get': h('both', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const cached = getPref('spark_text')
    if (!shouldRefreshSpark(getPref('spark_date'), today) && cached) return { text: cached }
    if (!getApiKey()) return { text: cached ?? '' }
    const learned = getAllNodes()
      .filter(n => n.status === 'mastered' || n.status === 'learning')
      .map(n => n.name)
    if (learned.length < 2) return { text: '' }
    try {
      const text = await generateSpark(learned, getSetting('language'))
      if (text) {
        setPref('spark_date', today)
        setPref('spark_text', text)
      }
      return { text: text || cached || '' }
    } catch {
      return { text: cached ?? '' }
    }
  }),

  'dashboard:coverage': h('both', (args) => {
    const [subjectId] = args as [string?]
    const nodes = subjectId ? getNodes(subjectId) : getAllNodes()
    const total = nodes.length
    const mastered = nodes.filter(n => n.status === 'mastered').length
    const learning = nodes.filter(n => n.status === 'learning').length
    return { total, mastered, learning, percent: total ? Math.round((mastered / total) * 100) : 0 }
  }),

  'dashboard:risks': h('both', () => getHighRiskNodes(5, 3)),

  'dashboard:accuracy': h('both', (args) => {
    const [days] = args as [number]
    return getDailyAccuracy(days || 7)
  }),

  'dashboard:heatmap': h('both', () => getStudyTimeDistribution()),

  'dashboard:best-time': h('both', () => getAccuracyByHour()),

  'contrast:check': h('both', () => getPendingContrast()),

  'contrast:generate': h('both', async () => {
    const pending = getPendingContrast()
    if (!pending) return null
    const lang = getSetting('language')
    return generateContrastWorkshop(pending.errorType, pending.nodeNames, lang)
  }),

  'contrast:submit': h('both', async (args) => {
    const [payload] = args as [{ errorType: string; question: string; options: string[]; chosenIndex: number; correctIndex: number }]
    const lang = getSetting('language')
    const result = await gradeChoice(payload.question, payload.options, payload.chosenIndex, payload.correctIndex, lang)
    if (result.correct) {
      resolveErrorsByType(payload.errorType)
    }
    return result
  }),

  'tree:reparent': h('both', (args) => {
    const [childId, newParentId, subjectId] = args as [string, string | null, string]
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
  }),

  'tree:reorder': h('both', (args) => {
    const [updates] = args as [{ id: string; parent_id: string | null; sort_order: number }[]]
    return updateNodeRelations(updates)
  }),

  'tree:add-node': h('both', (args) => {
    const [payload] = args as [{ subjectId: string; parentId: string | null; name: string; description?: string }]
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
  }),

  'tree:delete-node': h('both', (args) => {
    const [id, cascade] = args as [string, boolean]
    return deleteNode(id, cascade)
  }),

  'tree:export': h('ipc', async (args, ctx) => {
    const [subjectId] = args as [string]
    const subject = getSubjects().find(s => s.id === subjectId)
    const nodes = getNodes(subjectId)
    const exportData = { subject, nodes }
    const win = ctx.getWindow()
    const opts = {
      defaultPath: `${subject?.name || 'knowledge-tree'}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      return true
    }
    return false
  }),

  'tree:import': h('ipc', async (_args, ctx) => {
    const win = ctx.getWindow()
    const opts = {
      properties: ['openFile' as const],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
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
  }),

  'search:get-config': h('both', () => ({
    provider: getSearchProvider(),
    searxngUrl: getSearxngUrl(),
    configured: isSearchConfigured()
  })),

  'search:set-config': h('both', (args) => {
    const [cfg] = args as [{ provider: SearchProvider; key?: string; searxngUrl?: string }]
    setSearchProvider(cfg.provider)
    if (cfg.searxngUrl !== undefined) setSearxngUrl(cfg.searxngUrl)
    if (cfg.key) saveSearchKey(cfg.key)
    return isSearchConfigured()
  }),

  'search:test': h('both', async (args) => {
    const [query] = args as [string]
    try {
      const results = await performSearch(query || 'hello world')
      return { success: true, count: results.length }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }),

  'summary:generate': h('both', async (args) => {
    const [payload] = args as [{ nodeName: string; messages: ChatMessage[] }]
    const lang = getSetting('language')
    return generateSummary(payload.nodeName, payload.messages, lang)
  }),

  'summary:save': h('ipc', async (args, ctx) => {
    const [payload] = args as [{ nodeName: string; content: string }]
    const win = ctx.getWindow()
    const opts = {
      defaultPath: `${payload.nodeName}-summary-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, payload.content, 'utf-8')
      return true
    }
    return false
  }),

  'project:coverage': h('both', (args) => {
    const [subjectId] = args as [string]
    const nodes = getNodes(subjectId)
    const total = nodes.length
    const mastered = nodes.filter(n => n.status === 'mastered').length
    return { total, mastered, percent: total ? Math.round((mastered / total) * 100) : 0 }
  }),

  'project:list': h('both', (args) => {
    const [subjectId] = args as [string]
    const projects = getProjects(subjectId)
    return projects.map(p => ({ ...p, steps: getProjectSteps(p.id) }))
  }),

  'project:generate': h('both', async (args) => {
    const [subjectId] = args as [string]
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
  }),

  'project:update-step': h('both', (args) => {
    const [stepId, status] = args as [string, string]
    return updateProjectStepStatus(stepId, status)
  }),

  'project:complete': h('both', async (args) => {
    const [projectId, title, stepTitles] = args as [string, string, string[]]
    updateProjectStatus(projectId, 'completed')
    const lang = getSetting('language')
    return generateProjectReport(title, stepTitles, lang)
  }),

  'project:step-chat': h('both', async (args, ctx) => {
    const [payload] = args as [{
      stepId: string
      stepTitle: string
      stepDescription: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      channelId: string
    }]
    const lang = getSetting('language')
    const systemPrompt = buildProjectStepPrompt(payload.stepTitle, payload.stepDescription, lang)
    const userMsg = payload.messages[payload.messages.length - 1]
    if (userMsg?.role === 'user') {
      saveMessage({ id: randomUUID(), node_id: payload.stepId, subject_id: null, role: 'user', content: userMsg.content })
    }
    try {
      const convo: ChatMessage[] = payload.messages.map(m => ({ role: m.role, content: m.content }))
      const full = await streamChat(convo, ctx.emit, payload.channelId, systemPrompt)
      saveMessage({ id: randomUUID(), node_id: payload.stepId, subject_id: null, role: 'assistant', content: full })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }),

  'project:step-history': h('both', (args) => {
    const [stepId] = args as [string]
    return getMessages(stepId)
  }),

  'defense:questions': h('both', async (args) => {
    const [subjectId] = args as [string]
    const subject = getSubjects().find(s => s.id === subjectId)
    const mastered = getNodes(subjectId).filter(n => n.status === 'mastered').map(n => n.name)
    const lang = getSetting('language')
    const grounding = await retrieve(subjectId, subject?.name || mastered.join(' '), 6)
    return generateDefenseQuestions(subject?.name || '', mastered, lang, grounding)
  }),

  'defense:grade': h('both', async (args) => {
    const [payload] = args as [{ question: string; answer: string; subjectId?: string }]
    const lang = getSetting('language')
    const grounding = payload.subjectId ? await retrieve(payload.subjectId, payload.question, 5) : []
    return gradeDefense(payload.question, payload.answer, lang, grounding)
  }),

  'defense:export': h('ipc', async (args, ctx) => {
    const [payload] = args as [{ content: string }]
    const win = ctx.getWindow()
    const opts = {
      defaultPath: `defense-report-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, payload.content, 'utf-8')
      return true
    }
    return false
  }),

  'bottleneck:check': h('both', () => detectBottlenecks()),

  'bottleneck:report': h('both', async (args) => {
    const [nodeId] = args as [string]
    const node = getNodeById(nodeId)
    const errors = getErrors().filter(e => e.node_id === nodeId).slice(0, 8)
    const lang = getSetting('language')
    return generateBottleneckReport(node?.name || '', errors, lang)
  }),

  'bottleneck:export': h('ipc', async (args, ctx) => {
    const [content] = args as [string]
    const win = ctx.getWindow()
    const opts = {
      defaultPath: `bottleneck-report-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return true
    }
    return false
  }),

  'file:choose': h('ipc', async (_args, ctx) => {
    const win = ctx.getWindow()
    const opts = {
      properties: ['openFile' as const],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return result.canceled ? null : result.filePaths[0]
  }),

  'file:parse': h('ipc', async (args) => {
    const [filePath] = args as [string]
    const { text, filename } = await parseFile(filePath)
    return { text: text.slice(0, 20000), filename }
  }),

  'file:generate-outline': h('both', async (args) => {
    const [text] = args as [string]
    return generateOutline(text, getSetting('language'))
  }),

  'data:export': h('ipc', async (_args, ctx) => {
    const dataDir = getSetting('dataDir')
    const dbPath = path.join(dataDir, 'data.db')
    const win = ctx.getWindow()
    const opts = {
      defaultPath: `learning-assistant-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    }
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(dbPath, result.filePath)
      return true
    }
    return false
  }),

  'data:open-external': h('ipc', (args) => {
    const [url] = args as [string]
    shell.openExternal(url)
  }),

  'app:get-version': h('both', () => app.getVersion()),

  'pref:get': h('both', (args) => {
    const [key] = args as [string]
    return getPref(key)
  }),

  'pref:set': h('both', (args) => {
    const [key, value] = args as [string, string]
    return setPref(key, value)
  }),

  'lan:info': h('both', () => ({
    hasCredentials: hasCredentials(),
    enabled: getPref('lan_enabled') === '1',
    running: lanController?.isRunning() ?? false,
    port: lanPort(),
    ips: lanIps()
  })),

  'lan:setup': h('ipc', (args) => {
    const [username, password] = args as [string, string]
    return setupCredentials(username, password)
  }),

  'lan:enable': h('ipc', async (args) => {
    const [enabled] = args as [boolean]
    if (!lanController) return { running: false, error: 'no_controller' }
    if (enabled) {
      if (!hasCredentials()) return { running: false, error: 'no_credentials' }
      const result = await lanController.start(lanPort())
      if (result.running) setPref('lan_enabled', '1')
      return result
    }
    lanController.stop()
    setPref('lan_enabled', '0')
    return { running: false }
  }),

  'lan:sessions': h('both', () => tokenStore.list()),

  'lan:revoke': h('both', (args) => {
    const [id] = args as [string]
    return { revoked: tokenStore.revoke(id) }
  })
}
