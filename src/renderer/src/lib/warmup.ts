export const BASE_POINTS = 10
export const WARMUP_SECONDS = 60
export const MAX_MULTIPLIER = 3

export interface WarmupResult {
  score: number
  correct: number
  total: number
  bestCombo: number
}

export function nextCombo(combo: number, correct: boolean): number {
  return correct ? combo + 1 : 0
}

export function comboMultiplier(combo: number): number {
  if (combo <= 0) return 1
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor((combo - 1) / 3))
}

export function pointsFor(comboAfterCorrect: number): number {
  return BASE_POINTS * comboMultiplier(comboAfterCorrect)
}

export function summarizeWarmup(results: boolean[]): WarmupResult {
  let combo = 0
  let bestCombo = 0
  let score = 0
  let correct = 0

  for (const ok of results) {
    combo = nextCombo(combo, ok)
    if (ok) {
      correct += 1
      score += pointsFor(combo)
      bestCombo = Math.max(bestCombo, combo)
    }
  }

  return { score, correct, total: results.length, bestCombo }
}

export function warmupGrade(result: WarmupResult, isZh: boolean): string {
  if (result.total === 0) return isZh ? '这次没有作答' : 'Nothing answered this time'
  const ratio = result.correct / result.total
  if (ratio === 1) return isZh ? '全对！记忆非常牢固 🏆' : 'Perfect — rock-solid recall 🏆'
  if (ratio >= 0.7) return isZh ? '很稳，继续保持 💪' : 'Solid — keep it up 💪'
  if (ratio >= 0.4) return isZh ? '有点生疏了，值得复习一轮 📚' : 'A bit rusty — worth a review round 📚'
  return isZh ? '这些知识点该好好复习了 🔄' : 'These topics need a proper review 🔄'
}
