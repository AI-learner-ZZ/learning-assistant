export function shouldRefreshSpark(cachedDate: string | null, today: string): boolean {
  return cachedDate !== today
}

export function parseSpark(raw: string): string {
  if (!raw) return ''
  let s = raw.trim()

  const fence = s.match(/```[a-z]*\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()

  s = s.replace(/^\s*(spark|did you know|fun fact|你知道吗|冷知识|小知识)\s*[:：]\s*/i, '')
  s = s.replace(/^["'“”「」]+|["'“”「」]+$/g, '')
  s = s.replace(/\s+/g, ' ').trim()

  return s.slice(0, 240)
}
