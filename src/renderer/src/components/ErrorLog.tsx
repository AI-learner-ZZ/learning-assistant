import React, { useEffect, useState } from 'react'
import { Target, RefreshCw, Swords } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { formatDate } from '@/lib/utils'
import { useTreeStore } from '@/stores/useTreeStore'
import { useT } from '@/lib/i18n'
import { conquerProgress, conquerHeadline } from '@/lib/conquer'

interface ErrorEntry {
  id: string
  node_id: string
  node_name?: string
  error_type: string
  error_content: string | null
  created_at: string
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  '概念混淆': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  '计算错误': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  '应用偏差': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'ConceptConfusion': 'bg-yellow-100 text-yellow-800',
  'CalculationError': 'bg-red-100 text-red-800',
  'ApplicationError': 'bg-orange-100 text-orange-800'
}

const ERROR_TYPE_EN: Record<string, string> = {
  '概念混淆': 'Concept confusion',
  '计算错误': 'Calculation error',
  '应用偏差': 'Application error',
  '无': 'None',
  'ConceptConfusion': 'Concept confusion',
  'CalculationError': 'Calculation error',
  'ApplicationError': 'Application error'
}

const NONE_TYPES = ['无', 'None', '']

interface ErrorLogProps {
  onReviewNode: (nodeId: string) => void
}

export function ErrorLog({ onReviewNode }: ErrorLogProps): JSX.Element {
  const { t, isZh } = useT()
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const { selectNode } = useTreeStore()

  const loadErrors = async (): Promise<void> => {
    const data = await window.api.errors.getAll() as ErrorEntry[]
    setErrors(data)
  }

  useEffect(() => {
    loadErrors()
  }, [])

  const handleReview = (nodeId: string): void => {
    selectNode(nodeId)
    onReviewNode(nodeId)
  }

  const active = errors.filter(e => !NONE_TYPES.includes(e.error_type))
  const typeCounts = new Map<string, number>()
  for (const e of active) typeCounts.set(e.error_type, (typeCounts.get(e.error_type) ?? 0) + 1)

  const typeLabel = (type: string): string => (isZh ? type : ERROR_TYPE_EN[type] || type)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center gap-1.5">
          <Swords className="h-4 w-4 text-primary" />
          {t('正在攻克', 'Leveling Up')}
        </h3>
        <Button size="sm" variant="ghost" onClick={loadErrors}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <div className="text-3xl mb-2">🎉</div>
          <p>{t('目前没有正在攻克的概念', 'Nothing to conquer right now')}</p>
          <p className="text-xs mt-1">
            {t('每次答错都会变成这里的一个升级目标 —— 犯错是进步的原料。', 'Every slip becomes a target here — mistakes are the raw material of progress.')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">{conquerHeadline(typeCounts.size, isZh)}</p>

          <div className="space-y-2 mb-4">
            {Array.from(typeCounts.entries()).map(([type, count]) => {
              const progress = conquerProgress(count, isZh)
              return (
                <div key={type} className="border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium">{typeLabel(type)}</span>
                    <Badge className={`text-xs border-0 ${progress.level === 'ready' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {progress.label}
                    </Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress.level === 'ready' ? 'bg-primary' : 'bg-primary/50'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{progress.hint}</p>
                </div>
              )
            })}
          </div>

          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            {t('攻克目标', 'Targets')}
          </p>

          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {active.map(err => (
                <div key={err.id} className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-xs font-medium text-foreground">
                          {err.node_name || err.node_id}
                        </span>
                        <Badge className={`text-xs border-0 ${ERROR_TYPE_COLORS[err.error_type] || 'bg-muted text-muted-foreground'}`}>
                          {typeLabel(err.error_type)}
                        </Badge>
                      </div>
                      {err.error_content && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{err.error_content}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(err.created_at)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => handleReview(err.node_id)}>
                      {t('攻克它', 'Level it up')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}
