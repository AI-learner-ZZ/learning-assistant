export const CONQUER_THRESHOLD = 3

export type ConquerLevel = 'clear' | 'working' | 'ready'

export interface ConquerProgress {
  level: ConquerLevel
  percent: number
  label: string
  hint: string
}

export function conquerProgress(count: number, isZh: boolean, threshold = CONQUER_THRESHOLD): ConquerProgress {
  const safeCount = Math.max(0, count)

  if (safeCount === 0) {
    return {
      level: 'clear',
      percent: 0,
      label: isZh ? '已攻克' : 'Cleared',
      hint: isZh ? '这个概念目前没有待办的疑点。' : 'Nothing outstanding on this concept.'
    }
  }

  if (safeCount < threshold) {
    return {
      level: 'working',
      percent: Math.round((safeCount / threshold) * 100),
      label: isZh ? '攻克中' : 'Working on it',
      hint: isZh
        ? `再遇到 ${threshold - safeCount} 次，就能解锁对比练习来彻底拿下它。`
        : `${threshold - safeCount} more and you'll unlock a contrast drill to nail it.`
    }
  }

  return {
    level: 'ready',
    percent: 100,
    label: isZh ? '可以升级了' : 'Ready to level up',
    hint: isZh
      ? '这个概念已经攒够素材，来一场对比练习升级它。'
      : "You've gathered enough on this one — run a contrast drill to level it up."
  }
}

export function conquerHeadline(activeCount: number, isZh: boolean): string {
  if (activeCount === 0) {
    return isZh ? '目前没有正在攻克的概念 🎉' : 'Nothing to conquer right now 🎉'
  }
  return isZh ? `正在攻克 ${activeCount} 个概念` : `Conquering ${activeCount} concept${activeCount > 1 ? 's' : ''}`
}
