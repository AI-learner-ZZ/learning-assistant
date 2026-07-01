import { getUnresolvedErrorCounts, getUnresolvedErrorsByType } from './database'

export const CONTRAST_THRESHOLD = 3

export interface PendingContrast {
  errorType: string
  count: number
  nodeNames: string[]
}

export function getPendingContrast(): PendingContrast | null {
  const counts = getUnresolvedErrorCounts()

  const eligible = counts.find(
    c => c.count >= CONTRAST_THRESHOLD && !['无', 'None', ''].includes(c.error_type)
  )
  if (!eligible) return null

  const errors = getUnresolvedErrorsByType(eligible.error_type)
  const nodeNames = Array.from(
    new Set(errors.map(e => e.node_name).filter((n): n is string => !!n))
  )
  return { errorType: eligible.error_type, count: eligible.count, nodeNames }
}
