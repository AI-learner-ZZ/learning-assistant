import { safeStorage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getPref, setPref } from './database'

const SEARCH_KEY_FILE = (): string => path.join(app.getPath('userData'), 'search.enc')

export type SearchProvider = 'serpapi' | 'bing' | 'searxng' | 'none'

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
  if (provider === 'searxng') return !!getSearxngUrl()
  return !!getSearchKey()
}

export async function performSearch(query: string): Promise<SearchResult[]> {
  const provider = getSearchProvider()
  switch (provider) {
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
