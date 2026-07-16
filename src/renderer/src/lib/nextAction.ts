import type { TreeNode } from '@/stores/useTreeStore'

export interface DueReview {
  node_id: string
  name: string
  risk: number
}

export type NextAction =
  | { kind: 'review'; nodeId: string; nodeName: string; risk: number }
  | { kind: 'continue'; nodeId: string; nodeName: string }
  | { kind: 'start'; nodeId: string; nodeName: string }
  | { kind: 'done' }
  | { kind: 'none' }

export function pickNextAction(nodes: TreeNode[], dueReviews: DueReview[]): NextAction {
  if (nodes.length === 0) return { kind: 'none' }

  if (dueReviews.length > 0) {
    const top = [...dueReviews].sort((a, b) => b.risk - a.risk)[0]
    return { kind: 'review', nodeId: top.node_id, nodeName: top.name, risk: top.risk }
  }

  const learning = nodes.find(n => n.status === 'learning')
  if (learning) return { kind: 'continue', nodeId: learning.id, nodeName: learning.name }

  const byId = new Map(nodes.map(n => [n.id, n]))
  const unlocked = nodes.filter(n => n.status === 'unlocked')
  const ready = unlocked.find(n => !n.parent_id || byId.get(n.parent_id)?.status === 'mastered')
  const pick = ready ?? unlocked[0]
  if (pick) return { kind: 'start', nodeId: pick.id, nodeName: pick.name }

  return { kind: 'done' }
}
