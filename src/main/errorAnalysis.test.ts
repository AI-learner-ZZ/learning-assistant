import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./database', () => ({
  getUnresolvedErrorCounts: vi.fn(),
  getUnresolvedErrorsByType: vi.fn()
}))

import { getPendingContrast, CONTRAST_THRESHOLD } from './errorAnalysis'
import { getUnresolvedErrorCounts, getUnresolvedErrorsByType } from './database'

beforeEach(() => vi.clearAllMocks())

describe('getPendingContrast', () => {
  it('returns null when no error type reaches the threshold', () => {
    vi.mocked(getUnresolvedErrorCounts).mockReturnValue([
      { error_type: '概念混淆', count: CONTRAST_THRESHOLD - 1 }
    ] as unknown as ReturnType<typeof getUnresolvedErrorCounts>)
    expect(getPendingContrast()).toBeNull()
  })

  it('ignores the "none" error buckets even past the threshold', () => {
    vi.mocked(getUnresolvedErrorCounts).mockReturnValue([
      { error_type: '无', count: 10 },
      { error_type: 'None', count: 10 }
    ] as unknown as ReturnType<typeof getUnresolvedErrorCounts>)
    expect(getPendingContrast()).toBeNull()
  })

  it('returns the eligible error type with deduped node names', () => {
    vi.mocked(getUnresolvedErrorCounts).mockReturnValue([
      { error_type: '概念混淆', count: CONTRAST_THRESHOLD }
    ] as unknown as ReturnType<typeof getUnresolvedErrorCounts>)
    vi.mocked(getUnresolvedErrorsByType).mockReturnValue([
      { node_name: 'A' },
      { node_name: 'A' },
      { node_name: 'B' },
      { node_name: null }
    ] as unknown as ReturnType<typeof getUnresolvedErrorsByType>)

    const result = getPendingContrast()
    expect(result).not.toBeNull()
    expect(result?.errorType).toBe('概念混淆')
    expect(result?.count).toBe(CONTRAST_THRESHOLD)
    expect(result?.nodeNames).toEqual(['A', 'B'])
  })
})
