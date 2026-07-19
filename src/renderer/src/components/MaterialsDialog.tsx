import React, { useEffect, useState, useCallback } from 'react'
import { Library, Sparkles, ExternalLink, Upload, FileText, Trash2, Loader2, Check, DownloadCloud, Wand2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { useT } from '@/lib/i18n'

interface MaterialSuggestion {
  title: string
  url: string
  why: string
  kind: string
}

interface SourceRow {
  id: string
  kind: string
  title: string
  status: string
  chunk_count: number
  token_estimate: number
}

interface MaterialsDialogProps {
  open: boolean
  subjectId: string | null
  subjectName: string
  onClose: () => void
  onTreeRegenerated?: () => void
}

export function MaterialsDialog({ open, subjectId, subjectName, onClose, onTreeRegenerated }: MaterialsDialogProps): JSX.Element {
  const { t } = useT()
  const [suggestions, setSuggestions] = useState<MaterialSuggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [importing, setImporting] = useState(false)
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [autoFetch, setAutoFetch] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const loadSources = useCallback(async () => {
    if (!subjectId) return
    const rows = await window.api.rag.list(subjectId) as SourceRow[]
    setSources(rows)
  }, [subjectId])

  useEffect(() => {
    if (open) {
      loadSources()
      setSuggestions([])
      setPasteTitle('')
      setPasteText('')
      window.api.rag.autoFetchEnabled().then(v => setAutoFetch(!!v))
    }
  }, [open, loadSources])

  const fetchUrl = async (url: string): Promise<void> => {
    if (!subjectId) return
    setFetchingUrl(url)
    try {
      const res = await window.api.material.fetch({ subjectId, url }) as { enabled: boolean; error?: string }
      if (res.enabled && !res.error) await loadSources()
    } finally {
      setFetchingUrl(null)
    }
  }

  const regenerateTree = async (): Promise<void> => {
    if (!subjectId) return
    const ok = confirm(t('将根据当前材料重新生成这门学科的知识树，已有的节点与进度会被替换。确定继续吗？', 'This will rebuild the knowledge tree for this subject from your current materials, replacing existing nodes and progress. Continue?'))
    if (!ok) return
    setRegenerating(true)
    try {
      const res = await window.api.rag.treeFromMaterials(subjectId) as { success: boolean }
      if (res.success) {
        onTreeRegenerated?.()
        onClose()
      }
    } finally {
      setRegenerating(false)
    }
  }

  const suggest = async (): Promise<void> => {
    setSuggesting(true)
    try {
      const list = await window.api.material.suggest(subjectName) as MaterialSuggestion[]
      setSuggestions(list)
    } finally {
      setSuggesting(false)
    }
  }

  const ingest = async (kind: string, title: string, origin: string | null, text: string): Promise<void> => {
    if (!subjectId || !text.trim()) return
    setImporting(true)
    try {
      await window.api.rag.ingest({ subjectId, kind, title, origin, text })
      await loadSources()
    } finally {
      setImporting(false)
    }
  }

  const importFile = async (): Promise<void> => {
    const filePath = await window.api.file.choose() as string | null
    if (!filePath) return
    const parsed = await window.api.file.parse(filePath) as { text: string; filename: string }
    const ext = parsed.filename.split('.').pop()?.toLowerCase() || 'txt'
    await ingest(ext, parsed.filename, parsed.filename, parsed.text)
  }

  const importPaste = async (): Promise<void> => {
    const title = pasteTitle.trim() || t('粘贴的材料', 'Pasted material')
    await ingest('paste', title, null, pasteText)
    setPasteTitle('')
    setPasteText('')
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            {t('教材库', 'Materials')} · {subjectName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-5">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('第一步：让 AI 推荐材料', 'Step 1 — Let AI recommend materials')}</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={suggest} disabled={suggesting}>
                  {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t('推荐材料', 'Suggest')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('点开每个链接，把网页/PDF 保存到本地，再用下方"导入"喂给学习助手。', 'Open each link, save the page/PDF locally, then feed it in via Import below.')}
              </p>
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm font-medium truncate">{s.title}</span>
                            <Badge className="text-xs border-0 bg-muted text-muted-foreground">{s.kind}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.why}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs"
                            onClick={() => window.api.data.openExternal(s.url)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t('打开', 'Open')}
                          </Button>
                          {autoFetch && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              disabled={fetchingUrl === s.url}
                              onClick={() => fetchUrl(s.url)}
                            >
                              {fetchingUrl === s.url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
                              {t('抓取', 'Fetch')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!autoFetch && suggestions.length > 0 && (
                <p className="text-xs text-muted-foreground/70">{t('提示：在设置里开启"专家模式 → 自动抓取"，即可让程序直接抓取正文，无需手动保存。', 'Tip: enable "Expert Mode → automatic fetching" in Settings to pull the body text directly, without saving files manually.')}</p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">{t('第二步：导入材料', 'Step 2 — Import materials')}</p>
              <Button variant="outline" className="w-full gap-2" onClick={importFile} disabled={importing || !subjectId}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('选择文件导入（PDF / DOCX / TXT）', 'Import a file (PDF / DOCX / TXT)')}
              </Button>
              <div className="space-y-1.5">
                <Input
                  value={pasteTitle}
                  onChange={e => setPasteTitle(e.target.value)}
                  placeholder={t('材料标题（可选）', 'Material title (optional)')}
                />
                <Textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={4}
                  placeholder={t('或直接粘贴文本内容...', 'Or paste text content directly...')}
                />
                <Button variant="outline" className="w-full gap-2" onClick={importPaste} disabled={importing || !pasteText.trim() || !subjectId}>
                  <FileText className="h-4 w-4" />
                  {t('导入粘贴的文本', 'Import pasted text')}
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">{t('已导入的材料', 'Imported materials')}</p>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('还没有材料。导入后，学习对话会引用它们来讲解。', 'No materials yet. Once imported, the learning chat grounds its answers in them.')}</p>
              ) : (
                <div className="space-y-2">
                  {sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 border rounded-lg p-2.5">
                      <div className="min-w-0 flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.kind} · {t(`${s.chunk_count} 个片段`, `${s.chunk_count} chunks`)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => { await window.api.rag.delete(s.id); loadSources() }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {sources.length > 0 && (
                <Button variant="outline" className="w-full gap-2 mt-1" onClick={regenerateTree} disabled={regenerating}>
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {t('根据材料生成知识树', 'Build knowledge tree from materials')}
                </Button>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
