export interface NudgeInput {
  dueCount: number
  streakCount: number
  streakAtRisk: boolean
  alreadyNudgedToday: boolean
  language: string
}

export interface Nudge {
  title: string
  body: string
}

export function buildDailyNudge(input: NudgeInput): Nudge | null {
  if (input.alreadyNudgedToday) return null
  const isZh = input.language === 'zh'

  if (input.dueCount > 0) {
    return {
      title: isZh ? '该复习啦 📚' : 'Time to review 📚',
      body: isZh
        ? `有 ${input.dueCount} 个知识点接近遗忘，花几分钟巩固一下？`
        : `${input.dueCount} topic${input.dueCount > 1 ? 's are' : ' is'} close to being forgotten — spend a few minutes?`
    }
  }

  if (input.streakAtRisk && input.streakCount > 0) {
    return {
      title: isZh ? '别断了连续学习 🔥' : 'Keep your streak alive 🔥',
      body: isZh
        ? `你已连续学习 ${input.streakCount} 天，今天学一点就能延续。`
        : `You're on a ${input.streakCount}-day streak — a little study today keeps it going.`
    }
  }

  return null
}
