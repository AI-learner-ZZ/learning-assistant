import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Loader2, Hammer, Gavel } from 'lucide-react'
import { Button } from './ui/button'
import { KnowledgeCoverage } from './dashboard/KnowledgeCoverage'
import { RiskList, NodeRisk } from './dashboard/RiskList'
import { AccuracyChart } from './dashboard/AccuracyChart'
import { StudyHeatmap } from './dashboard/StudyHeatmap'
import { BestTimeCard } from './dashboard/BestTimeCard'
import { BottleneckCard } from './dashboard/BottleneckCard'
import { useT } from '@/lib/i18n'

interface CoverageData { total: number; mastered: number; learning: number; percent: number }
interface AccuracyPoint { day: string; accuracy: number; count: number }
interface HeatPoint { weekday: number; hour: number; count: number }
interface HourAccuracy { hour: number; accuracy: number; count: number }
interface Bottleneck { nodeId: string; nodeName: string; errorCount: number; spanDays: number }

interface DashboardProps {
  onReviewNode: (nodeId: string) => void
  onOpenProject: () => void
  onOpenDefense: () => void
}

export function Dashboard({ onReviewNode, onOpenProject, onOpenDefense }: DashboardProps): JSX.Element {
  const { t } = useT()
  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [risks, setRisks] = useState<NodeRisk[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyPoint[]>([])
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([])
  const [bestTime, setBestTime] = useState<HourAccuracy[]>([])
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cov, rsk, acc, heat, best, bn] = await Promise.all([
        window.api.dashboard.coverage(),
        window.api.dashboard.risks(),
        window.api.dashboard.accuracy(7),
        window.api.dashboard.heatmap(),
        window.api.dashboard.bestTime(),
        window.api.bottleneck.check()
      ])
      setCoverage(cov as CoverageData)
      setRisks(rsk as NodeRisk[])
      setAccuracy(acc as AccuracyPoint[])
      setHeatmap(heat as HeatPoint[])
      setBestTime(best as HourAccuracy[])
      setBottlenecks(bn as Bottleneck[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{t('学习健康仪表盘', 'Learning Health Dashboard')}</h3>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-1.5 justify-start" onClick={onOpenProject}>
          <Hammer className="h-4 w-4 text-orange-500" /> {t('项目工坊', 'Projects')}
        </Button>
        <Button variant="outline" className="gap-1.5 justify-start" onClick={onOpenDefense}>
          <Gavel className="h-4 w-4 text-purple-500" /> {t('模拟答辩', 'Defense')}
        </Button>
      </div>

      {bottlenecks.length > 0 && <BottleneckCard bottlenecks={bottlenecks} />}
      {coverage && <KnowledgeCoverage data={coverage} />}
      <RiskList risks={risks} onReview={onReviewNode} />
      <AccuracyChart data={accuracy} />
      <BestTimeCard data={bestTime} />
      <StudyHeatmap data={heatmap} />
    </div>
  )
}
