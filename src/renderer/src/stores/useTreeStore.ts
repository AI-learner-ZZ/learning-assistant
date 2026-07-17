import { create } from 'zustand'
import { useCelebrationStore } from './useCelebrationStore'

export interface Subject {
  id: string
  name: string
  description: string | null
  is_primary: number
  created_at: string
}

export interface TreeNode {
  id: string
  subject_id: string
  parent_id: string | null
  name: string
  description: string | null
  status: 'unlocked' | 'learning' | 'mastered' | 'skipped'
  progress: number
  sort_order: number
  estimated_minutes: number
  created_at: string
  updated_at: string
}

interface TreeStore {
  subjects: Subject[]
  nodes: TreeNode[]
  currentSubjectId: string | null
  selectedNodeId: string | null

  loadSubjects: () => Promise<void>
  loadNodes: (subjectId: string) => Promise<void>
  selectSubject: (id: string) => Promise<void>
  selectNode: (id: string | null) => void
  markNodeLearning: (id: string) => void
  updateNodeStatus: (id: string, status: string, progress?: number) => Promise<void>
  getLearnedNodeNames: () => string[]
  getUnlearnedNodeNames: () => string[]
  hasSubjects: () => Promise<boolean>
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  subjects: [],
  nodes: [],
  currentSubjectId: null,
  selectedNodeId: null,

  loadSubjects: async () => {
    const subjects = await window.api.subjects.getAll() as Subject[]
    set({ subjects })
    if (subjects.length === 0) return

    const activeId = await window.api.subjects.getActive() as string | null
    const active = subjects.find(s => s.id === activeId) || subjects.find(s => s.is_primary) || subjects[0]
    if (active) {
      await get().selectSubject(active.id)
    }
  },

  hasSubjects: async () => {
    const count = await window.api.subjects.count() as number
    return count > 0
  },

  loadNodes: async (subjectId: string) => {
    const nodes = await window.api.tree.getNodes(subjectId) as TreeNode[]
    set({ nodes })
  },

  selectSubject: async (id: string) => {
    set({ currentSubjectId: id, selectedNodeId: null })
    window.api.subjects.setActive(id)
    await get().loadNodes(id)
  },

  selectNode: (id) => {

    set({ selectedNodeId: id })
  },

  markNodeLearning: (id) => {
    const node = get().nodes.find(n => n.id === id)
    if (node && node.status === 'unlocked') {
      get().updateNodeStatus(id, 'learning')
    }
  },

  updateNodeStatus: async (id, status, progress) => {
    const prev = get().nodes.find(n => n.id === id)
    await window.api.tree.updateStatus(id, status, progress)
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === id ? { ...n, status: status as TreeNode['status'], progress: progress ?? n.progress } : n
      )
    }))
    if (status === 'mastered' && prev && prev.status !== 'mastered') {
      const nodes = get().nodes
      useCelebrationStore.getState().celebrate({
        nodeId: id,
        nodeName: prev.name,
        masteredCount: nodes.filter(n => n.status === 'mastered').length,
        totalCount: nodes.length
      })
    }
  },

  getLearnedNodeNames: () => {
    return get().nodes.filter(n => n.status === 'mastered').map(n => n.name)
  },

  getUnlearnedNodeNames: () => {
    return get().nodes.filter(n => n.status !== 'mastered' && n.status !== 'skipped').map(n => n.name)
  }
}))
