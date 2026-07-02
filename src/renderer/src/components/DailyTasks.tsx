import React, { useEffect, useState } from 'react'
import { Clock, CheckCircle2, BookOpen, RefreshCw, Compass, Loader2, ThumbsDown, ThumbsUp, MehIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useDailyStore, DailyTask } from '@/stores/useDailyStore'
import { useTreeStore } from '@/stores/useTreeStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const TASK_CONFIG = {
  core: { icon: BookOpen, label: ['核心新学', 'Core'] as const, color: 'text-blue-500' },
  review: { icon: RefreshCw, label: ['快速复习', 'Review'] as const, color: 'text-green-500' },
  explore: { icon: Compass, label: ['拓展阅读', 'Explore'] as const, color: 'text-purple-500' }
}

interface TaskCardProps {
  task: DailyTask
  onStart: (task: DailyTask) => void
  onComplete: (id: string) => void
  onFeedback: (id: string, feedback: 'too_hard' | 'too_easy' | 'not_interested') => void
}

function TaskCard({ task, onStart, onComplete, onFeedback }: TaskCardProps): JSX.Element {
  const { t } = useT()
  const config = TASK_CONFIG[task.task_type]
  const Icon = config.icon
  const isDone = task.status === 'done'
  const [sentFeedback, setSentFeedback] = useState<string | null>(task.feedback ?? null)

  const handleFeedback = (fb: 'too_hard' | 'too_easy' | 'not_interested'): void => {
    setSentFeedback(fb)
    onFeedback(task.id, fb)
  }

  return (
    <div className={cn(
      'border rounded-xl p-4 transition-all',
      isDone ? 'opacity-60 bg-muted/30' : 'bg-card hover:shadow-sm'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('mt-0.5 shrink-0', config.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-xs', config.color)}>
                {t(config.label[0], config.label[1])}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimated_minutes}{t('分钟', 'min')}
              </span>
            </div>
            <p className="font-medium text-sm mt-1 line-clamp-1">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        ) : (
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onComplete(task.id)}>{t('完成', 'Done')}</Button>
            <Button size="sm" onClick={() => onStart(task)}>{t('开始', 'Start')}</Button>
          </div>
        )}
      </div>

      {!isDone && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t">
          <span className="text-xs text-muted-foreground mr-1">{t('反馈：', 'Feedback:')}</span>
          <button
            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
              sentFeedback === 'too_hard' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'hover:bg-accent text-muted-foreground')}
            onClick={() => handleFeedback('too_hard')}
          >
            <ThumbsDown className="h-3 w-3" /> {t('太难', 'Too hard')}
          </button>
          <button
            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
              sentFeedback === 'too_easy' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'hover:bg-accent text-muted-foreground')}
            onClick={() => handleFeedback('too_easy')}
          >
            <ThumbsUp className="h-3 w-3" /> {t('太简单', 'Too easy')}
          </button>
          <button
            className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
              sentFeedback === 'not_interested' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'hover:bg-accent text-muted-foreground')}
            onClick={() => handleFeedback('not_interested')}
          >
            <MehIcon className="h-3 w-3" /> {t('没兴趣', 'Not interested')}
          </button>
        </div>
      )}
    </div>
  )
}

interface DailyTasksProps {
  onTaskStart: (nodeId: string | null) => void
}

export function DailyTasks({ onTaskStart }: DailyTasksProps): JSX.Element {
  const { tasks, loading, loadTasks, generateTasks, updateTask, sendFeedback } = useDailyStore()
  const { nodes, selectedNodeId } = useTreeStore()
  const { t } = useT()

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleGenerate = async (): Promise<void> => {
    const selectedNode = nodes.find(n => n.id === selectedNodeId)
    const unlearnedNodes = nodes.filter(n => n.status !== 'mastered' && n.status !== 'skipped').map(n => n.name)
    const learnedNodes = nodes.filter(n => n.status === 'mastered').map(n => n.name)

    await generateTasks({
      currentNodeId: selectedNodeId,
      currentNodeName: selectedNode?.name || null,
      unlearnedNodes,
      learnedNodes
    })
  }

  const handleStart = (task: DailyTask): void => {
    onTaskStart(task.node_id)
  }

  const completedCount = tasks.filter(t => t.status === 'done').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">{t('今日学习', "Today's Tasks")}</h3>
          {tasks.length > 0 && (
            <p className="text-xs text-muted-foreground">{completedCount}/{tasks.length} {t('已完成', 'done')}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          <span className="ml-1">{tasks.length ? t('刷新', 'Refresh') : t('生成课表', 'Generate')}</span>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <div className="text-3xl mb-2">📋</div>
          <p>{t('点击"生成课表"获取今日学习计划', 'Click "Generate" to get today\'s study plan')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={handleStart}
              onComplete={id => updateTask(id, 'done')}
              onFeedback={sendFeedback}
            />
          ))}
        </div>
      )}
    </div>
  )
}
