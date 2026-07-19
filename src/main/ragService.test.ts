import { describe, it, expect, vi } from 'vitest'

vi.mock('./database', () => ({
  insertSource: vi.fn(),
  insertChunks: vi.fn(),
  getChunksBySubject: vi.fn(() => [])
}))
vi.mock('./aiService', () => ({ embedTexts: vi.fn() }))

import {
  chunkText,
  cosineSimilarity,
  tokenize,
  lexicalScore,
  rankChunks,
  formatRetrievedContext,
  estimateTokens,
  buildCorpusDigest,
  type Rankable
} from './ragService'

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world')).toEqual(['hello world'])
  })

  it('returns nothing for empty or whitespace', () => {
    expect(chunkText('   \n  ')).toEqual([])
  })

  it('splits long text into multiple overlapping chunks', () => {
    const text = 'sentence. '.repeat(400)
    const chunks = chunkText(text, 500, 100)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(560)
  })

  it('covers the whole text across chunks', () => {
    const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(text, 400, 80)
    expect(chunks.join(' ')).toContain('word0')
    expect(chunks.join(' ')).toContain('word299')
  })
})

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('handles zero vectors and empty input', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
  })
})

describe('tokenize and lexicalScore', () => {
  it('lowercases and drops short tokens and punctuation', () => {
    expect(tokenize('The Quick, brown fox!')).toEqual(['the', 'quick', 'brown', 'fox'])
  })

  it('scores higher when more query terms appear', () => {
    const doc = tokenize('gradient descent minimizes the loss function')
    const strong = lexicalScore(tokenize('gradient loss'), doc)
    const weak = lexicalScore(tokenize('gradient banana'), doc)
    expect(strong).toBeGreaterThan(weak)
  })

  it('is zero when nothing matches', () => {
    expect(lexicalScore(tokenize('apple banana'), tokenize('gradient descent'))).toBe(0)
  })
})

describe('rankChunks', () => {
  const items: Rankable[] = [
    { id: 'a', text: 'gradient descent optimization', embedding: [1, 0, 0] },
    { id: 'b', text: 'baking sourdough bread', embedding: [0, 1, 0] },
    { id: 'c', text: 'stochastic gradient methods', embedding: [0.9, 0.1, 0] }
  ]

  it('ranks by cosine when a query embedding is given', () => {
    const ranked = rankChunks('optimization', items, 2, [1, 0, 0])
    expect(ranked.map(r => r.id)).toEqual(['a', 'c'])
  })

  it('falls back to lexical ranking without a query embedding', () => {
    const ranked = rankChunks('gradient', items, 2, null)
    expect(ranked.map(r => r.id)).toContain('a')
    expect(ranked.map(r => r.id)).toContain('c')
    expect(ranked.map(r => r.id)).not.toContain('b')
  })

  it('respects topK and drops zero-score items', () => {
    const ranked = rankChunks('sourdough', items, 5, null)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].id).toBe('b')
  })
})

describe('formatRetrievedContext', () => {
  it('returns empty for no chunks', () => {
    expect(formatRetrievedContext([], false)).toBe('')
  })

  it('numbers the excerpts and adds a grounding instruction', () => {
    const out = formatRetrievedContext(['first', 'second'], false)
    expect(out).toContain('[REFERENCE]')
    expect(out).toContain('[1] first')
    expect(out).toContain('[2] second')
  })

  it('uses Chinese framing when requested', () => {
    expect(formatRetrievedContext(['x'], true)).toContain('参考资料')
  })
})

describe('estimateTokens', () => {
  it('approximates tokens from character length', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })
})

describe('buildCorpusDigest', () => {
  it('lists source titles with a chunk sample', () => {
    const sources = [{ id: 's1', title: 'Doc One' }, { id: 's2', title: 'Doc Two' }]
    const chunks = new Map([['s1', ['alpha content', 'beta content']], ['s2', ['gamma content']]])
    const digest = buildCorpusDigest(sources, chunks)
    expect(digest).toContain('Doc One')
    expect(digest).toContain('alpha content')
    expect(digest).toContain('Doc Two')
  })

  it('handles a source with no chunks', () => {
    const digest = buildCorpusDigest([{ id: 's1', title: 'Empty' }], new Map())
    expect(digest).toContain('Empty')
  })

  it('caps the digest length', () => {
    const sources = [{ id: 's1', title: 'Big' }]
    const chunks = new Map([['s1', ['x'.repeat(5000)]]])
    expect(buildCorpusDigest(sources, chunks, 500).length).toBeLessThanOrEqual(500)
  })
})
