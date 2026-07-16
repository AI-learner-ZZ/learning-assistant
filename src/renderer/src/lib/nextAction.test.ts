import { describe, it, expect } from 'vitest'
import { pickNextAction, type DueReview } from './nextAction'
import type { TreeNode } from '@/stores/useTreeStore'

function node(id: string, status: TreeNode['status'], parent_id: string | null = null): TreeNode {
  return {
    id,
    subject_id: 's',
    parent_id,
    name: `Node ${id}`,
    description: null,
    status,
    progress: 0,
    sort_order: 0,
    estimated_minutes: 0,
    created_at: '',
    updated_at: ''
  }
}

describe('pickNextAction', () => {
  it('returns none for an empty tree', () => {
    expect(pickNextAction([], [])).toEqual({ kind: 'none' })
  })

  it('prioritises the highest-risk due review', () => {
    const due: DueReview[] = [
      { node_id: 'a', name: 'A', risk: 0.4 },
      { node_id: 'b', name: 'B', risk: 0.9 }
    ]
    const action = pickNextAction([node('a', 'mastered'), node('b', 'mastered')], due)
    expect(action).toEqual({ kind: 'review', nodeId: 'b', nodeName: 'B', risk: 0.9 })
  })

  it('continues an in-progress node when nothing is due', () => {
    const action = pickNextAction([node('a', 'mastered'), node('b', 'learning')], [])
    expect(action).toMatchObject({ kind: 'continue', nodeId: 'b' })
  })

  it('starts the first unlocked node whose parent is mastered', () => {
    const nodes = [
      node('root', 'mastered'),
      node('child', 'unlocked', 'root'),
      node('locked', 'unlocked', 'notmastered')
    ]
    const action = pickNextAction(nodes, [])
    expect(action).toMatchObject({ kind: 'start', nodeId: 'child' })
  })

  it('falls back to the first unlocked node when none have a mastered parent', () => {
    const nodes = [node('p', 'learning'), node('c', 'unlocked', 'p')]
    const action = pickNextAction(nodes, [])
    expect(action).toMatchObject({ kind: 'continue', nodeId: 'p' })
  })

  it('reports done when every node is mastered', () => {
    expect(pickNextAction([node('a', 'mastered'), node('b', 'mastered')], [])).toEqual({ kind: 'done' })
  })
})
