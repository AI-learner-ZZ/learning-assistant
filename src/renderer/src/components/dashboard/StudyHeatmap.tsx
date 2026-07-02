import React from 'react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

interface HeatPoint { weekday: number; hour: number; count: number }

export function StudyHeatmap({ data }: { data: HeatPoint[] }): JSX.Element {
  const { t, isZh } = useT()
  const WEEKDAYS = isZh ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const max = Math.max(1, ...data.map(d => d.count))
  const lookup = new Map<string, number>()
  for (const d of data) lookup.set(`${d.weekday}-${d.hour}`, d.count)

  const buckets = [0, 3, 6, 9, 12, 15, 18, 21]
  const bucketLabel = (h: number): string => `${h}-${h + 3}`

  const intensity = (count: number): string => {
    if (count === 0) return 'bg-muted'
    const r = count / max
    if (r > 0.66) return 'bg-primary'
    if (r > 0.33) return 'bg-primary/60'
    return 'bg-primary/30'
  }

  return (
    <div className="border rounded-xl p-4 bg-card">
      <h4 className="text-sm font-medium mb-3">{t('学习时长分布（热力图）', 'Study-time Heatmap')}</h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">{t('还没有学习记录。', 'No learning records yet.')}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block">
            <div className="flex gap-1 mb-1 ml-6">
              {buckets.map(h => (
                <div key={h} className="w-7 text-[9px] text-muted-foreground text-center">{bucketLabel(h)}</div>
              ))}
            </div>
            {WEEKDAYS.map((wd, weekday) => (
              <div key={weekday} className="flex gap-1 items-center mb-1">
                <div className="w-5 text-[10px] text-muted-foreground text-center">{wd}</div>
                {buckets.map(startH => {
                  const count = [0, 1, 2].reduce((s, off) => s + (lookup.get(`${weekday}-${startH + off}`) ?? 0), 0)
                  return (
                    <div
                      key={startH}
                      className={cn('w-7 h-5 rounded-sm', intensity(count))}
                      title={isZh ? `周${wd} ${bucketLabel(startH)}点：${count} 次` : `${wd} ${bucketLabel(startH)}h: ${count}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
