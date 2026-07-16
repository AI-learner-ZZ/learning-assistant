import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('./settings', () => ({ getApiKey: vi.fn(() => 'k'), getSetting: vi.fn(() => '') }))

import { buildSystemPrompt, buildLearnerContext, extractJson, type GeneratedTreeNode } from './aiService'

describe('buildSystemPrompt', () => {
  it('injects the novice stance and direct-instruction guidance', () => {
    const zh = buildSystemPrompt({ mastery: 'novice', language: 'zh' })
    expect(zh).toContain('直接教学')
    const en = buildSystemPrompt({ mastery: 'novice', language: 'en' })
    expect(en).toContain('Direct instruction')
  })

  it('uses the Socratic stance for advanced learners', () => {
    expect(buildSystemPrompt({ mastery: 'advanced', language: 'en' })).toContain('Socratic')
  })

  it('defaults to the learning stance when mastery is omitted', () => {
    expect(buildSystemPrompt({ language: 'en' })).toContain('Half-teach')
  })

  it('emits Chinese or English rules based on language', () => {
    expect(buildSystemPrompt({ language: 'zh' })).toContain('铁律')
    expect(buildSystemPrompt({ language: 'en' })).toContain('[RULES]')
  })

  it('includes node context and mastered nodes when provided', () => {
    const out = buildSystemPrompt({ language: 'en', nodeName: 'Backprop', learnedNodes: ['Derivatives', 'Chain rule'] })
    expect(out).toContain('Backprop')
    expect(out).toContain('Chain rule')
  })

  it('switches the search rule with searchEnabled', () => {
    expect(buildSystemPrompt({ language: 'en', searchEnabled: true })).toContain('FUNCTION_CALL:search')
    expect(buildSystemPrompt({ language: 'en', searchEnabled: false })).toContain('cannot browse')
  })

  it('embeds the learner context when provided', () => {
    const ctx = buildLearnerContext({ streakDays: 5, language: 'en' })
    expect(buildSystemPrompt({ language: 'en', learnerContext: ctx })).toContain('ABOUT THIS LEARNER')
  })
})

describe('buildLearnerContext', () => {
  it('returns empty when there is nothing personal to say', () => {
    expect(buildLearnerContext({ language: 'en' })).toBe('')
    expect(buildLearnerContext({ streakDays: 1, language: 'en' })).toBe('')
  })

  it('mentions a multi-day streak, recent wins, and weak spots', () => {
    const out = buildLearnerContext({
      streakDays: 6,
      recentlyMastered: ['Derivatives', 'Chain rule'],
      strugglingWith: ['ConceptConfusion'],
      language: 'en'
    })
    expect(out).toContain('6-day')
    expect(out).toContain('Chain rule')
    expect(out).toContain('ConceptConfusion')
  })

  it('renders in Chinese', () => {
    const out = buildLearnerContext({ streakDays: 3, recentlyMastered: ['导数'], language: 'zh' })
    expect(out).toContain('关于这位学习者')
    expect(out).toContain('导数')
  })
})

describe('extractJson', () => {
  const fallback = { name: 'x', nodes: [] as GeneratedTreeNode[] }

  it('parses plain JSON', () => {
    expect(extractJson('{"name":"a","nodes":[]}', fallback)).toEqual({ name: 'a', nodes: [] })
  })

  it('parses JSON wrapped in a ```json fence', () => {
    const raw = 'Sure!\n```json\n{"name":"b","nodes":[]}\n```\nHope that helps.'
    expect(extractJson(raw, fallback)).toEqual({ name: 'b', nodes: [] })
  })

  it('parses JSON surrounded by prose without a fence', () => {
    const raw = 'Here is the tree: {"name":"c","nodes":[]} — enjoy.'
    expect(extractJson(raw, fallback)).toEqual({ name: 'c', nodes: [] })
  })

  it('parses a top-level array', () => {
    expect(extractJson('[1,2,3]', [] as number[])).toEqual([1, 2, 3])
  })

  it('returns the fallback for invalid JSON', () => {
    expect(extractJson('{ not valid json ]', fallback)).toBe(fallback)
  })

  it('returns the fallback when there is no JSON at all', () => {
    expect(extractJson('no json here', fallback)).toBe(fallback)
  })

  it('returns the fallback for empty input', () => {
    expect(extractJson('', fallback)).toBe(fallback)
  })
})
