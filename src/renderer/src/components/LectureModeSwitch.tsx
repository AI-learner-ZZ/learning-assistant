import React from 'react'
import { Lightbulb, Sigma, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export type LectureStyle = 'intuitive' | 'formula' | 'analogy'

const MODES: { key: LectureStyle; label: [string, string]; icon: typeof Lightbulb }[] = [
  { key: 'intuitive', label: ['直觉版', 'Intuitive'], icon: Lightbulb },
  { key: 'formula', label: ['公式版', 'Formula'], icon: Sigma },
  { key: 'analogy', label: ['类比版', 'Analogy'], icon: Sparkles }
]

interface LectureModeSwitchProps {
  value: LectureStyle
  onChange: (style: LectureStyle) => void
  disabled?: boolean
}

export function LectureModeSwitch({ value, onChange, disabled }: LectureModeSwitchProps): JSX.Element {
  const { t } = useT()
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
      {MODES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          disabled={disabled}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50',
            value === key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={t(`用${label[0]}方式讲解`, `Explain in ${label[1].toLowerCase()} style`)}
        >
          <Icon className="h-3.5 w-3.5" />
          {t(label[0], label[1])}
        </button>
      ))}
    </div>
  )
}
