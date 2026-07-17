import React, { useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { useCelebrationStore } from '@/stores/useCelebrationStore'
import { useT } from '@/lib/i18n'

const SPARK_COLORS = ['bg-amber-400', 'bg-sky-400', 'bg-emerald-400', 'bg-rose-400', 'bg-violet-400']
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  color: SPARK_COLORS[i % SPARK_COLORS.length],
  left: `${(i * 7 + 8) % 92}%`,
  delay: `${(i % 5) * 90}ms`,
  duration: `${900 + (i % 4) * 220}ms`
}))

export function CelebrationOverlay(): JSX.Element | null {
  const { t } = useT()
  const current = useCelebrationStore(s => s.current)
  const dismiss = useCelebrationStore(s => s.dismiss)

  useEffect(() => {
    if (!current) return
    const timer = setTimeout(dismiss, 3200)
    return () => clearTimeout(timer)
  }, [current, dismiss])

  if (!current) return null

  const percent = current.totalCount > 0 ? Math.round((current.masteredCount / current.totalCount) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in"
      onClick={dismiss}
      role="button"
      tabIndex={0}
      aria-label={t('关闭', 'Dismiss')}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className={`absolute top-1/3 h-2 w-2 rounded-full ${s.color} animate-in fade-in slide-in-from-top-4`}
            style={{ left: s.left, animationDelay: s.delay, animationDuration: s.duration }}
          />
        ))}
      </div>

      <div className="relative text-center px-8 animate-in zoom-in-95 fade-in duration-300">
        <Trophy className="h-16 w-16 mx-auto text-amber-500" />
        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t('节点已点亮', 'Node mastered')}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{current.nodeName}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            `这门学科已掌握 ${current.masteredCount}/${current.totalCount}（${percent}%）`,
            `${current.masteredCount}/${current.totalCount} of this subject mastered (${percent}%)`
          )}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/70">{t('点击任意处继续', 'Click anywhere to continue')}</p>
      </div>
    </div>
  )
}
