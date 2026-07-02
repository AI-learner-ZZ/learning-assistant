import { useSettingsStore } from '@/stores/useSettingsStore'

export function useT(): { t: (zh: string, en: string) => string; isZh: boolean } {
  const language = useSettingsStore(s => s.settings.language)
  const isZh = language === 'zh'
  return { t: (zh, en) => (isZh ? zh : en), isZh }
}
