import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Scale, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

interface ContrastWorkshop {
  errorType: string
  conceptA: { title: string; explanation: string }
  conceptB: { title: string; explanation: string }
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface ContrastLearningProps {
  open: boolean
  errorType: string
  onClose: () => void
  onResolved: () => void
}

export function ContrastLearning({ open, errorType, onClose, onResolved }: ContrastLearningProps): JSX.Element {
  const { t } = useT()
  const [workshop, setWorkshop] = useState<ContrastWorkshop | null>(null)
  const [loading, setLoading] = useState(false)
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null)

  useEffect(() => {
    if (open) {
      setWorkshop(null)
      setChosen(null)
      setResult(null)
      setLoading(true)
      window.api.contrast.generate()
        .then(w => setWorkshop(w as ContrastWorkshop | null))
        .finally(() => setLoading(false))
    }
  }, [open])

  const submit = async (): Promise<void> => {
    if (chosen === null || !workshop) return
    const res = await window.api.contrast.submit({
      errorType: workshop.errorType,
      question: workshop.question,
      options: workshop.options,
      chosenIndex: chosen,
      correctIndex: workshop.correctIndex
    }) as { correct: boolean; feedback: string }
    setResult(res)
    if (res.correct) onResolved()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-500" />
            {t('对比学习工作坊', 'Contrast Learning Workshop')}
            <span className="text-xs font-normal text-muted-foreground">{t(`（你在「${errorType}」上反复出错）`, `(recurring "${errorType}" errors)`)}</span>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">{t('AI 正在生成对比练习...', 'AI is generating a contrast exercise...')}</p>
          </div>
        )}

        {!loading && !workshop && (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('暂时无法生成对比练习，请稍后再试。', 'Could not generate an exercise right now, please try later.')}</div>
        )}

        {!loading && workshop && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 border-green-200 dark:border-green-900 rounded-lg p-3 bg-green-50/50 dark:bg-green-950/30">
                <h4 className="font-semibold text-sm text-green-700 dark:text-green-300 mb-1">{workshop.conceptA.title}</h4>
                <p className="text-xs text-muted-foreground">{workshop.conceptA.explanation}</p>
              </div>
              <div className="border-2 border-blue-200 dark:border-blue-900 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/30">
                <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-1">{workshop.conceptB.title}</h4>
                <p className="text-xs text-muted-foreground">{workshop.conceptB.explanation}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">🤔 {workshop.question}</p>
              <div className="space-y-2">
                {workshop.options.map((opt, i) => (
                  <button
                    key={i}
                    disabled={!!result}
                    onClick={() => setChosen(i)}
                    className={cn(
                      'w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors',
                      result && i === workshop.correctIndex && 'border-green-500 bg-green-50 dark:bg-green-950/50',
                      result && i === chosen && i !== workshop.correctIndex && 'border-red-500 bg-red-50 dark:bg-red-950/50',
                      !result && chosen === i && 'border-primary bg-primary/10',
                      !result && chosen !== i && 'hover:bg-accent'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {result ? (
              <div className={cn(
                'rounded-lg p-3 text-sm',
                result.correct ? 'bg-green-50 dark:bg-green-950/50' : 'bg-red-50 dark:bg-red-950/50'
              )}>
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  {result.correct
                    ? <><CheckCircle2 className="h-4 w-4 text-green-500" /> {t('答对了！', 'Correct!')}</>
                    : <><XCircle className="h-4 w-4 text-red-500" /> {t('还需努力', 'Not quite')}</>}
                </div>
                <p className="text-muted-foreground">{result.feedback}</p>
                <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
                  <ReactMarkdown>{workshop.explanation}</ReactMarkdown>
                </div>
                <Button className="mt-3 w-full" onClick={onClose}>
                  {result.correct ? t('完成，清除该错误计数', 'Done — clear this error count') : t('我明白了', 'Got it')}
                </Button>
              </div>
            ) : (
              <Button className="w-full" disabled={chosen === null} onClick={submit}>{t('提交答案', 'Submit')}</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
