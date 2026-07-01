import React, { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { formatDate } from '@/lib/utils'
import { useTreeStore } from '@/stores/useTreeStore'

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

interface ErrorLogProps {
  onReviewNode: (nodeId: string) => void
}

export function ErrorLog({ onReviewNode }: ErrorLogProps): JSX.Element {
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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          错误记录
        </h3>
        <Button size="sm" variant="ghost" onClick={loadErrors}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {errors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <div className="text-3xl mb-2">✅</div>
          <p>暂无错误记录</p>
          <p className="text-xs mt-1">完成追问后，AI 会自动记录你的错误</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {errors.map(err => (
              <div key={err.id} className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {(err as ErrorEntry & { node_name?: string }).node_name || err.node_id}
                      </span>
                      <Badge
                        className={`text-xs border-0 ${ERROR_TYPE_COLORS[err.error_type] || 'bg-muted text-muted-foreground'}`}
                      >
                        {err.error_type}
                      </Badge>
                    </div>
                    {err.error_content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{err.error_content}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(err.created_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => handleReview(err.node_id)}>
                    复习
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
