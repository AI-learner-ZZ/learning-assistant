import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {} }))
vi.mock('./settings', () => ({ getApiKey: vi.fn(() => 'k'), getSetting: vi.fn(() => '') }))

import { buildSystemPrompt, buildLearnerContext, extractJson, parseWarmupQuestions, parseMaterials, type GeneratedTreeNode } from './aiService'

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

  it('embeds retrieved RAG context when provided', () => {
    const out = buildSystemPrompt({ language: 'en', retrievedContext: '[REFERENCE] excerpt [1] foo' })
    expect(out).toContain('[REFERENCE]')
    expect(out).toContain('foo')
  })
})

describe('parseMaterials', () => {
  it('parses a fenced JSON array of materials', () => {
    const raw = '```json\n[{"title":"AWS Docs","url":"https://aws.amazon.com","why":"authoritative","kind":"doc"}]\n```'
    const out = parseMaterials(raw)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ title: 'AWS Docs', url: 'https://aws.amazon.com', kind: 'doc' })
  })

  it('drops entries missing a title or url', () => {
    expect(parseMaterials(JSON.stringify([{ title: 'x' }, { url: 'https://y.com' }]))).toEqual([])
  })

  it('defaults why and kind when absent', () => {
    const out = parseMaterials(JSON.stringify([{ title: 'T', url: 'https://u.com' }]))
    expect(out[0]).toMatchObject({ why: '', kind: 'doc' })
  })

  it('returns empty for non-array or garbage', () => {
    expect(parseMaterials('{"not":"array"}')).toEqual([])
    expect(parseMaterials('nonsense')).toEqual([])
  })

  it('caps at 12 entries', () => {
    const many = JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ title: `t${i}`, url: `https://u${i}.com` })))
    expect(parseMaterials(many)).toHaveLength(12)
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

describe('parseWarmupQuestions', () => {
  const valid = { question: 'Q1?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, nodeName: 'Topic' }

  it('parses a fenced JSON array of questions', () => {
    const out = parseWarmupQuestions('```json\n' + JSON.stringify([valid]) + '\n```')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ question: 'Q1?', correctIndex: 2 })
  })

  it('drops entries with an out-of-range correctIndex', () => {
    expect(parseWarmupQuestions(JSON.stringify([{ ...valid, correctIndex: 9 }]))).toEqual([])
    expect(parseWarmupQuestions(JSON.stringify([{ ...valid, correctIndex: -1 }]))).toEqual([])
  })

  it('drops entries missing options or a question', () => {
    expect(parseWarmupQuestions(JSON.stringify([{ ...valid, options: ['only'] }]))).toEqual([])
    expect(parseWarmupQuestions(JSON.stringify([{ ...valid, question: '' }]))).toEqual([])
  })

  it('keeps valid entries and discards invalid ones in the same batch', () => {
    const out = parseWarmupQuestions(JSON.stringify([valid, { ...valid, correctIndex: 99 }]))
    expect(out).toHaveLength(1)
  })

  it('defaults a missing nodeName to an empty string', () => {
    const out = parseWarmupQuestions(JSON.stringify([{ question: 'Q', options: ['a', 'b'], correctIndex: 0 }]))
    expect(out[0].nodeName).toBe('')
  })

  it('returns an empty list for non-array or invalid JSON', () => {
    expect(parseWarmupQuestions('{"not":"an array"}')).toEqual([])
    expect(parseWarmupQuestions('garbage')).toEqual([])
  })

  it('caps the batch at 8 questions', () => {
    expect(parseWarmupQuestions(JSON.stringify(Array.from({ length: 12 }, () => valid)))).toHaveLength(8)
  })
})
