import { randomUUID } from 'crypto'
import { getPref, setPref, getTodayTasks, saveTodayTasks, updateTaskStatus, type DailyTask } from './database'
import { getHighRiskNodes } from './spacedRepetition'
import { generateDailyTasks } from './aiService'

const DIFFICULTY_KEY = 'difficulty_level'
const MIN_DIFFICULTY = -3
const MAX_DIFFICULTY = 3

export function getDifficultyLevel(): number {
  const raw = getPref(DIFFICULTY_KEY)
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) ? n : 0
}

function setDifficultyLevel(n: number): void {
  const clamped = Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, n))
  setPref(DIFFICULTY_KEY, String(clamped))
}

export function difficultyDescriptor(level: number, isZh: boolean): string {
  if (level <= -2) return isZh ? '非常基础、循序渐进，多用类比，避免术语堆砌' : 'very basic, gradual, use analogies, avoid jargon'
  if (level === -1) return isZh ? '稍微简单一些，多给例子' : 'slightly easier, more examples'
  if (level === 0) return isZh ? '标准难度' : 'standard difficulty'
  if (level === 1) return isZh ? '稍有挑战，可引入进阶概念' : 'slightly challenging, introduce advanced concepts'
  return isZh ? '高挑战，深入推导与边界情况，鼓励独立思考' : 'high challenge, deep derivations and edge cases'
}

export function applyTaskFeedback(taskId: string, feedback: 'too_hard' | 'too_easy' | 'not_interested'): void {
  updateTaskStatus(taskId, 'pending', feedback)
  const current = getDifficultyLevel()
  if (feedback === 'too_hard') setDifficultyLevel(current - 1)
  else if (feedback === 'too_easy') setDifficultyLevel(current + 1)

}

export interface PlanContext {
  currentNodeId: string | null
  currentNodeName: string | null
  unlearnedNodes: string[]
  learnedNodes: string[]
  language: string
}

export async function generatePlan(ctx: PlanContext): Promise<DailyTask[]> {
  const today = new Date().toISOString().slice(0, 10)
  const existing = getTodayTasks(today)
  if (existing.length > 0) return existing

  const isZh = ctx.language === 'zh'
  const difficulty = difficultyDescriptor(getDifficultyLevel(), isZh)

  const aiTasks = await generateDailyTasks({
    currentNodeId: ctx.currentNodeId,
    currentNodeName: ctx.currentNodeName,
    unlearnedNodes: ctx.unlearnedNodes,
    learnedNodes: ctx.learnedNodes,
    language: ctx.language,
    difficulty
  })

  const toSave: Omit<DailyTask, 'status' | 'feedback'>[] = aiTasks.map(t => ({
    id: randomUUID(),
    task_type: t.type,
    node_id: t.nodeId ?? null,
    title: t.title,
    description: t.description,
    estimated_minutes: t.minutes,
    task_date: today
  }))

  const highRisk = getHighRiskNodes(2, 3)
  if (highRisk.length > 0) {

    const withoutReview = toSave.filter(t => t.task_type !== 'review')
    const reviewTasks: Omit<DailyTask, 'status' | 'feedback'>[] = highRisk.map(r => ({
      id: randomUUID(),
      task_type: 'review' as const,
      node_id: r.node_id,
      title: isZh ? `快速复习：${r.name}` : `Review: ${r.name}`,
      description: isZh
        ? `遗忘风险 ${Math.round(r.risk * 100)}%，建议立即复习巩固。`
        : `Forgetting risk ${Math.round(r.risk * 100)}%. Review now to consolidate.`,
      estimated_minutes: 10,
      task_date: today
    }))
    toSave.length = 0
    toSave.push(...withoutReview, ...reviewTasks)
  }

  saveTodayTasks(toSave)
  return getTodayTasks(today)
}
