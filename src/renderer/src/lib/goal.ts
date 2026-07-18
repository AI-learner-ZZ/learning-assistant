export interface GoalProgress {
  percent: number
  remaining: number
}

export function goalProgress(mastered: number, total: number): GoalProgress {
  if (total <= 0) return { percent: 0, remaining: 0 }
  const m = Math.max(0, Math.min(mastered, total))
  return { percent: Math.round((m / total) * 100), remaining: total - m }
}

export function goalMessage(percent: number, isZh: boolean): string {
  if (percent >= 100) return isZh ? '目标达成，去检验一下所学吧！' : 'Goal reached — go put it to the test!'
  if (percent >= 66) return isZh ? '目标在望，稳住节奏 💪' : 'Your goal is within reach — hold the pace 💪'
  if (percent >= 33) return isZh ? '已经过半，继续推进。' : 'Past the midpoint — keep pushing.'
  if (percent > 0) return isZh ? '已经上路，一步一个节点。' : "You're on your way — one node at a time."
  return isZh ? '刚起步，明确的目标会让每一步都更有意义。' : 'Just starting — a clear goal makes every step matter.'
}
