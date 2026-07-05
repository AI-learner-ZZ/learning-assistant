import React, { useState, useEffect } from 'react'
import { GraduationCap, X, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { useTutorialStore } from '@/stores/useTutorialStore'
import { GUIDE_MAP } from '@/lib/tutorials'
import { useT } from '@/lib/i18n'

export function CoachCard(): JSX.Element | null {
  const { t, isZh } = useT()
  const active = useTutorialStore(s => s.active)
  const dismiss = useTutorialStore(s => s.dismiss)
  const [step, setStep] = useState(0)

  useEffect(() => { setStep(0) }, [active])

  if (!active) return null
  const guide = GUIDE_MAP[active]
  if (!guide || guide.tips.length === 0) return null

  const tip = guide.tips[step]
  const isLast = step >= guide.tips.length - 1
  const idx = isZh ? 0 : 1

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-80 rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <GraduationCap className="h-4 w-4" />
          {guide.name[idx]}
        </span>
        <button className="text-muted-foreground hover:text-foreground" onClick={() => dismiss(active)} title={t('跳过', 'Skip')}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 pb-2 pt-2">
        <p className="text-sm font-semibold mb-1">{tip.title[idx]}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{tip.body[idx]}</p>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <div className="flex gap-1">
          {guide.tips.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />
          ))}
        </div>
        <div className="flex gap-1.5">
          {!isLast && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => dismiss(active)}>
              {t('跳过', 'Skip')}
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => (isLast ? dismiss(active) : setStep(s => s + 1))}
          >
            {isLast ? t('知道了', 'Got it') : t('下一条', 'Next')}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
