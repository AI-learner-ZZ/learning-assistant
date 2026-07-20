import { describe, it, expect } from 'vitest'
import { routeChannel } from './channels'

describe('routeChannel', () => {
  it('routes chat stream channels with their id', () => {
    expect(routeChannel('chat-stream-abc-123')).toEqual({ kind: 'stream', id: 'abc-123' })
  })

  it('routes chat search channels with their id', () => {
    expect(routeChannel('chat-search-xyz')).toEqual({ kind: 'search', id: 'xyz' })
  })

  it('treats everything else as broadcast', () => {
    expect(routeChannel('contrast-available')).toEqual({ kind: 'broadcast', name: 'contrast-available' })
  })
})
