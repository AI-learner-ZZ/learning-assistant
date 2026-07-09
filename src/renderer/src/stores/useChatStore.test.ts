import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore, type Message } from './useChatStore'

function streaming(content: string): Message {
  return { id: 's', role: 'assistant', content, isStreaming: true }
}

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    nodeId: null,
    isLocked: false,
    isGenerating: false,
    currentChannelId: null,
    lectureStyle: 'intuitive'
  })
})

describe('appendStreamDelta', () => {
  it('appends to the streaming message only', () => {
    useChatStore.setState({
      messages: [{ id: 'u', role: 'user', content: 'hi' }, streaming('Hel')]
    })
    useChatStore.getState().appendStreamDelta('lo')
    const msgs = useChatStore.getState().messages
    expect(msgs[0].content).toBe('hi')
    expect(msgs[1].content).toBe('Hello')
  })
})

describe('attachSearch', () => {
  it('attaches query and sources to the streaming message', () => {
    useChatStore.setState({ messages: [streaming('working')] })
    useChatStore.getState().attachSearch('q', [{ title: 't', snippet: 's', url: 'u', source: 'src' }])
    const msg = useChatStore.getState().messages[0]
    expect(msg.searchQuery).toBe('q')
    expect(msg.searchSources).toHaveLength(1)
  })
})

describe('finalizeStream', () => {
  it('locks the input and flags the question when the reply contains [QUESTION]', () => {
    useChatStore.setState({ messages: [streaming('Think it over. [QUESTION] why?')], isGenerating: true })
    useChatStore.getState().finalizeStream()
    const msg = useChatStore.getState().messages[0]
    expect(msg.isStreaming).toBe(false)
    expect(msg.hasQuestion).toBe(true)
    expect(useChatStore.getState().isLocked).toBe(true)
    expect(useChatStore.getState().isGenerating).toBe(false)
  })

  it('does not lock when there is no question', () => {
    useChatStore.setState({ messages: [streaming('Here is the answer.')], isGenerating: true })
    useChatStore.getState().finalizeStream()
    expect(useChatStore.getState().isLocked).toBe(false)
    expect(useChatStore.getState().messages[0].hasQuestion).toBe(false)
  })

  it('strips the search function-call marker from the final content', () => {
    useChatStore.setState({ messages: [streaming('Answer text FUNCTION_CALL:search:some query')] })
    useChatStore.getState().finalizeStream()
    expect(useChatStore.getState().messages[0].content).toBe('Answer text')
  })
})

describe('setLectureStyle', () => {
  it('updates the style and notifies the backend', () => {
    const setStyle = vi.fn()
    ;(window as unknown as { api: unknown }).api = { lecture: { setStyle } }
    useChatStore.getState().setLectureStyle('formula')
    expect(useChatStore.getState().lectureStyle).toBe('formula')
    expect(setStyle).toHaveBeenCalledWith('formula')
  })
})
