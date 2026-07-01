import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface CoverageData {
  total: number
  mastered: number
  learning: number
  percent: number
}

export function KnowledgeCoverage({ data }: { data: CoverageData }): JSX.Element {
  const unlearned = Math.max(0, data.total - data.mastered - data.learning)
  const chartData = [
    { name: '已掌握', value: data.mastered, color: '#22c55e' },
    { name: '学习中', value: data.learning, color: '#3b82f6' },
    { name: '未点亮', value: unlearned, color: '#e2e8f0' }
  ].filter(d => d.value > 0)

  return (
    <div className="border rounded-xl p-4 bg-card">
      <h4 className="text-sm font-medium mb-2">知识覆盖度</h4>
      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.length ? chartData : [{ name: 'empty', value: 1, color: '#e2e8f0' }]}
              dataKey="value"
              innerRadius={50}
              outerRadius={70}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
            >
              {(chartData.length ? chartData : [{ name: 'empty', value: 1, color: '#e2e8f0' }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold">{data.percent}%</span>
          <span className="text-xs text-muted-foreground">{data.mastered}/{data.total} 已掌握</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />已掌握</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />学习中</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200" />未点亮</span>
      </div>
    </div>
  )
}
