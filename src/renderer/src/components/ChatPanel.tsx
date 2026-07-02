import React, { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { Send, Trash2, Lock, Loader2, Upload, ExternalLink, Globe, FileText, Save } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import { LectureModeSwitch } from './LectureModeSwitch'
import { MermaidDiagram } from './MermaidDiagram'
import { SvgDiagram } from './SvgDiagram'
import { useChatStore, Message, SearchSource } from '@/stores/useChatStore'
import { useTreeStore } from '@/stores/useTreeStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function renderContent(content: string, isZh: boolean): string {
  return content
    .replace(/\[SCORE\][^\n]*/g, '')
    .replace(/\[ERROR_TYPE\][^\n]*/g, '')
    .replace(/\[SUMMARY\]/g, isZh ? '📋 **本节学习总结**\n\n' : '📋 **Session Summary**\n\n')
    .replace(/\[QUESTION\]/g, isZh ? '🤔 **追问：**' : '🤔 **Question:**')
    .trim()
}

interface Segment { type: 'md' | 'mermaid' | 'svg'; value: string }
function splitRenderables(content: string): Segment[] {
  const segments: Segment[] = []
  const regex = /```(mermaid|svg)\s*\n([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) segments.push({ type: 'md', value: content.slice(last, m.index) })
    segments.push({ type: m[1] as 'mermaid' | 'svg', value: m[2].trim() })
    last = regex.lastIndex
  }
  if (last < content.length) segments.push({ type: 'md', value: content.slice(last) })
  return segments.length ? segments : [{ type: 'md', value: content }]
}

function Markdown({ children }: { children: string }): JSX.Element {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
      {children}
    </ReactMarkdown>
  )
}

function SearchSourceCard({ query, sources }: { query: string; sources: SearchSource[] }): JSX.Element {
  const { t } = useT()
  const open = (url: string): void => { window.api.data.openExternal(url) }
  return (
    <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/30 mb-2 mt-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
        <Globe className="h-3.5 w-3.5" />
        {t('联网搜索', 'Web search')}：{query} — {t('双源校验', 'dual-source')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sources.slice(0, 2).map((s, i) => (
          <div key={i} className="border rounded-md p-2 bg-background">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-foreground line-clamp-1">{t('来源', 'Source')}{i + 1}：{s.source}</span>
              <button onClick={() => open(s.url)} className="text-muted-foreground hover:text-blue-500 shrink-0" title={t('打开原始链接', 'Open source link')}>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs font-medium line-clamp-1 mb-0.5">{s.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{s.snippet}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">{t('💡 不同来源可能有差异，请对比后判断。AI 已给出推荐信源。', '💡 Sources may differ — compare before trusting. The AI has noted the recommended one.')}</p>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  isLast: boolean
}

function MessageBubble({ message, isLast }: MessageBubbleProps): JSX.Element {
  const { t, isZh } = useT()
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming

  const displayContent = isUser ? message.content : renderContent(message.content, isZh)

  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
      )}>
        {isUser ? t('你', 'You') : 'AI'}
      </div>

      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-card border rounded-tl-sm shadow-sm'
      )}>
        {!isUser && message.searchSources && message.searchSources.length > 0 && (
          <SearchSourceCard query={message.searchQuery || ''} sources={message.searchSources} />
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
        ) : (
          <div className={cn('prose prose-sm dark:prose-invert max-w-none', isUser && 'prose-invert')}>
            {displayContent
              ? splitRenderables(displayContent).map((seg, i) =>
                  seg.type === 'mermaid'
                    ? <MermaidDiagram key={i} code={seg.value} />
                    : seg.type === 'svg'
                      ? <SvgDiagram key={i} code={seg.value} />
                      : <Markdown key={i}>{seg.value}</Markdown>
                )
              : (isStreaming && isLast ? <span>▋</span> : null)}
          </div>
        )}
        {isStreaming && isLast && !displayContent && (
          <span className="inline-block w-2 h-4 bg-current animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}

interface OutlineCardProps {
  filename: string
  outline: string
  onClose: () => void
}

function OutlineCard({ filename, outline, onClose }: OutlineCardProps): JSX.Element {
  const { t } = useT()
  return (
    <div className="border rounded-lg p-4 bg-accent/30 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">📄 {filename} — {t('知识骨架', 'Outline')}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none max-h-48 overflow-y-auto">
        <ReactMarkdown>{outline}</ReactMarkdown>
      </div>
    </div>
  )
}

interface ChatPanelProps {
  nodeId: string | null
  nodeName: string | null
  nodeDescription: string | null
  headerInset?: boolean
}

export function ChatPanel({ nodeId, nodeName, nodeDescription, headerInset }: ChatPanelProps): JSX.Element {
  const { messages, isLocked, isGenerating, loadHistory, clearChat, sendMessage, lectureStyle, setLectureStyle } = useChatStore()
  const { getLearnedNodeNames, updateNodeStatus, markNodeLearning } = useTreeStore()
  const { settings } = useSettingsStore()
  const [input, setInput] = useState('')
  const [outline, setOutline] = useState<{ filename: string; content: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isZh = settings.language === 'zh'
  const t = (zh: string, en: string): string => isZh ? zh : en

  useEffect(() => {
    if (nodeId) {
      loadHistory(nodeId)
      setSummary(null)
    }
  }, [nodeId, loadHistory])

  useEffect(() => {
    window.api.lecture.getStyle().then(s => setLectureStyle(s as typeof lectureStyle))

  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')

    if (nodeId) markNodeLearning(nodeId)
    await sendMessage(text, {
      nodeName: nodeName || undefined,
      nodeDescription: nodeDescription || undefined,
      learnedNodes: getLearnedNodeNames()
    })
  }, [input, isGenerating, sendMessage, nodeName, nodeDescription, getLearnedNodeNames, nodeId, markNodeLearning])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (): Promise<void> => {
    setUploadingFile(true)
    try {
      const filePath = await window.api.file.choose()
      if (!filePath) return
      const { text, filename } = await window.api.file.parse(filePath) as { text: string; filename: string }
      const generatedOutline = await window.api.file.generateOutline(text)
      setOutline({ filename, content: generatedOutline })

      await sendMessage(
        t(`我上传了《${filename}》，请基于以下知识骨架开始教学：\n\n${generatedOutline}`, `I've uploaded "${filename}". Please teach based on this knowledge skeleton:\n\n${generatedOutline}`),
        { nodeName: nodeName || undefined, learnedNodes: getLearnedNodeNames() }
      )
    } finally {
      setUploadingFile(false)
    }
  }

  const handleEndSession = async (): Promise<void> => {
    if (!nodeId || messages.length === 0) return
    setSummarizing(true)
    try {
      const convo = messages.filter(m => !m.isStreaming).map(m => ({ role: m.role, content: m.content }))
      const result = await window.api.summary.generate({ nodeName: nodeName || '', messages: convo }) as string
      setSummary(result)

      const correctRate = 0.8
      await window.api.learning.complete({ nodeId, durationMinutes: 20, correctRate })
      await updateNodeStatus(nodeId, 'mastered', 100)
    } finally {
      setSummarizing(false)
    }
  }

  const handleSaveSummary = async (): Promise<void> => {
    if (!summary) return
    await window.api.summary.save({ nodeName: nodeName || 'summary', content: summary })
  }

  if (!nodeId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
        <div className="text-5xl mb-4">💬</div>
        <h3 className="text-lg font-medium mb-2">{t('选择一个知识节点开始学习', 'Select a knowledge node to start learning')}</h3>
        <p className="text-sm max-w-xs">{t('在左侧知识树中点击任意节点，AI导师将进入苏格拉底式对话模式', 'Click any node in the knowledge tree on the left to start a Socratic dialogue with the AI tutor')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className={cn('flex items-center justify-between px-4 py-2.5 border-b shrink-0 gap-2', headerInset && 'pl-12')}>
        <div className="min-w-0">
          <h2 className="font-medium text-sm truncate">{nodeName || t('对话学习', 'Learning Chat')}</h2>
          {nodeDescription && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{nodeDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LectureModeSwitch value={lectureStyle} onChange={setLectureStyle} disabled={isGenerating} />
          {isLocked && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Lock className="h-3 w-3" />
              {t('请先回答追问', 'Answer first')}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            disabled={messages.length === 0 || isGenerating || summarizing}
            onClick={handleEndSession}
            title={t('结束本节并生成总结', 'End session & summarize')}
          >
            {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {t('结束学习', 'End')}
          </Button>
          <Button variant="ghost" size="icon" title={t('清空对话', 'Clear chat')} onClick={clearChat}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <div className="text-3xl mb-3">🎓</div>
            <p className="font-medium mb-1">{t(`开始学习「${nodeName}」`, `Start learning "${nodeName}"`)}</p>
            <p className="text-xs">{t('告诉 AI 你想从哪里开始，或者问"怎么学这个"', 'Tell the AI where to start, or ask "how do I learn this"')}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id} message={msg} isLast={i === messages.length - 1} />
        ))}
        {outline && (
          <OutlineCard
            filename={outline.filename}
            outline={outline.content}
            onClose={() => setOutline(null)}
          />
        )}
        {summary && (
          <div className="border-2 border-primary/30 rounded-xl p-4 bg-gradient-to-br from-primary/5 to-accent/20 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold flex items-center gap-1.5">📋 {t('今日认知小结', "Today's Summary")}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleSaveSummary}>
                  <Save className="h-3.5 w-3.5" /> {t('保存为笔记', 'Save as note')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSummary(null)}>✕</Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{summary}</ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="px-4 py-3 border-t shrink-0">
        {isLocked && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 rounded-lg px-3 py-2 mb-2">
            <Lock className="h-3 w-3 shrink-0" />
            {t('AI 正在等待你的回答，请认真思考后作答', 'The AI is waiting for your answer. Think carefully before responding.')}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={isGenerating || uploadingFile}
            onClick={handleFileUpload}
            title={t('上传教材文件 (PDF/DOCX/TXT)', 'Upload textbook (PDF/DOCX/TXT)')}
          >
            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Textarea
            ref={textareaRef}
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            placeholder={isLocked ? t('回答追问...', 'Answer the question...') : t('向 AI 导师发送消息（Enter 发送，Shift+Enter 换行）', 'Message the AI tutor (Enter to send, Shift+Enter for newline)')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
          />
          <Button
            size="icon"
            disabled={!input.trim() || isGenerating}
            onClick={handleSend}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
