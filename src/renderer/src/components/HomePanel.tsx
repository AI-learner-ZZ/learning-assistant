import React, { useEffect, useState } from 'react'
import { Flame, Play, RotateCcw, Sparkles, Trophy, CalendarDays, Loader2, Brain, PartyPopper } from 'lucide-react'
import { Button } from './ui/button'
import { WarmupDialog } from './WarmupDialog'
import { useTreeStore } from '@/stores/useTreeStore'
import { useT } from '@/lib/i18n'
import { pickNextAction, type DueReview, type NextAction } from '@/lib/nextAction'

interface StreakView {
  count: number
  longest: number
  active: boolean
  atRisk: boolean
  broken: boolean
}

interface RecapPayload {
  due: boolean
  recap: { title: string; lines: string[]; empty: boolean }
}

interface HomePanelProps {
  onOpenNode: (nodeId: string) => void
  onGoDaily: () => void
  onOpenProject: () => void
}

export function HomePanel({ onOpenNode, onGoDaily, onOpenProject }: HomePanelProps): JSX.Element {
  const { t, isZh } = useT()
  const nodes = useTreeStore(s => s.nodes)
  const [streak, setStreak] = useState<StreakView | null>(null)
  const [due, setDue] = useState<DueReview[]>([])
  const [recap, setRecap] = useState<RecapPayload | null>(null)
  const [recapDismissed, setRecapDismissed] = useState(false)
  const [warmupOpen, setWarmupOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const [s, risks, r] = await Promise.all([
        window.api.streak.get() as Promise<StreakView>,
        window.api.dashboard.risks() as Promise<DueReview[]>,
        window.api.recap.get() as Promise<RecapPayload>
      ])
      if (!alive) return
      setStreak(s)
      setDue(risks)
      setRecap(r)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [nodes])

  const dismissRecap = (): void => {
    window.api.recap.markShown()
    setRecapDismissed(true)
  }

  const action = pickNextAction(nodes, due)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (recap && recap.due && !recap.recap.empty && !recapDismissed) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-8 text-center">
        <PartyPopper className="h-12 w-12 text-primary" />
        <h2 className="text-xl font-semibold">{recap.recap.title}</h2>
        <ul className="space-y-2 text-sm text-muted-foreground max-w-sm">
          {recap.recap.lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-left">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={dismissRecap}>{t('收下，继续学习', 'Nice — keep learning')}</Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-8 text-center">
      {streak && streak.count > 0 && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-2xl font-bold text-orange-500">
            <Flame className="h-6 w-6" />
            {t(`连续学习 ${streak.count} 天`, `${streak.count}-day streak`)}
          </div>
          {streak.atRisk
            ? <p className="text-xs text-muted-foreground">{t('今天学一点，就能延续 🔥', 'Study a little today to keep it going 🔥')}</p>
            : streak.active
              ? <p className="text-xs text-muted-foreground">{t('今天已打卡，做得好！', "You've shown up today — nice!")}</p>
              : null}
        </div>
      )}

      <ActionCard action={action} isZh={isZh} onOpenNode={onOpenNode} onOpenProject={onOpenProject} />

      <div className="flex items-center gap-4">
        <button
          onClick={() => setWarmupOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Brain className="h-3.5 w-3.5" />
          {t('60 秒热身', '60s warm-up')}
        </button>
        <button
          onClick={onGoDaily}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {t('查看今日课表', "View today's plan")}
        </button>
      </div>

      <WarmupDialog open={warmupOpen} onClose={() => setWarmupOpen(false)} />
    </div>
  )
}

function ActionCard({
  action,
  isZh,
  onOpenNode,
  onOpenProject
}: {
  action: NextAction
  isZh: boolean
  onOpenNode: (nodeId: string) => void
  onOpenProject: () => void
}): JSX.Element {
  const t = (zh: string, en: string): string => (isZh ? zh : en)

  if (action.kind === 'none') {
    return (
      <div className="max-w-sm">
        <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t('从左侧选一个知识节点开始学习吧。', 'Pick a knowledge node on the left to start learning.')}</p>
      </div>
    )
  }

  if (action.kind === 'done') {
    return (
      <div className="max-w-sm space-y-4">
        <Trophy className="h-12 w-12 mx-auto text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold">{t('这门学科你都掌握了！', "You've mastered this whole subject!")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('用一个项目来检验和运用所学吧。', 'Put it to work with a capstone project.')}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={onOpenProject}>
          <Sparkles className="h-4 w-4" />
          {t('打开项目工坊', 'Open Project Workshop')}
        </Button>
      </div>
    )
  }

  const meta = {
    review: {
      icon: <RotateCcw className="h-12 w-12 mx-auto text-sky-500" />,
      tag: t('复习', 'Review'),
      hint: t('这个知识点接近遗忘，趁热巩固一下。', 'This topic is close to being forgotten — reinforce it now.'),
      cta: t('开始复习', 'Start review')
    },
    continue: {
      icon: <Play className="h-12 w-12 mx-auto text-primary" />,
      tag: t('继续', 'Continue'),
      hint: t('上次还没学完，接着来。', 'You left this one in progress — pick up where you stopped.'),
      cta: t('继续学习', 'Continue learning')
    },
    start: {
      icon: <Sparkles className="h-12 w-12 mx-auto text-primary" />,
      tag: t('新节点', 'Next up'),
      hint: t('这是你接下来最该学的节点。', 'This is the best node to learn next.'),
      cta: t('开始学习', 'Start learning')
    }
  }[action.kind]

  return (
    <div className="max-w-sm space-y-4">
      {meta.icon}
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{meta.tag}</span>
        <h2 className="text-xl font-semibold mt-1">{action.nodeName}</h2>
        <p className="text-sm text-muted-foreground mt-1">{meta.hint}</p>
      </div>
      <Button size="lg" className="gap-2" onClick={() => onOpenNode(action.nodeId)}>
        <Play className="h-4 w-4" />
        {meta.cta}
      </Button>
    </div>
  )
}
