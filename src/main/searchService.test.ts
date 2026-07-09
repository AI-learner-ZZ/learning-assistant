import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString()
  },
  app: { getPath: () => '/tmp/test-userdata' }
}))

vi.mock('./database', () => ({
  getPref: vi.fn(),
  setPref: vi.fn()
}))

vi.mock('fs', () => {
  const stub = { existsSync: vi.fn(() => false), readFileSync: vi.fn(), writeFileSync: vi.fn() }
  return { default: stub, ...stub }
})

import {
  parseDuckDuckGoHtml,
  decodeDdgUrl,
  stripHtml,
  decodeEntities,
  isSearchConfigured,
  pickDualSources,
  formatResultsForAI,
  performSearch,
  type SearchResult
} from './searchService'
import { getPref } from './database'

const DDG_FIXTURE = `
<div class="result__body">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FGradient_descent&rut=1">Gradient descent - Wikipedia</a>
  <a class="result__snippet" href="x">Gradient descent is a <b>method</b> for optimization.</a>
</div>
<div class="result__body">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fgd&rut=2">GD Guide</a>
  <a class="result__snippet" href="y">An intro &amp; guide.</a>
</div>`

function provider(value: string, extra: Record<string, string> = {}): void {
  vi.mocked(getPref).mockImplementation((key: string) => {
    if (key === 'search_provider') return value
    return extra[key] ?? ''
  })
}

describe('decodeEntities and stripHtml', () => {
  it('decodes common html entities', () => {
    expect(decodeEntities('a &amp; b &#39;c&#39; &lt;d&gt;')).toBe("a & b 'c' <d>")
  })

  it('strips tags and collapses whitespace', () => {
    expect(stripHtml('<b>hello</b>   <i>world</i>')).toBe('hello world')
  })
})

describe('decodeDdgUrl', () => {
  it('extracts and decodes the uddg redirect target', () => {
    expect(decodeDdgUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com%2Fx&rut=z')).toBe('https://a.com/x')
  })

  it('upgrades a protocol-relative url to https', () => {
    expect(decodeDdgUrl('//a.com/path')).toBe('https://a.com/path')
  })

  it('returns a direct url unchanged', () => {
    expect(decodeDdgUrl('https://a.com/x')).toBe('https://a.com/x')
  })
})

describe('parseDuckDuckGoHtml', () => {
  it('extracts titles, decoded urls, sources, and snippets', () => {
    const results = parseDuckDuckGoHtml(DDG_FIXTURE)
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      title: 'Gradient descent - Wikipedia',
      url: 'https://en.wikipedia.org/wiki/Gradient_descent',
      source: 'en.wikipedia.org'
    })
    expect(results[0].snippet).toContain('method for optimization')
    expect(results[1].url).toBe('https://example.com/gd')
    expect(results[1].snippet).toBe('An intro & guide.')
  })

  it('returns an empty list for html with no results', () => {
    expect(parseDuckDuckGoHtml('<html><body>nothing</body></html>')).toEqual([])
  })
})

describe('isSearchConfigured', () => {
  it('is true for the free provider without any key', () => {
    provider('free')
    expect(isSearchConfigured()).toBe(true)
  })

  it('is false when off', () => {
    provider('none')
    expect(isSearchConfigured()).toBe(false)
  })

  it('requires a url for searxng', () => {
    provider('searxng')
    expect(isSearchConfigured()).toBe(false)
    provider('searxng', { searxng_url: 'https://s.example.com' })
    expect(isSearchConfigured()).toBe(true)
  })

  it('is false for serpapi when no key file exists', () => {
    provider('serpapi')
    expect(isSearchConfigured()).toBe(false)
  })
})

describe('pickDualSources', () => {
  const results: SearchResult[] = [
    { title: 'a', snippet: '', url: 'https://x.com/1', source: 'x.com' },
    { title: 'b', snippet: '', url: 'https://x.com/2', source: 'x.com' },
    { title: 'c', snippet: '', url: 'https://y.com/1', source: 'y.com' }
  ]

  it('prefers a second result from a different source', () => {
    const picked = pickDualSources(results)
    expect(picked).toHaveLength(2)
    expect(picked[0].source).toBe('x.com')
    expect(picked[1].source).toBe('y.com')
  })

  it('returns a single result untouched', () => {
    expect(pickDualSources([results[0]])).toEqual([results[0]])
  })
})

describe('formatResultsForAI', () => {
  const results: SearchResult[] = [{ title: 'T', snippet: 'S', url: 'https://u.com', source: 'u.com' }]

  it('uses Chinese framing when isZh is true', () => {
    const out = formatResultsForAI('q', results, true)
    expect(out).toContain('联网搜索结果')
    expect(out).toContain('https://u.com')
  })

  it('uses English framing when isZh is false', () => {
    expect(formatResultsForAI('q', results, false)).toContain('Web search results')
  })
})

describe('performSearch with the free provider', () => {
  beforeEach(() => {
    provider('free')
    vi.unstubAllGlobals()
  })

  it('merges DuckDuckGo and Wikipedia results and dedupes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('duckduckgo')) return { status: 200, text: async () => DDG_FIXTURE, json: async () => ({}) }
      return { status: 200, text: async () => '', json: async () => ({ query: { search: [{ title: 'Wiki Foo', snippet: 'bar' }] } }) }
    }))
    const results = await performSearch('gradient descent')
    expect(results.some(r => r.source === 'en.wikipedia.org')).toBe(true)
    expect(results.some(r => r.title === 'Wiki Foo')).toBe(true)
    const urls = results.map(r => r.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('routes Chinese queries to the zh wikipedia', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ status: 200, text: async () => '', json: async () => ({ query: { search: [] } }) }))
    vi.stubGlobal('fetch', fetchMock)
    await performSearch('梯度下降').catch(() => undefined)
    const calledZh = fetchMock.mock.calls.some(c => String(c[0]).includes('zh.wikipedia.org'))
    expect(calledZh).toBe(true)
  })

  it('still returns results when DuckDuckGo fails but Wikipedia succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('duckduckgo')) throw new Error('blocked')
      return { status: 200, text: async () => '', json: async () => ({ query: { search: [{ title: 'Wiki Only', snippet: 's' }] } }) }
    }))
    const results = await performSearch('anything')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Wiki Only')
  })

  it('throws when both sources return nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, text: async () => '', json: async () => ({ query: { search: [] } }) })))
    await expect(performSearch('nothing')).rejects.toThrow()
  })
})
