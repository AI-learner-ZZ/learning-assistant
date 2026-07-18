import React, { useEffect, useState } from 'react'
import { Target } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { useT } from '@/lib/i18n'

interface GoalDialogProps {
  open: boolean
  initialValue: string
  onClose: () => void
  onSave: (text: string) => void
}

const EXAMPLES: [string, string][] = [
  ['能独立搭一个推荐系统', 'Build a recommender system on my own'],
  ['看懂机器学习论文', 'Read machine-learning papers with confidence'],
  ['通过期末考试', 'Pass my final exam']
]

export function GoalDialog({ open, initialValue, onClose, onSave }: GoalDialogProps): JSX.Element {
  const { t, isZh } = useT()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const save = (): void => {
    onSave(value.trim())
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t('你的学习目标', 'Your learning goal')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('一句话说清你为什么学这门学科 —— 它会成为你的北极星，让每天的学习都指向它。', 'Say in one line why you are learning this subject — it becomes your North Star, giving every day a direction.')}
          </p>
          <Textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={3}
            placeholder={t('例如：能独立搭一个推荐系统', 'e.g. Build a recommender system on my own')}
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(([zh, en], i) => (
              <button
                key={i}
                onClick={() => setValue(isZh ? zh : en)}
                className="text-xs rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-accent transition-colors"
              >
                {isZh ? zh : en}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>{t('取消', 'Cancel')}</Button>
            <Button onClick={save} disabled={!value.trim()}>{t('设为目标', 'Set as goal')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
