import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0-test') },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { openExternal: vi.fn() }
}))
vi.mock('fs', () => {
  const stub = { writeFileSync: vi.fn(), readFileSync: vi.fn(), copyFileSync: vi.fn(), existsSync: vi.fn(() => false) }
  return { default: stub, ...stub }
})
vi.mock('../database', () => ({
  getNodes: vi.fn(() => []),
  getAllNodes: vi.fn(() => []),
  getNodeById: vi.fn(),
  upsertNode: vi.fn(),
  updateNodeStatus: vi.fn(),
  deleteNode: vi.fn(),
  updateNodeRelations: vi.fn(),
  updateTaskStatus: vi.fn(),
  saveMessage: vi.fn(),
  getMessages: vi.fn(() => []),
  clearMessages: vi.fn(),
  logError: vi.fn(),
  getErrors: vi.fn(() => []),
  setPref: vi.fn(),
  getPref: vi.fn(),
  getTodayTasks: vi.fn(() => []),
  upsertSubject: vi.fn(),
  getSubjects: vi.fn(() => []),
  deleteSubject: vi.fn(),
  countSubjects: vi.fn(() => 0),
  insertLearningRecord: vi.fn(),
  getDailyAccuracy: vi.fn(() => []),
  resolveErrorsByType: vi.fn(),
  createProject: vi.fn(),
  getProjects: vi.fn(() => []),
  updateProjectStatus: vi.fn(),
  createProjectStep: vi.fn(),
  getProjectSteps: vi.fn(() => []),
  updateProjectStepStatus: vi.fn(),
  getStudyTimeDistribution: vi.fn(() => []),
  getAccuracyByHour: vi.fn(() => []),
  getReviewState: vi.fn(),
  getUnresolvedErrorCounts: vi.fn(() => []),
  getMasteredSince: vi.fn(() => []),
  getRecordsSince: vi.fn(() => ({ sessions: 0, minutes: 0, accuracy: 0 })),
  getSources: vi.fn(() => []),
  deleteSource: vi.fn(),
  getChunksBySubject: vi.fn(() => []),
  initDatabase: vi.fn()
}))
vi.mock('../settings', () => ({
  saveApiKey: vi.fn(),
  getApiKey: vi.fn(),
  setSetting: vi.fn(),
  getSetting: vi.fn(() => 'en'),
  getAllSettings: vi.fn(() => ({})),
  isSetupComplete: vi.fn(() => true)
}))
vi.mock('../aiService', () => ({
  streamChat: vi.fn(),
  buildSystemPrompt: vi.fn(() => ''),
  buildLearnerContext: vi.fn(() => ''),
  generateOutline: vi.fn(),
  explainNodeNecessity: vi.fn(),
  generateSummary: vi.fn(),
  generateContrastWorkshop: vi.fn(),
  gradeChoice: vi.fn(),
  generateKnowledgeTree: vi.fn(),
  generateProject: vi.fn(),
  buildProjectStepPrompt: vi.fn(() => ''),
  generateProjectReport: vi.fn(),
  generateDefenseQuestions: vi.fn(),
  gradeDefense: vi.fn(),
  generateBottleneckReport: vi.fn(),
  generateNodePrimer: vi.fn(),
  generateWarmup: vi.fn(),
  generateSpark: vi.fn(),
  suggestMaterials: vi.fn(),
  curateResources: vi.fn(),
  suggestResourceSearch: vi.fn(),
  resetClient: vi.fn()
}))
vi.mock('../spark', () => ({ shouldRefreshSpark: vi.fn(() => false) }))
vi.mock('../ragService', () => ({
  ingestText: vi.fn(),
  retrieve: vi.fn(async () => []),
  formatRetrievedContext: vi.fn(() => ''),
  buildCorpusDigest: vi.fn(() => '')
}))
vi.mock('../fetchService', () => ({ isFetchableUrl: vi.fn(() => true), fetchPageText: vi.fn() }))
vi.mock('../fileParser', () => ({ parseFile: vi.fn() }))
vi.mock('../templateLoader', () => ({
  listTemplates: vi.fn(() => []),
  loadTemplate: vi.fn(),
  createSubjectFromTree: vi.fn(),
  replaceSubjectTree: vi.fn()
}))
vi.mock('../spacedRepetition', () => ({ recordReview: vi.fn(), getHighRiskNodes: vi.fn(() => []) }))
vi.mock('../streak', () => ({ getStreak: vi.fn(() => ({ count: 3, longest: 3, active: true, atRisk: false, broken: false, freezes: 2 })), recordActivity: vi.fn() }))
vi.mock('../recap', () => ({
  buildWeeklyRecap: vi.fn(() => ({ title: '', lines: [], empty: true })),
  shouldShowRecap: vi.fn(() => false),
  RECAP_INTERVAL_DAYS: 7
}))
vi.mock('../dailyPlanner', () => ({
  generatePlan: vi.fn(),
  applyTaskFeedback: vi.fn(),
  getDifficultyLevel: vi.fn(() => 0),
  difficultyDescriptor: vi.fn(() => 'standard')
}))
vi.mock('../errorAnalysis', () => ({ getPendingContrast: vi.fn(() => null) }))
vi.mock('../bottleneckDetector', () => ({ detectBottlenecks: vi.fn(() => []) }))
vi.mock('../treeValidator', () => ({ validateReparent: vi.fn(() => ({ hasCycle: false, cycleEdges: [] })) }))
vi.mock('../searchService', () => ({
  getSearchProvider: vi.fn(() => 'none'),
  setSearchProvider: vi.fn(),
  getSearxngUrl: vi.fn(() => ''),
  setSearxngUrl: vi.fn(),
  saveSearchKey: vi.fn(),
  isSearchConfigured: vi.fn(() => false),
  performSearch: vi.fn(),
  pickDualSources: vi.fn(),
  formatResultsForAI: vi.fn(() => '')
}))
vi.mock('../transports/auth', () => ({
  setupCredentials: vi.fn(() => true),
  hasCredentials: vi.fn(() => false),
  tokenStore: { list: vi.fn(() => []), revoke: vi.fn(() => true) }
}))

