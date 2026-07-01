import React from 'react'
import { Clock } from 'lucide-react'

interface HourAccuracy { hour: number; accuracy: number; count: number }

export function BestTimeCard({ data }: { data: HourAccuracy[] }): JSX.Element {
  const withData = data.filter(d => d.count > 0)
  const best = withData.length ? withData.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)) : null
  const avg = withData.length ? withData.reduce((s, d) => s + d.accuracy, 0) / withData.length : 0

  return (
    <div className="border rounded-xl p-4 bg-card">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-indigo-500" />
        最佳学习时段
      </h4>
      {!best ? (
        <p className="text-xs text-muted-foreground py-4 text-center">学习记录积累后，这里会分析你正确率最高的时段。</p>
      ) : (
        <div className="text-sm">
          <p>
            你在 <span className="font-semibold text-indigo-600 dark:text-indigo-400">{best.hour}:00–{best.hour + 1}:00</span> 的正确率最高，
            达 <span className="font-semibold">{Math.round(best.accuracy * 100)}%</span>
            {avg > 0 && best.accuracy > avg && (
              <>，比平均高 <span className="font-semibold">{Math.round((best.accuracy - avg) * 100)}%</span></>
            )}。
          </p>
          <p className="text-xs text-muted-foreground mt-1">建议把核心新学安排在这个时段。</p>
        </div>
      )}
    </div>
  )
}
