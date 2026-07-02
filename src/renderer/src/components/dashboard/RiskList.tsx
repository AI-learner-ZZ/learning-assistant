import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { useT } from '@/lib/i18n'

export interface NodeRisk {
  node_id: string
  name: string
  risk: number
  daysUntilDue: number
  lastReviewedAt: string | null
}

interface RiskListProps {
  risks: NodeRisk[]
  onReview: (nodeId: string) => void
}

function riskColor(risk: number): string {
  if (risk >= 0.7) return 'text-red-600 dark:text-red-400'
  if (risk >= 0.4) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

export function RiskList({ risks, onReview }: RiskListProps): JSX.Element {
  const { t } = useT()
  return (
    <div className="border rounded-xl p-4 bg-card">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {t('遗忘风险区（未来3天）', 'Forgetting Risk (next 3 days)')}
      </h4>
      {risks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{t('暂无高风险节点 — 完成几节学习后这里会显示需要复习的内容。', 'No high-risk nodes yet — finish a few sessions and items to review will appear here.')}</p>
      ) : (
        <div className="space-y-2">
          {risks.map(r => (
            <div key={r.node_id} className="flex items-center justify-between gap-2 border rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className={`text-xs ${riskColor(r.risk)}`}>
                  {t('遗忘风险', 'Risk')} {Math.round(r.risk * 100)}%
                  {r.daysUntilDue < 0
                    ? t(` · 已逾期 ${Math.abs(Math.round(r.daysUntilDue))} 天`, ` · ${Math.abs(Math.round(r.daysUntilDue))}d overdue`)
                    : t(` · ${Math.round(r.daysUntilDue)} 天后到期`, ` · due in ${Math.round(r.daysUntilDue)}d`)}
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs h-7" onClick={() => onReview(r.node_id)}>
                <RotateCcw className="h-3 w-3" /> {t('立即复习', 'Review')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
