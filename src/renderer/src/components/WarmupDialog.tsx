import React, { useEffect, useState, useCallback } from 'react'
import { Brain, Loader2, Timer, Zap, Trophy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { useT } from '@/lib/i18n'
import {
  WARMUP_SECONDS,
  nextCombo,
  pointsFor,
  comboMultiplier,
  summarizeWarmup,
  warmupGrade
} from '@/lib/warmup'

interface WarmupQuestion {
  question: string
  options: string[]
  correctIndex: number
  nodeName: string
}

interface WarmupDialogProps {
  open: boolean
  onClose: () => void
}

export function WarmupDialog({ open, onClose }: WarmupDialogProps): JSX.Element {
  const { t, isZh } = useT()
  const [questions, setQuestions] = useState<WarmupQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [index, setIndex] = useState(0)
  const [combo, setCombo] = useState(0)
  const [score, setScore] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(WARMUP_SECONDS)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setQuestions([])
    setIndex(0)
    setCombo(0)
    setScore(0)
    setResults([])
    setPicked(null)
    setSecondsLeft(WARMUP_SECONDS)
    setFinished(false)
    window.api.warmup.generate()
      .then(qs => setQuestions(qs as WarmupQuestion[]))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open || loading || finished || questions.length === 0) return
    if (secondsLeft <= 0) {
      setFinished(true)
      return
    }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [open, loading, finished, questions.length, secondsLeft])

  useEffect(() => {
    if (finished && results.length > 0) {
      window.api.warmup.complete()
    }
  }, [finished, results.length])

  const answer = useCallback((choice: number) => {
    if (picked !== null) return
    const current = questions[index]
    const correct = choice === current.correctIndex
    const newCombo = nextCombo(combo, correct)
    setPicked(choice)
    setCombo(newCombo)
    setResults(r => [...r, correct])
    if (correct) setScore(s => s + pointsFor(newCombo))

    setTimeout(() => {
      setPicked(null)
      if (index + 1 >= questions.length) setFinished(true)
      else setIndex(i => i + 1)
    }, 650)
  }, [picked, questions, index, combo])

  const summary = summarizeWarmup(results)
  const current = questions[index]

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t('60 秒脑力热身', '60-Second Warm-Up')}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-3">{t('正在出题...', 'Writing your questions...')}</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {t('还没有学过的知识点可供热身，先去学一个节点吧。', 'Nothing studied yet to warm up on — learn a node first.')}
            </p>
          </div>
        ) : finished ? (
          <div className="py-6 text-center space-y-4">
            <Trophy className="h-12 w-12 mx-auto text-amber-500" />
            <div>
              <p className="text-3xl font-bold">{summary.score}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('得分', 'Score')}</p>
            </div>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="font-semibold">{summary.correct}/{summary.total}</p>
                <p className="text-xs text-muted-foreground">{t('答对', 'Correct')}</p>
              </div>
              <div>
                <p className="font-semibold">×{summary.bestCombo}</p>
                <p className="text-xs text-muted-foreground">{t('最高连击', 'Best combo')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{warmupGrade(summary, isZh)}</p>
            <Button onClick={onClose}>{t('完成', 'Done')}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {secondsLeft}s
              </span>
              <span className="text-muted-foreground">{index + 1} / {questions.length}</span>
              <span className="flex items-center gap-1 font-medium text-primary">
                <Zap className="h-3.5 w-3.5" />
                {t(`${score} 分`, `${score} pts`)}
                {combo >= 2 && (
                  <span className="ml-1 text-orange-500">{t(`${combo} 连击 ×${comboMultiplier(combo)}`, `${combo} combo ×${comboMultiplier(combo)}`)}</span>
                )}
              </span>
            </div>

            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsLeft / WARMUP_SECONDS) * 100}%` }}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">{current.nodeName}</p>
              <p className="text-base font-medium">{current.question}</p>
            </div>

            <div className="space-y-2">
              {current.options.map((opt, i) => {
                const isCorrect = i === current.correctIndex
                const state =
                  picked === null
                    ? 'idle'
                    : isCorrect
                      ? 'correct'
                      : picked === i
                        ? 'wrong'
                        : 'idle'
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={picked !== null}
                    className={`w-full text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                      state === 'correct'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : state === 'wrong'
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950'
                          : 'hover:bg-accent'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
