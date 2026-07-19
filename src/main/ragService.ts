import { randomUUID } from 'crypto'
import { insertSource, insertChunks, getChunksBySubject, type ChunkRow } from './database'
import { embedTexts } from './aiService'

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length)
    if (end < clean.length) {
      const slice = clean.slice(start, end)
      const boundary = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf('。'))
      if (boundary > size * 0.5) end = start + boundary + 1
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 1)
}

export function lexicalScore(queryTokens: string[], docTokens: string[]): number {
  const unique = Array.from(new Set(queryTokens))
  if (unique.length === 0) return 0
  const freq = new Map<string, number>()
  for (const t of docTokens) freq.set(t, (freq.get(t) ?? 0) + 1)
  let score = 0
  for (const q of unique) {
    const tf = freq.get(q)
    if (tf) score += 1 + Math.log(tf)
  }
  return score / unique.length
}

export interface Rankable {
  id: string
  text: string
  embedding: number[] | null
}

export function rankChunks(query: string, items: Rankable[], topK: number, queryEmbedding: number[] | null): Rankable[] {
  const qTokens = tokenize(query)
  const scored = items.map(item => {
    let score: number
    if (queryEmbedding && item.embedding) score = cosineSimilarity(queryEmbedding, item.embedding)
    else score = lexicalScore(qTokens, tokenize(item.text))
    return { item, score }
  })
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.item)
}

export function formatRetrievedContext(chunks: string[], isZh: boolean): string {
  if (chunks.length === 0) return ''
  const header = isZh
    ? '【参考资料】以下片段来自学习者自己的教材，请优先依据它们讲解，并注明引用了第几条；材料未覆盖的内容请明确说明，不要编造。'
    : "[REFERENCE] The excerpts below come from the learner's own materials. Ground your explanation in them, cite which excerpt you used, and clearly say when something is not covered — do not fabricate."
  const body = chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
  return `${header}\n\n${body}`
}

function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as number[]) : null
  } catch {
    return null
  }
}

export function buildCorpusDigest(
  sources: { id: string; title: string }[],
  chunksBySource: Map<string, string[]>,
  maxChars = 6000
): string {
  const blocks: string[] = []
  for (const s of sources) {
    const chunks = chunksBySource.get(s.id) ?? []
    const sample = chunks.slice(0, 2).join(' ').slice(0, 600)
    blocks.push(sample ? `《${s.title}》：${sample}` : `《${s.title}》`)
  }
  return blocks.join('\n\n').slice(0, maxChars)
}

export interface IngestInput {
  subjectId: string
  kind: string
  title: string
  origin: string | null
  text: string
}

export async function ingestText(input: IngestInput): Promise<{ sourceId: string; chunks: number }> {
  const chunks = chunkText(input.text)
  const sourceId = randomUUID()

  let embeddings: (number[] | null)[] = chunks.map(() => null)
  if (chunks.length > 0) {
    try {
      const result = await embedTexts(chunks)
      embeddings = chunks.map((_, i) => result[i] ?? null)
    } catch {
      embeddings = chunks.map(() => null)
    }
  }

  const rows: ChunkRow[] = chunks.map((text, i) => ({
    id: randomUUID(),
    source_id: sourceId,
    subject_id: input.subjectId,
    seq: i,
    text,
    embedding: embeddings[i] ? JSON.stringify(embeddings[i]) : null
  }))

  insertSource({
    id: sourceId,
    subject_id: input.subjectId,
    kind: input.kind,
    title: input.title,
    origin: input.origin,
    status: chunks.length > 0 ? 'ingested' : 'failed',
    chunk_count: chunks.length,
    token_estimate: chunks.reduce((sum, c) => sum + estimateTokens(c), 0)
  })
  insertChunks(rows)

  return { sourceId, chunks: chunks.length }
}

export async function retrieve(subjectId: string, query: string, topK = 4): Promise<string[]> {
  const rows = getChunksBySubject(subjectId)
  if (rows.length === 0) return []

  let queryEmbedding: number[] | null = null
  if (rows.some(r => r.embedding)) {
    try {
      const [vec] = await embedTexts([query])
      queryEmbedding = vec ?? null
    } catch {
      queryEmbedding = null
    }
  }

  const items: Rankable[] = rows.map(r => ({ id: r.id, text: r.text, embedding: parseEmbedding(r.embedding) }))
  return rankChunks(query, items, topK, queryEmbedding).map(i => i.text)
}
