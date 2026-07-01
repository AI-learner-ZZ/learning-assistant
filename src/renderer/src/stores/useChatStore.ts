import { create } from 'zustand'
import { uuid } from '@/lib/utils'
import type { LectureStyle } from '@/components/LectureModeSwitch'

export interface SearchSource {
  title: string
  snippet: string
  url: string
  source: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
  hasQuestion?: boolean
  searchQuery?: string
  searchSources?: SearchSource[]
}

const SEARCH_MARKER = /FUNCTION_CALL:search:.+/g

interface ChatStore {
  messages: Message[]
  nodeId: string | null
  isLocked: boolean
  isGenerating: boolean
  currentChannelId: string | null
  lectureStyle: LectureStyle

  loadHistory: (nodeId: string) => Promise<void>
  clearChat: () => void
  sendMessage: (content: string, context: {
    nodeName?: string
    nodeDescription?: string
    learnedNodes?: string[]
    weakPoints?: string[]
  }) => Promise<void>
  setNodeId: (id: string | null) => void
  setLectureStyle: (style: LectureStyle) => void
  appendStreamDelta: (delta: string) => void
  attachSearch: (query: string, sources: SearchSource[]) => void
  finalizeStream: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  nodeId: null,
  isLocked: false,
  isGenerating: false,
  currentChannelId: null,
  lectureStyle: 'intuitive',

  loadHistory: async (nodeId: string) => {
    set({ nodeId, messages: [] })
    const history = await window.api.chat.getHistory(nodeId) as Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }>
    const messages: Message[] = history
      .filter(m => m.role !== 'system')
      .map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        hasQuestion: m.role === 'assistant' && m.content.includes('[QUESTION]')
      }))

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const isLocked = !!(
      lastAssistant?.hasQuestion &&
      lastUser &&
      messages.indexOf(lastUser) < messages.indexOf(lastAssistant)
    )

    set({ messages, isLocked })
  },

  clearChat: () => {
    const { nodeId } = get()
    if (nodeId) window.api.chat.clear(nodeId)
    set({ messages: [], isLocked: false })
  },

  setNodeId: (id) => set({ nodeId: id }),

  setLectureStyle: (style) => {
    set({ lectureStyle: style })
    window.api.lecture.setStyle(style)
  },

  sendMessage: async (content, context) => {
    if (get().isGenerating) return

    const userMsg: Message = { id: uuid(), role: 'user', content }
    set(state => ({
      messages: [...state.messages, userMsg],
      isGenerating: true,
      isLocked: false
    }))

    const streamId = uuid()
    const channelId = uuid()
    set(state => ({
      messages: [...state.messages, { id: streamId, role: 'assistant', content: '', isStreaming: true }],
      currentChannelId: channelId
    }))

    let awaitingContinuation = false

    const unsubSearch = window.api.chat.onSearch(channelId, (data) => {
      get().attachSearch(data.query, data.sources as SearchSource[])
    })

    const unsubscribe = window.api.chat.onStream(channelId, (data) => {
      if (data.done) {
        const full = data.full || ''

        if (!awaitingContinuation && /FUNCTION_CALL:search:/.test(full)) {
          awaitingContinuation = true
          return
        }
        get().finalizeStream()
        unsubscribe()
        unsubSearch()
      } else {
        get().appendStreamDelta(data.delta)
      }
    })

    const { messages } = get()
    const apiMessages = messages
      .filter(m => !m.isStreaming && m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    await window.api.chat.send({
      nodeId: get().nodeId,
      messages: apiMessages,
      systemContext: context,
      lectureStyle: get().lectureStyle,
      channelId
    })
  },

  appendStreamDelta: (delta: string) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.isStreaming ? { ...m, content: m.content + delta } : m
      )
    }))
  },

  attachSearch: (query, sources) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.isStreaming ? { ...m, searchQuery: query, searchSources: sources } : m
      )
    }))
  },

  finalizeStream: () => {
    set(state => ({
      messages: state.messages.map(m => {
        if (!m.isStreaming) return m
        const cleaned = m.content.replace(SEARCH_MARKER, '').trim()
        return { ...m, content: cleaned, isStreaming: false, hasQuestion: cleaned.includes('[QUESTION]') }
      }),
      isLocked: state.messages.some(m => m.isStreaming && m.content.includes('[QUESTION]')),
      isGenerating: false,
      currentChannelId: null
    }))
  }
}))
