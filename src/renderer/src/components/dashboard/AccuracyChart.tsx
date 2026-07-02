import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useT } from '@/lib/i18n'

interface AccuracyPoint {
  day: string
  accuracy: number
  count: number
}

export function AccuracyChart({ data }: { data: AccuracyPoint[] }): JSX.Element {
  const { t } = useT()
  const chartData = data.map(d => ({
    day: d.day.slice(5),
    accuracy: Math.round(d.accuracy * 100),
    count: d.count
  }))

  return (
    <div className="border rounded-xl p-4 bg-card">
      <h4 className="text-sm font-medium mb-3">{t('近7天正确率', 'Accuracy (last 7 days)')}</h4>
      {chartData.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">{t('还没有学习记录 — 完成学习节点后这里会绘制你的正确率曲线。', 'No learning records yet — your accuracy curve will appear here after you finish some sessions.')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
              formatter={(v) => [`${v}%`, t('正确率', 'Accuracy')]}
            />
            <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
