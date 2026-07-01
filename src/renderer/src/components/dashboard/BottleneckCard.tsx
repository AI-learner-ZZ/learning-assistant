import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { LifeBuoy, Loader2, FileText, Copy, Download, Check } from 'lucide-react'
import { Button } from '../ui/button'

interface Bottleneck {
  nodeId: string
  nodeName: string
  errorCount: number
  spanDays: number
}

export function BottleneckCard({ bottlenecks }: { bottlenecks: Bottleneck[] }): JSX.Element {
  const [report, setReport] = useState<string | null>(null)
  const [reportNode, setReportNode] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  if (bottlenecks.length === 0) return <></>

  const genReport = async (b: Bottleneck): Promise<void> => {
    setLoading(true); setReportNode(b.nodeName)
    try {
      const r = await window.api.bottleneck.report(b.nodeId) as string
      setReport(r)
    } finally {
      setLoading(false)
    }
  }

  const copy = (): void => {
    if (report) {
      navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="border-2 border-rose-200 dark:border-rose-900 rounded-xl p-4 bg-rose-50/40 dark:bg-rose-950/20">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
        <LifeBuoy className="h-4 w-4" />
        卡点提醒（建议寻求外部帮助）
      </h4>
      <p className="text-xs text-muted-foreground mb-3">以下节点你已多次受阻、跨度超过一周，AI 可生成一份"卡点报告"方便你请教他人。</p>
      <div className="space-y-2">
        {bottlenecks.map(b => (
          <div key={b.nodeId} className="flex items-center justify-between gap-2 border rounded-lg p-2 bg-card">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{b.nodeName}</p>
              <p className="text-xs text-muted-foreground">失败 {b.errorCount} 次 · 跨度 {b.spanDays} 天</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs h-7" disabled={loading} onClick={() => genReport(b)}>
              {loading && reportNode === b.nodeName ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              生成报告
            </Button>
          </div>
        ))}
      </div>

      {report && (
        <div className="mt-3 border rounded-lg p-3 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">卡点报告 — {reportNode}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={copy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}复制
              </Button>
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => window.api.bottleneck.export(report)}>
                <Download className="h-3 w-3" />导出
              </Button>
            </div>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-60 overflow-y-auto">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
