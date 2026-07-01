import React, { useEffect, useState } from 'react'
import { Sprout, Loader2, ArrowRight, BookOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { cn } from '@/lib/utils'

interface TemplateMeta {
  file: string
  id: string
  name: string
  description: string
  nodeCount: number
}

interface KnowledgeSeedProps {
  onCreated: () => void

  overlay?: boolean
}

export function KnowledgeSeed({ onCreated, overlay }: KnowledgeSeedProps): JSX.Element {
  const { settings } = useSettingsStore()
  const isZh = settings.language === 'zh'
  const t = (zh: string, en: string): string => (isZh ? zh : en)

  const [domain, setDomain] = useState('')
  const [generating, setGenerating] = useState(false)
  const [templates, setTemplates] = useState<TemplateMeta[]>([])

  useEffect(() => {
    window.api.templates.list().then(list => setTemplates(list as TemplateMeta[]))
  }, [])

  const createFromDomain = async (): Promise<void> => {
    if (!domain.trim() || generating) return
    setGenerating(true)
    try {
      await window.api.subjects.createFromDomain(domain.trim())
      onCreated()
    } finally {
      setGenerating(false)
    }
  }

  const loadTemplate = async (file: string): Promise<void> => {
    setGenerating(true)
    try {
      await window.api.templates.load(file)
      onCreated()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={cn(
      'fixed inset-0 flex items-center justify-center p-8 overflow-y-auto',
      overlay
        ? 'bg-background/80 backdrop-blur-xl'
        : 'bg-gradient-to-br from-background to-accent/20'
    )}>
      <div className={cn(
        'w-full max-w-2xl text-center',
        overlay && 'bg-card/90 border rounded-2xl shadow-2xl p-8'
      )}>
        <Sprout className="h-14 w-14 text-primary mx-auto mb-5" />
        <h1 className="text-3xl font-bold mb-3">
          {t('你想在哪个领域，达到大学毕业生水平？', 'In which field do you want to reach a graduate level?')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {t('输入一个学科，我会为你生成一棵专属知识树 — 你可以随时拖动、删除、和它谈判。',
            'Enter a subject and I will generate a personalized knowledge tree — you can drag, delete, and negotiate with it anytime.')}
        </p>

        {generating ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('正在为你规划知识树骨架...', 'Planning your knowledge tree skeleton...')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 max-w-lg mx-auto mb-8">
              <Input
                autoFocus
                className="h-12 text-base"
                placeholder={t('例如：人工智能、营养学、心理学...', 'e.g. Artificial Intelligence, Nutrition, Psychology...')}
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFromDomain() }}
              />
              <Button className="h-12 px-5 gap-1" disabled={!domain.trim()} onClick={createFromDomain}>
                {t('生成', 'Generate')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {templates.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">{t('或从预置学科快速开始：', 'Or quick-start from a preset subject:')}</p>
                <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                  {templates.map(tpl => (
                    <button
                      key={tpl.file}
                      onClick={() => loadTemplate(tpl.file)}
                      className="flex items-start gap-2 text-left border rounded-lg p-3 hover:bg-accent hover:border-primary/50 transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tpl.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
