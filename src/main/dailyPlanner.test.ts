import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./database', () => ({
  getPref: vi.fn(),
  setPref: vi.fn(),
  getTodayTasks: vi.fn(),
  saveTodayTasks: vi.fn(),
  updateTaskStatus: vi.fn()
}))
vi.mock('./spacedRepetition', () => ({ getHighRiskNodes: vi.fn(() => []) }))
vi.mock('./aiService', () => ({ generateDailyTasks: vi.fn() }))

import { getDifficultyLevel, difficultyDescriptor, applyTaskFeedback, generatePlan } from './dailyPlanner'
import { getPref, setPref, getTodayTasks, saveTodayTasks, updateTaskStatus } from './database'
import { getHighRiskNodes } from './spacedRepetition'
import { generateDailyTasks } from './aiService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('difficultyDescriptor', () => {
  it('describes each difficulty band', () => {
    expect(difficultyDescriptor(0, false)).toContain('standard')
    expect(difficultyDescriptor(-1, false)).toContain('easier')
    expect(difficultyDescriptor(1, false)).toContain('challenging')
  })

  it('clamps to the very basic band below -1', () => {
    expect(difficultyDescriptor(-5, false)).toContain('very basic')
  })

  it('clamps to the high challenge band above 1', () => {
    expect(difficultyDescriptor(5, false)).toContain('high challenge')
  })

  it('returns Chinese when isZh is true', () => {
    expect(difficultyDescriptor(0, true)).toBe('标准难度')
  })
})

describe('getDifficultyLevel', () => {
  it('parses the stored level', () => {
    vi.mocked(getPref).mockReturnValue('2')
    expect(getDifficultyLevel()).toBe(2)
  })

  it('defaults to 0 when unset or invalid', () => {
    vi.mocked(getPref).mockReturnValue('')
    expect(getDifficultyLevel()).toBe(0)
    vi.mocked(getPref).mockReturnValue('abc')
    expect(getDifficultyLevel()).toBe(0)
  })
})

describe('applyTaskFeedback', () => {
  it('always records the feedback on the task', () => {
    vi.mocked(getPref).mockReturnValue('0')
    applyTaskFeedback('t1', 'not_interested')
    expect(updateTaskStatus).toHaveBeenCalledWith('t1', 'pending', 'not_interested')
  })

  it('lowers difficulty on too_hard', () => {
    vi.mocked(getPref).mockReturnValue('0')
    applyTaskFeedback('t1', 'too_hard')
    expect(setPref).toHaveBeenCalledWith('difficulty_level', '-1')
  })

  it('raises difficulty on too_easy', () => {
    vi.mocked(getPref).mockReturnValue('0')
    applyTaskFeedback('t1', 'too_easy')
    expect(setPref).toHaveBeenCalledWith('difficulty_level', '1')
  })

  it('clamps difficulty at the maximum', () => {
    vi.mocked(getPref).mockReturnValue('3')
    applyTaskFeedback('t1', 'too_easy')
    expect(setPref).toHaveBeenCalledWith('difficulty_level', '3')
  })

  it('does not change difficulty on not_interested', () => {
    vi.mocked(getPref).mockReturnValue('0')
    applyTaskFeedback('t1', 'not_interested')
    expect(setPref).not.toHaveBeenCalled()
  })
})

describe('generatePlan', () => {
  const ctx = {
    currentNodeId: null,
    currentNodeName: null,
    unlearnedNodes: [],
    learnedNodes: [],
    language: 'en'
  }

  it('returns existing tasks without calling the AI when a plan already exists', async () => {
    const existing = [{ id: 'e1', task_type: 'core' }] as unknown as ReturnType<typeof getTodayTasks>
    vi.mocked(getTodayTasks).mockReturnValue(existing)

    const result = await generatePlan(ctx)

    expect(generateDailyTasks).not.toHaveBeenCalled()
    expect(result).toBe(existing)
  })

  it('injects review tasks for high-risk nodes and drops AI review tasks', async () => {
    vi.mocked(getPref).mockReturnValue('0')
    vi.mocked(getTodayTasks).mockReturnValueOnce([]).mockReturnValueOnce([{ id: 'final' }] as unknown as ReturnType<typeof getTodayTasks>)
    vi.mocked(generateDailyTasks).mockResolvedValue([
      { type: 'core', nodeId: null, title: 'Core task', description: 'd', minutes: 30 },
      { type: 'review', nodeId: 'x', title: 'AI review', description: 'd', minutes: 10 }
    ] as unknown as Awaited<ReturnType<typeof generateDailyTasks>>)
    vi.mocked(getHighRiskNodes).mockReturnValue([
      { node_id: 'r1', name: 'Alpha', risk: 0.8, daysUntilDue: 1, lastReviewedAt: null }
    ])

    await generatePlan(ctx)

    const saved = vi.mocked(saveTodayTasks).mock.calls[0][0]
    const titles = saved.map(t => t.title)
    expect(titles).toContain('Core task')
    expect(titles).toContain('Review: Alpha')
    expect(titles).not.toContain('AI review')
  })
})
