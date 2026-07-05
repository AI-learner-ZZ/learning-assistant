import React, { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '@/lib/utils'
import { GUIDES } from '@/lib/tutorials'
import { useT } from '@/lib/i18n'

interface TutorialDialogProps {
  open: boolean
  onClose: () => void
}

export function TutorialDialog({ open, onClose }: TutorialDialogProps): JSX.Element {
  const { t, isZh } = useT()
  const idx = isZh ? 0 : 1
  const [current, setCurrent] = useState(0)
  const guide = GUIDES[current]

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {t('新手引导', 'Onboarding Guides')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 gap-3 min-h-0">
          <div className="w-40 shrink-0 border-r pr-2 overflow-y-auto">
            {GUIDES.map((g, i) => (
              <button
                key={g.key}
                onClick={() => setCurrent(i)}
                className={cn(
                  'w-full text-left text-sm px-3 py-2 rounded-md transition-colors',
                  i === current ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                {g.name[idx]}
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-3">
              {guide.tips.map((tip, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-semibold">{i + 1}</span>
                    <span className="text-sm font-semibold">{tip.title[idx]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-7">{tip.body[idx]}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
