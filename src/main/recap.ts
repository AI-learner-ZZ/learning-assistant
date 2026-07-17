export interface RecapStats {
  masteredNames: string[]
  sessions: number
  minutes: number
  accuracy: number
  streakCount: number
}

export interface Recap {
  title: string
  lines: string[]
  empty: boolean
}

export const RECAP_INTERVAL_DAYS = 7

export function shouldShowRecap(lastShownDate: string | null, today: string, stats: RecapStats): boolean {
  if (stats.sessions === 0 && stats.masteredNames.length === 0) return false
  if (!lastShownDate) return true
  const a = Date.parse(`${lastShownDate}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return (b - a) / (24 * 60 * 60 * 1000) >= RECAP_INTERVAL_DAYS
}

export function buildWeeklyRecap(stats: RecapStats, language: string): Recap {
  const isZh = language === 'zh'
  const lines: string[] = []

  if (stats.masteredNames.length > 0) {
    const shown = stats.masteredNames.slice(0, 3).join(isZh ? '、' : ', ')
    const more = stats.masteredNames.length - Math.min(3, stats.masteredNames.length)
    lines.push(
      isZh
        ? `点亮了 ${stats.masteredNames.length} 个新节点：${shown}${more > 0 ? ` 等 ${more} 个` : ''}`
        : `Lit up ${stats.masteredNames.length} new node${stats.masteredNames.length > 1 ? 's' : ''}: ${shown}${more > 0 ? ` and ${more} more` : ''}`
    )
  }

  if (stats.sessions > 0) {
    lines.push(
      isZh
        ? `完成 ${stats.sessions} 次学习，累计 ${stats.minutes} 分钟`
        : `${stats.sessions} session${stats.sessions > 1 ? 's' : ''}, ${stats.minutes} minute${stats.minutes === 1 ? '' : 's'} in total`
    )
    lines.push(
      isZh
        ? `平均正确率 ${Math.round(stats.accuracy * 100)}%`
        : `${Math.round(stats.accuracy * 100)}% average accuracy`
    )
  }

  if (stats.streakCount > 1) {
    lines.push(
      isZh
        ? `连续学习 ${stats.streakCount} 天，别停下 🔥`
        : `${stats.streakCount}-day streak — keep it rolling 🔥`
    )
  }

  return {
    title: isZh ? '你这周走了多远' : 'How far you came this week',
    lines,
    empty: lines.length === 0
  }
}
