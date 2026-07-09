import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./database', () => ({
  getBottleneckCandidates: vi.fn()
}))

import { detectBottlenecks, MIN_SPAN_DAYS } from './bottleneckDetector'
import { getBottleneckCandidates } from './database'

beforeEach(() => vi.clearAllMocks())

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    node_id: 'n1',
    node_name: 'Node One',
    error_count: 6,
    first_error: '2026-06-01T00:00:00Z',
    last_error: '2026-06-20T00:00:00Z',
    ...overrides
  }
}

describe('detectBottlenecks', () => {
  it('returns an empty list when there are no candidates', () => {
    vi.mocked(getBottleneckCandidates).mockReturnValue([])
    expect(detectBottlenecks()).toEqual([])
  })

  it('excludes candidates whose error span is shorter than the minimum', () => {
    vi.mocked(getBottleneckCandidates).mockReturnValue([
      candidate({ first_error: '2026-06-01T00:00:00Z', last_error: '2026-06-03T00:00:00Z' })
    ] as unknown as ReturnType<typeof getBottleneckCandidates>)
    expect(detectBottlenecks()).toEqual([])
  })

  it('includes candidates that span at least the minimum days', () => {
    vi.mocked(getBottleneckCandidates).mockReturnValue([
      candidate({ first_error: '2026-06-01T00:00:00Z', last_error: '2026-06-20T00:00:00Z' })
    ] as unknown as ReturnType<typeof getBottleneckCandidates>)
    const result = detectBottlenecks()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ nodeId: 'n1', nodeName: 'Node One', errorCount: 6 })
    expect(result[0].spanDays).toBeGreaterThanOrEqual(MIN_SPAN_DAYS)
  })
})
