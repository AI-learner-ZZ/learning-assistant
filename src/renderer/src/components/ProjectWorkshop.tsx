import React, { useEffect, useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Hammer, Lock, Send, ChevronLeft, CheckCircle2, PartyPopper } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { uuid } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

const UNLOCK_THRESHOLD = 40

interface Step {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  sort_order: number
}

interface Project {
  id: string
  subject_id: string
  title: string
  description: string | null
  status: 'active' | 'completed'
  steps: Step[]
}

interface Msg { id: string; role: 'user' | 'assistant'; content: string; streaming?: boolean }

interface ProjectWorkshopProps {
  open: boolean
  subjectId: string | null
  onClose: () => void
}

export function ProjectWorkshop({ open, subjectId, onClose }: ProjectWorkshopProps): JSX.Element {
  const { t } = useT()
  const [coverage, setCoverage] = useState<{ percent: number } | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState<Step | null>(null)
  const [report, setReport] = useState<string | null>(null)

  useEffect(() => {
    if (open && subjectId) {
      setReport(null); setActiveStep(null)
      setLoading(true)
      Promise.all([
        window.api.project.coverage(subjectId),
        window.api.project.list(subjectId)
      ]).then(([cov, projs]) => {
        setCoverage(cov as { percent: number })
        const list = projs as Project[]
        setProject(list[0] ?? null)
      }).finally(() => setLoading(false))
    }
  }, [open, subjectId])

  const generate = async (): Promise<void> => {
    if (!subjectId) return
    setLoading(true)
    try {
      const p = await window.api.project.generate(subjectId) as Project
      setProject(p)
    } finally {
      setLoading(false)
    }
  }

  const setStepStatus = async (step: Step, status: Step['status']): Promise<void> => {
    await window.api.project.updateStep(step.id, status)
    setProject(p => p ? { ...p, steps: p.steps.map(s => s.id === step.id ? { ...s, status } : s) } : p)
  }

  const completeProject = async (): Promise<void> => {
    if (!project) return
    setLoading(true)
    try {
      const rpt = await window.api.project.complete(project.id, project.title, project.steps.map(s => s.title)) as string
      setReport(rpt)
      setProject(p => p ? { ...p, status: 'completed' } : p)
    } finally {
      setLoading(false)
    }
  }

  const locked = (coverage?.percent ?? 0) < UNLOCK_THRESHOLD && !project
  const allDone = project ? project.steps.every(s => s.status === 'done') : false

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-orange-500" />
            {activeStep ? (
              <button className="flex items-center gap-1 text-sm" onClick={() => setActiveStep(null)}>
                <ChevronLeft className="h-4 w-4" /> {t('返回项目看板', 'Back to board')}
              </button>
            ) : t('渐进式项目工坊', 'Project Workshop')}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">{t('处理中...', 'Working...')}</p>
          </div>
        )}

        {!loading && activeStep && (
          <StepChat step={activeStep} onStatusChange={s => setStepStatus(activeStep, s)} />
        )}

        {!loading && !activeStep && report && (
          <ScrollArea className="flex-1">
            <div className="border-2 border-green-300 dark:border-green-800 rounded-xl p-5 bg-green-50/50 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold mb-3">
                <PartyPopper className="h-5 w-5" /> {t('项目完成报告', 'Project Report')}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        )}

        {!loading && !activeStep && !report && locked && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Lock className="h-10 w-10 mb-3" />
            <p className="font-medium text-foreground mb-1">{t('毕业项目尚未解锁', 'Capstone project locked')}</p>
            <p className="text-sm max-w-sm">{t(`当知识树掌握度达到 ${UNLOCK_THRESHOLD}% 时自动解锁。当前覆盖度 ${coverage?.percent ?? 0}%。继续学习吧！`, `Unlocks at ${UNLOCK_THRESHOLD}% mastery. Currently ${coverage?.percent ?? 0}%. Keep learning!`)}</p>
          </div>
        )}

        {!loading && !activeStep && !report && !locked && !project && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Hammer className="h-10 w-10 mb-3 text-orange-500" />
            <p className="font-medium mb-1">{t('你已解锁毕业项目！', 'Capstone project unlocked!')}</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('让 AI 根据你已掌握的内容，设计一个综合实践项目。', 'Let the AI design a hands-on project from what you have mastered.')}</p>
            <Button onClick={generate}>{t('生成毕业项目', 'Generate project')}</Button>
          </div>
        )}

        {!loading && !activeStep && !report && project && (
          <ScrollArea className="flex-1">
            <div className="mb-3">
              <h3 className="font-semibold">{project.title}</h3>
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['todo', 'in_progress', 'done'] as const).map(col => (
                <div key={col} className="bg-muted/40 rounded-lg p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                    {col === 'todo' ? t('待开始', 'To do') : col === 'in_progress' ? t('进行中', 'In progress') : t('已完成', 'Done')}
                  </p>
                  <div className="space-y-2">
                    {project.steps.filter(s => s.status === col).map(step => (
                      <div key={step.id} className="bg-card border rounded-lg p-2.5 shadow-sm">
                        <p className="text-sm font-medium mb-1">{step.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{step.description}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 flex-1"
                            onClick={() => { setActiveStep(step); if (step.status === 'todo') setStepStatus(step, 'in_progress') }}>
                            {t('进入', 'Open')}
                          </Button>
                          {step.status !== 'done' && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setStepStatus(step, 'done')}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {allDone && project.status !== 'completed' && (
              <Button className="w-full mt-4" onClick={completeProject}>
                <PartyPopper className="h-4 w-4 mr-1" /> {t('全部完成！生成项目报告', 'All done! Generate report')}
              </Button>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StepChat({ step, onStatusChange }: { step: Step; onStatusChange: (s: 'done') => void }): JSX.Element {
  const { t } = useT()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.project.stepHistory(step.id).then(h => {
      const hist = (h as { id: string; role: string; content: string }[])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
      setMessages(hist)
    })
  }, [step.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const userMsg: Msg = { id: uuid(), role: 'user', content: text }
    const streamId = uuid()
    const channelId = uuid()
    setMessages(m => [...m, userMsg, { id: streamId, role: 'assistant', content: '', streaming: true }])
    setBusy(true)

    const unsub = window.api.chat.onStream(channelId, (data) => {
      if (data.done) {
        setMessages(m => m.map(x => x.id === streamId ? { ...x, content: data.full || x.content, streaming: false } : x))
        setBusy(false)
        unsub()
      } else {
        setMessages(m => m.map(x => x.id === streamId ? { ...x, content: x.content + data.delta } : x))
      }
    })

    const apiMsgs = [...messages, userMsg].filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }))
    await window.api.project.stepChat({
      stepId: step.id, stepTitle: step.title, stepDescription: step.description || '',
      messages: apiMsgs, channelId
    })
  }, [input, busy, messages, step])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border rounded-lg p-3 bg-accent/30 mb-2">
        <p className="text-sm font-medium">{step.title}</p>
        <p className="text-xs text-muted-foreground">{step.description}</p>
      </div>
      <ScrollArea className="flex-1 pr-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            {t('粘贴你的代码或报错截图描述，导师会用反问引导你调试（不会直接给答案）。', 'Paste your code or describe the error — the mentor guides you to debug with questions, not answers.')}
          </p>
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
          placeholder={t('粘贴代码 / 描述报错（Enter 发送）', 'Paste code / describe error (Enter to send)')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          disabled={busy}
        />
        <div className="flex flex-col gap-1">
          <Button size="icon" disabled={!input.trim() || busy} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="outline" title={t('标记完成', 'Mark done')} onClick={() => onStatusChange('done')}>
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
