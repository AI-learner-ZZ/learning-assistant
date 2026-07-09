import { safeStorage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getPref, setPref } from './database'

const SEARCH_KEY_FILE = (): string => path.join(app.getPath('userData'), 'search.enc')

export type SearchProvider = 'free' | 'serpapi' | 'bing' | 'searxng' | 'none'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
}

export function getSearchProvider(): SearchProvider {
  return (getPref('search_provider') as SearchProvider) || 'none'
}

export function setSearchProvider(provider: SearchProvider): void {
  setPref('search_provider', provider)
}

export function getSearxngUrl(): string {
  return getPref('searxng_url') || ''
}

export function setSearxngUrl(url: string): void {
  setPref('searxng_url', url)
}

export function saveSearchKey(key: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(SEARCH_KEY_FILE(), safeStorage.encryptString(key))
  } else {
    fs.writeFileSync(SEARCH_KEY_FILE(), Buffer.from(key).toString('base64'))
    setPref('search_key_fallback', '1')
  }
}

export function getSearchKey(): string | null {
  const file = SEARCH_KEY_FILE()
  if (!fs.existsSync(file)) return null
  try {
    const data = fs.readFileSync(file)
    if (safeStorage.isEncryptionAvailable() && getPref('search_key_fallback') !== '1') {
      return safeStorage.decryptString(data)
    }
    return Buffer.from(data.toString(), 'base64').toString()
  } catch {
    return null
  }
}

export function isSearchConfigured(): boolean {
  const provider = getSearchProvider()
  if (provider === 'none') return false
  if (provider === 'free') return true
  if (provider === 'searxng') return !!getSearxngUrl()
  return !!getSearchKey()
}

export async function performSearch(query: string): Promise<SearchResult[]> {
  const provider = getSearchProvider()
  switch (provider) {
    case 'free':
      return searchFree(query)
    case 'serpapi':
      return searchSerpApi(query)
    case 'bing':
      return searchBing(query)
    case 'searxng':
      return searchSearxng(query)
    default:
      throw new Error('Search not configured')
  }
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

export function decodeDdgUrl(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/)
  if (m) {
    try {
      return decodeURIComponent(m[1])
    } catch {
      return ''
    }
  }
  if (href.startsWith('//')) return `https:${href}`
  return href
}

export function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const snippets: string[] = []
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let sm: RegExpExecArray | null
  while ((sm = snippetRe.exec(html)) !== null) snippets.push(stripHtml(sm[1]))

  const links: { href: string; title: string }[] = []
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let lm: RegExpExecArray | null
  while ((lm = linkRe.exec(html)) !== null) {
    const href = decodeDdgUrl(lm[1])
    const title = stripHtml(lm[2])
    if (href && title) links.push({ href, title })
  }

  return links.slice(0, 5).map((l, i) => {
    let source = l.href
    try {
      source = new URL(l.href).hostname
    } catch {
      source = l.href
    }
    return { title: l.title, snippet: snippets[i] ?? '', url: l.href, source }
  })
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } })
  return parseDuckDuckGoHtml(await res.text())
}

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  const lang = /[一-鿿]/.test(query) ? 'zh' : 'en'
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=2&format=json&origin=*`
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } })
  const data = (await res.json()) as { query?: { search?: { title: string; snippet: string }[] } }
  return (data.query?.search ?? []).map(r => ({
    title: r.title,
    snippet: stripHtml(r.snippet),
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    source: `${lang}.wikipedia.org`
  }))
}

async function searchFree(query: string): Promise<SearchResult[]> {
  const [ddg, wiki] = await Promise.allSettled([searchDuckDuckGo(query), searchWikipedia(query)])
  const merged: SearchResult[] = []
  if (ddg.status === 'fulfilled') merged.push(...ddg.value)
  if (wiki.status === 'fulfilled') merged.push(...wiki.value)
  const seen = new Set<string>()
  const deduped = merged.filter(r => {
    if (!r.url || seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
  if (deduped.length === 0) throw new Error('Free search returned no results')
  return deduped.slice(0, 5)
}

async function searchSerpApi(query: string): Promise<SearchResult[]> {
  const key = getSearchKey()
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}`
  const res = await fetch(url)
  const data = (await res.json()) as { organic_results?: { title: string; snippet: string; link: string; source?: string }[] }
  return (data.organic_results ?? []).slice(0, 5).map(r => ({
    title: r.title,
    snippet: r.snippet ?? '',
    url: r.link,
    source: r.source ?? new URL(r.link).hostname
  }))
}

async function searchBing(query: string): Promise<SearchResult[]> {
  const key = getSearchKey()
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`
  const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key ?? '' } })
  const data = (await res.json()) as { webPages?: { value: { name: string; snippet: string; url: string }[] } }
  return (data.webPages?.value ?? []).slice(0, 5).map(r => ({
    title: r.name,
    snippet: r.snippet,
    url: r.url,
    source: new URL(r.url).hostname
  }))
}

async function searchSearxng(query: string): Promise<SearchResult[]> {
  const base = getSearxngUrl().replace(/\/$/, '')
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url)
  const data = (await res.json()) as { results?: { title: string; content: string; url: string; engine?: string }[] }
  return (data.results ?? []).slice(0, 5).map(r => ({
    title: r.title,
    snippet: r.content ?? '',
    url: r.url,
    source: r.engine ?? new URL(r.url).hostname
  }))
}

export function pickDualSources(results: SearchResult[]): SearchResult[] {
  if (results.length <= 1) return results
  const first = results[0]
  const second = results.find(r => r.source !== first.source) ?? results[1]
  return [first, second]
}

export function formatResultsForAI(query: string, results: SearchResult[], isZh: boolean): string {
  const header = isZh ? `以下是关于"${query}"的联网搜索结果：` : `Web search results for "${query}":`
  const body = results
    .map((r, i) => `[${i + 1}] ${r.title} (${r.source})\n${r.snippet}\n${r.url}`)
    .join('\n\n')
  const footer = isZh
    ? '请基于这些结果回答，并对比不同来源、标注推荐信源。'
    : 'Answer based on these results, compare sources, and note the recommended one.'
  return `${header}\n\n${body}\n\n${footer}`
}
