import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Gavel, Mic, MicOff, Download, ChevronRight, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

interface DefenseReport {
  score: number
  logicGaps: string[]
  missingPoints: string[]
  accuracy: string
  overall: string
}

interface DefenseModeProps {
  open: boolean
  subjectId: string | null
  subjectName: string
  onClose: () => void
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
}

export function DefenseMode({ open, subjectId, subjectName, onClose }: DefenseModeProps): JSX.Element {
  const { t } = useT()
  const [questions, setQuestions] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [report, setReport] = useState<DefenseReport | null>(null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const speechSupported = typeof window !== 'undefined' &&
    !!((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ||
       (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition)

  useEffect(() => {
    if (open && subjectId) {
      setQuestions([]); setIdx(0); setAnswer(''); setReport(null)
      setLoading(true)
      window.api.defense.questions(subjectId)
        .then(qs => setQuestions(qs as string[]))
        .finally(() => setLoading(false))
    }
  }, [open, subjectId])

  const toggleVoice = (): void => {
    if (!speechSupported) return
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const Ctor = ((window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition)!
    const rec = new Ctor()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e): void => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setAnswer(prev => (prev ? prev + ' ' : '') + text)
    }
    rec.onend = (): void => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  const submit = async (): Promise<void> => {
    if (!answer.trim()) return
    setGrading(true)
    try {
      const r = await window.api.defense.grade({ question: questions[idx], answer }) as DefenseReport
      setReport(r)
    } finally {
      setGrading(false)
    }
  }

  const next = (): void => {
    setReport(null); setAnswer('')
    setIdx(i => i + 1)
  }

  const retry = (): void => { setReport(null) }

  const exportReport = async (): Promise<void> => {
    if (!report) return
    const md = t(
      `# 模拟答辩报告 — ${subjectName}\n\n## 题目\n${questions[idx]}\n\n## 我的回答\n${answer}\n\n## 思维完整性评分：${report.score}/100\n\n### 逻辑跳步\n${report.logicGaps.map(g => `- ${g}`).join('\n') || '- 无'}\n\n### 遗漏要点\n${report.missingPoints.map(p => `- ${p}`).join('\n') || '- 无'}\n\n### 概念准确性\n${report.accuracy}\n\n### 总体评语\n${report.overall}\n`,
      `# Defense Report — ${subjectName}\n\n## Question\n${questions[idx]}\n\n## My Answer\n${answer}\n\n## Thinking-completeness score: ${report.score}/100\n\n### Logic gaps\n${report.logicGaps.map(g => `- ${g}`).join('\n') || '- None'}\n\n### Missing points\n${report.missingPoints.map(p => `- ${p}`).join('\n') || '- None'}\n\n### Concept accuracy\n${report.accuracy}\n\n### Overall\n${report.overall}\n`
    )
    await window.api.defense.export({ content: md })
  }

  const scoreColor = (s: number): string => s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-purple-500" />
            {t('模拟答辩', 'Mock Defense')} — {subjectName}
            {questions.length > 0 && <span className="text-xs font-normal text-muted-foreground">{t(`第 ${idx + 1}/${questions.length} 题`, `Q ${idx + 1}/${questions.length}`)}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">{t('评委正在准备答辩题...', 'The examiner is preparing questions...')}</p>
          </div>
        )}

        {!loading && questions.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">{t('暂时无法生成答辩题，请先掌握一些节点。', 'No questions yet — master a few nodes first.')}</div>
        )}

        {!loading && idx >= questions.length && questions.length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">🎓</div>
            <p className="font-medium mb-1">{t('答辩完成！', 'Defense complete!')}</p>
            <p className="text-sm text-muted-foreground">{t(`你已完成全部 ${questions.length} 道答辩题。`, `You answered all ${questions.length} questions.`)}</p>
            <Button className="mt-4" onClick={onClose}>{t('结束', 'Finish')}</Button>
          </div>
        )}

        {!loading && idx < questions.length && (
          <ScrollArea className="flex-1 pr-2">
            <div className="border-l-4 border-purple-400 pl-3 py-1 mb-4 bg-purple-50/50 dark:bg-purple-950/30 rounded-r">
              <p className="text-xs text-muted-foreground mb-1">{t('评委提问：', 'Examiner asks:')}</p>
              <p className="text-sm font-medium">{questions[idx]}</p>
            </div>

            {!report ? (
              <>
                <div className="relative">
                  <Textarea
                    className="min-h-[180px]"
                    placeholder={t('讲解你的完整解题思路（支持语音输入）...', 'Explain your full reasoning (voice input supported)...')}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                  />
                  {speechSupported && (
                    <button
                      onClick={toggleVoice}
                      className={cn('absolute bottom-2 right-2 p-2 rounded-full transition-colors',
                        listening ? 'bg-red-500 text-white animate-pulse' : 'bg-muted hover:bg-accent')}
                      title={listening ? t('停止录音', 'Stop recording') : t('语音输入', 'Voice input')}
                    >
                      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <Button className="w-full mt-3" disabled={!answer.trim() || grading} onClick={submit}>
                  {grading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {t('提交答辩', 'Submit')}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center py-2">
                  <div className="text-center">
                    <div className={cn('text-4xl font-bold', scoreColor(report.score))}>{report.score}</div>
                    <p className="text-xs text-muted-foreground">{t('思维完整性评分', 'Thinking completeness')}</p>
                  </div>
                </div>
                <ReportSection title={t('🔀 逻辑跳步', '🔀 Logic gaps')} items={report.logicGaps} empty={t('逻辑连贯，无明显跳步', 'Coherent, no obvious gaps')} />
                <ReportSection title={t('📌 遗漏要点', '📌 Missing points')} items={report.missingPoints} empty={t('要点完整', 'Complete')} />
                <div className="border rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('概念准确性', 'Concept accuracy')}</p>
                  <p className="text-sm">{report.accuracy}</p>
                </div>
                <div className="border rounded-lg p-3 bg-accent/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('总体评语', 'Overall')}</p>
                  <p className="text-sm">{report.overall}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-1" onClick={retry}><RotateCcw className="h-4 w-4" />{t('重答', 'Retry')}</Button>
                  <Button variant="outline" className="gap-1" onClick={exportReport}><Download className="h-4 w-4" />{t('导出', 'Export')}</Button>
                  <Button className="flex-1 gap-1" onClick={next}>{idx + 1 < questions.length ? t('下一题', 'Next') : t('完成', 'Finish')}<ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReportSection({ title, items, empty }: { title: string; items: string[]; empty: string }): JSX.Element {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-green-600">✓ {empty}</p>
      ) : (
        <ul className="text-sm space-y-1 list-disc list-inside">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  )
}
