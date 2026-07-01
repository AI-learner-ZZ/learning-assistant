import { getBottleneckCandidates } from './database'

export const MIN_ERRORS = 5
export const MIN_SPAN_DAYS = 7
const LOOKBACK_DAYS = 60

export interface Bottleneck {
  nodeId: string
  nodeName: string
  errorCount: number
  spanDays: number
}

export function detectBottlenecks(): Bottleneck[] {
  const candidates = getBottleneckCandidates(MIN_ERRORS, LOOKBACK_DAYS)
  const result: Bottleneck[] = []
  for (const c of candidates) {
    const first = new Date(c.first_error).getTime()
    const last = new Date(c.last_error).getTime()
    const spanDays = (last - first) / (24 * 60 * 60 * 1000)
    if (spanDays >= MIN_SPAN_DAYS) {
      result.push({
        nodeId: c.node_id,
        nodeName: c.node_name,
        errorCount: c.error_count,
        spanDays: Math.round(spanDays)
      })
    }
  }
  return result
}