import { HANDLERS, type Ctx } from './registry'
import { setPref, updateTaskStatus } from '../database'
import { recordActivity } from '../streak'

const ctx: Ctx = { emit: vi.fn(), getWindow: () => null }

beforeEach(() => vi.clearAllMocks())

const IPC_ONLY = [
  'settings:save-setup',
  'settings:choose-directory',
  'tree:export',
  'tree:import',
  'summary:save',
  'defense:export',
  'bottleneck:export',
  'file:choose',
  'file:parse',
  'data:export',
  'data:open-external',
  'lan:setup',
  'lan:enable'
]

describe('handler registry', () => {
  it('registers every entry with a function and a valid scope', () => {
    const entries = Object.entries(HANDLERS)
    expect(entries.length).toBeGreaterThanOrEqual(70)
    for (const [, def] of entries) {
      expect(typeof def.fn).toBe('function')
      expect(['ipc', 'both']).toContain(def.scope)
    }
  })

  it('keeps native and sensitive handlers off the HTTP transport', () => {
    for (const name of IPC_ONLY) {
      expect(HANDLERS[name]?.scope).toBe('ipc')
    }
  })

  it('exposes core learning features on both transports', () => {
    for (const name of ['chat:send', 'rag:list', 'streak:get', 'dashboard:risks', 'daily:get-tasks', 'lan:info', 'lan:sessions']) {
      expect(HANDLERS[name]?.scope).toBe('both')
    }
  })

  it('passes single-arg payloads through to the logic', async () => {
    const result = await HANDLERS['streak:get'].fn([], ctx)
    expect(result).toMatchObject({ count: 3 })
  })

  it('destructures multi-arg invocations', async () => {
    await HANDLERS['pref:set'].fn(['some-key', 'some-value'], ctx)
    expect(setPref).toHaveBeenCalledWith('some-key', 'some-value')
  })

  it('records streak activity when a task is completed', async () => {
    await HANDLERS['daily:update-task'].fn(['t1', 'done', undefined], ctx)
    expect(updateTaskStatus).toHaveBeenCalledWith('t1', 'done', undefined)
    expect(recordActivity).toHaveBeenCalled()
    vi.clearAllMocks()
    await HANDLERS['daily:update-task'].fn(['t1', 'pending', 'too_hard'], ctx)
    expect(recordActivity).not.toHaveBeenCalled()
  })

  it('reports a missing lan controller instead of crashing', async () => {
    const result = await HANDLERS['lan:enable'].fn([true], ctx)
    expect(result).toEqual({ running: false, error: 'no_controller' })
  })

  it('describes the lan state', async () => {
    const info = await HANDLERS['lan:info'].fn([], ctx) as { hasCredentials: boolean; running: boolean; port: number; ips: string[] }
    expect(info).toMatchObject({ hasCredentials: false, running: false })
    expect(typeof info.port).toBe('number')
    expect(Array.isArray(info.ips)).toBe(true)
  })
})
