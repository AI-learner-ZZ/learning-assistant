import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Compass, Send, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { uuid, cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

interface Msg { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }

const DEVIATION_MS = 15 * 60 * 1000

interface FreeExploreProps {
  open: boolean
  onClose: () => void
  onSubjectCreated: () => void
}

export function FreeExplore({ open, onClose, onSubjectCreated }: FreeExploreProps): JSX.Element {
  const { t } = useT()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDeviation, setShowDeviation] = useState(false)
  const [creatingSubject, setCreatingSubject] = useState(false)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstTopicRef = useRef<string>('')

  useEffect(() => {
    if (open) {
      startRef.current = Date.now()
      setShowDeviation(false)
      timerRef.current = setInterval(() => {
        if (Date.now() - startRef.current >= DEVIATION_MS) setShowDeviation(true)
      }, 30000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    if (!firstTopicRef.current) firstTopicRef.current = text
    setInput('')
    const userMsg: Msg = { id: uuid(), role: 'user', content: text }
    const streamId = uuid()
    const channelId = uuid()
    setMessages(m => [...m, userMsg, { id: streamId, role: 'assistant', content: '', streaming: true }])
    setBusy(true)
    const unsub = window.api.chat.onStream(channelId, (data) => {
      if (data.done) {
        setMessages(m => m.map(x => x.id === streamId ? { ...x, content: data.full || x.content, streaming: false } : x))
        setBusy(false); unsub()
      } else {
        setMessages(m => m.map(x => x.id === streamId ? { ...x, content: x.content + data.delta } : x))
      }
    })
    const apiMsgs = [...messages, userMsg].filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
    await window.api.explore.chat({ messages: apiMsgs, channelId })
  }, [input, busy, messages])

  const setAsSubject = async (): Promise<void> => {
    const topic = firstTopicRef.current || input.trim()
    if (!topic) return
    setCreatingSubject(true)
    try {
      await window.api.subjects.createFromDomain(topic)
      onSubjectCreated()
      onClose()
    } finally {
      setCreatingSubject(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-teal-500" />
            {t('自由探索', 'Free Explore')}
            <span className="text-xs font-normal text-muted-foreground">{t('（无系统角色限制的通用对话）', '(general chat, no tutor constraints)')}</span>
          </DialogTitle>
        </DialogHeader>

        {showDeviation && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="flex-1 text-amber-800 dark:text-amber-300">
              {t(`你已在自由探索停留超过 15 分钟。要把「${firstTopicRef.current.slice(0, 20)}」设为副科，与主科并行学习吗？`,
                `You've explored freely for over 15 min. Turn "${firstTopicRef.current.slice(0, 20)}" into a parallel minor subject?`)}
            </span>
            <Button size="sm" variant="outline" className="h-7 gap-1" disabled={creatingSubject} onClick={setAsSubject}>
              {creatingSubject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t('设为副科', 'Make minor')}
            </Button>
            <button onClick={() => setShowDeviation(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        )}

        <ScrollArea className="flex-1 pr-2">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              <Compass className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{t('随便问点什么吧 — 这里不受当前学科约束。', 'Ask anything — no subject constraints here.')}</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={cn('mb-3 flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border')}>
                {m.role === 'user'
                  ? <p className="whitespace-pre-wrap">{m.content}</p>
                  : <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.content || '▋'}</ReactMarkdown></div>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </ScrollArea>

        <div className="flex gap-2 mt-2">
          <Textarea
            className="flex-1 min-h-[44px] max-h-32"
            placeholder={t('自由提问（Enter 发送）', 'Ask anything (Enter to send)')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={busy}
          />
          <Button size="icon" disabled={!input.trim() || busy} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
