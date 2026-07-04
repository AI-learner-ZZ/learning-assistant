import React, { useState, useCallback } from 'react'
import { Loader2, BookOpen, Upload, HelpCircle, MessageSquareText } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { useT } from '@/lib/i18n'

interface ReadingPaneProps {
  open: boolean
  onClose: () => void
  onAsk: (prompt: string) => void
}

export function ReadingPane({ open, onClose, onAsk }: ReadingPaneProps): JSX.Element {
  const { t } = useT()
  const [text, setText] = useState('')
  const [pasted, setPasted] = useState('')
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState('')

  const loadFile = useCallback(async () => {
    setLoading(true)
    try {
      const filePath = await window.api.file.choose()
      if (!filePath) return
      const { text: parsed, filename: fn } = await window.api.file.parse(filePath) as { text: string; filename: string }
      setText(parsed); setFilename(fn)
    } finally {
      setLoading(false)
    }
  }, [])

  const captureSelection = (): void => {
    const s = window.getSelection()?.toString().trim() || ''
    setSelection(s)
  }

  const ask = (kind: 'explain' | 'quiz'): void => {
    const passage = selection || text.slice(0, 1200)
    if (!passage) return
    const prompt = kind === 'explain'
      ? t(`请结合我正在读的这段材料，讲解其中的核心概念（用直觉先讲清楚）：\n\n"""\n${passage}\n"""`,
          `Explain the core concept in this passage I'm reading (intuition first):\n\n"""\n${passage}\n"""`)
      : t(`基于我正在读的这段材料出 2 道题考我，考完再点评：\n\n"""\n${passage}\n"""`,
          `Quiz me with 2 questions based on this passage, then critique my answers:\n\n"""\n${passage}\n"""`)
    onAsk(prompt)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl h-[82vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-500" />
            {t('阅读模式', 'Reading Mode')}
            {filename && <span className="text-xs font-normal text-muted-foreground">— {filename}</span>}
          </DialogTitle>
        </DialogHeader>

        {!text ? (
          <div className="flex-1 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t('上传教材（PDF/DOCX/TXT）或直接粘贴一段文字，然后选中任意片段让导师讲解或考你。', 'Upload a document (PDF/DOCX/TXT) or paste text, then select any passage to have the tutor explain or quiz you.')}</p>
            <Button variant="outline" className="gap-2 self-start" onClick={loadFile} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('上传文件', 'Upload file')}
            </Button>
            <Textarea
              className="flex-1 min-h-[240px]"
              placeholder={t('或在此粘贴教材文字...', 'Or paste your material here...')}
              value={pasted}
              onChange={e => setPasted(e.target.value)}
            />
            <Button className="self-end" disabled={!pasted.trim()} onClick={() => setText(pasted)}>{t('开始阅读', 'Start reading')}</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap select-text"
                onMouseUp={captureSelection}
              >
                {text}
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground flex-1">
                {selection
                  ? t(`已选中 ${selection.length} 字`, `${selection.length} chars selected`)
                  : t('选中一段文字，或直接对全文操作', 'Select a passage, or act on the whole text')}
              </span>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => ask('explain')}>
                <MessageSquareText className="h-3.5 w-3.5" /> {t('讲解这段', 'Explain this')}
              </Button>
              <Button size="sm" className="gap-1" onClick={() => ask('quiz')}>
                <HelpCircle className="h-3.5 w-3.5" /> {t('就这段考我', 'Quiz me')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
