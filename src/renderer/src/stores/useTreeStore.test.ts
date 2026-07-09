import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTreeStore, type TreeNode } from './useTreeStore'

function node(id: string, status: TreeNode['status']): TreeNode {
  return {
    id,
    subject_id: 's',
    parent_id: null,
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

const updateStatus = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { api: unknown }).api = { tree: { updateStatus } }
  useTreeStore.setState({ subjects: [], nodes: [], currentSubjectId: null, selectedNodeId: null })
})

describe('selectNode', () => {
  it('sets and clears the selected node', () => {
    useTreeStore.getState().selectNode('a')
    expect(useTreeStore.getState().selectedNodeId).toBe('a')
    useTreeStore.getState().selectNode(null)
    expect(useTreeStore.getState().selectedNodeId).toBeNull()
  })
})

describe('node name selectors', () => {
  beforeEach(() => {
    useTreeStore.setState({
      nodes: [node('a', 'mastered'), node('b', 'learning'), node('c', 'skipped'), node('d', 'unlocked')]
    })
  })

  it('returns only mastered node names as learned', () => {
    expect(useTreeStore.getState().getLearnedNodeNames()).toEqual(['Node a'])
  })

  it('excludes mastered and skipped nodes from unlearned', () => {
    expect(useTreeStore.getState().getUnlearnedNodeNames()).toEqual(['Node b', 'Node d'])
  })
})

describe('updateNodeStatus', () => {
  it('persists and updates local node state', async () => {
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    await useTreeStore.getState().updateNodeStatus('a', 'mastered', 100)
    expect(updateStatus).toHaveBeenCalledWith('a', 'mastered', 100)
    const updated = useTreeStore.getState().nodes[0]
    expect(updated.status).toBe('mastered')
    expect(updated.progress).toBe(100)
  })
})

describe('markNodeLearning', () => {
  it('promotes an unlocked node to learning', () => {
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    useTreeStore.getState().markNodeLearning('a')
    expect(updateStatus).toHaveBeenCalledWith('a', 'learning', undefined)
  })

  it('does nothing for a node that is not unlocked', () => {
    useTreeStore.setState({ nodes: [node('a', 'mastered')] })
    useTreeStore.getState().markNodeLearning('a')
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
