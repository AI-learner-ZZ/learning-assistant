import React, { useEffect, useState } from 'react'
import { Loader2, BookMarked, ExternalLink, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { useT } from '@/lib/i18n'

interface ResourceItem { title: string; url: string; source: string; why: string }
interface FindResult { configured: boolean; items: ResourceItem[]; suggestion: string; error?: string }

interface NodeResourcesProps {
  open: boolean
  nodeName: string
  onClose: () => void
}

export function NodeResources({ open, nodeName, onClose }: NodeResourcesProps): JSX.Element {
  const { t } = useT()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FindResult | null>(null)

  useEffect(() => {
    if (open && nodeName) {
      setData(null)
      setLoading(true)
      window.api.resources.find(nodeName)
        .then(r => setData(r as FindResult))
        .finally(() => setLoading(false))
    }
  }, [open, nodeName])

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-emerald-500" />
            {t('学习资源', 'Learning Resources')} — {nodeName}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">{t('正在查找资源...', 'Finding resources...')}</p>
          </div>
        )}

        {!loading && data && data.configured && data.items.length > 0 && (
          <div className="space-y-2">
            {data.items.map((r, i) => (
              <button
                key={i}
                onClick={() => window.api.data.openExternal(r.url)}
                className="w-full text-left border rounded-lg p-3 hover:bg-accent hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium line-clamp-1">{r.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{r.why}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{r.source} · {r.url}</p>
              </button>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1">{t('链接来自真实搜索结果，点击用系统浏览器打开。', 'Links come from real search results; click to open in your browser.')}</p>
          </div>
        )}

        {!loading && data && data.configured && data.items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('没有找到合适的资源，换个说法再试试。', 'No good resources found — try rephrasing.')}</p>
        )}

        {!loading && data && !data.configured && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3 text-sm">
              <Search className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{t('未开启联网搜索，无法给出真实链接。可在「设置 → 联网搜索」配置后获取可点击资源。以下是搜索建议：', 'Web search is off, so no real links. Configure it in Settings → Web Search for clickable resources. Suggested searches:')}</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{data.suggestion}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
