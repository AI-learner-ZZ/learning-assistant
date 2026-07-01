import { create } from 'zustand'
import { today } from '@/lib/utils'

export interface DailyTask {
  id: string
  task_type: 'core' | 'review' | 'explore'
  node_id: string | null
  title: string
  description: string | null
  estimated_minutes: number
  status: 'pending' | 'done'
  feedback: string | null
  task_date: string
}

interface DailyStore {
  tasks: DailyTask[]
  loading: boolean

  loadTasks: () => Promise<void>
  generateTasks: (context: {
    currentNodeId: string | null
    currentNodeName: string | null
    unlearnedNodes: string[]
    learnedNodes: string[]
  }) => Promise<void>
  updateTask: (id: string, status: 'done', feedback?: string) => Promise<void>
  sendFeedback: (id: string, feedback: 'too_hard' | 'too_easy' | 'not_interested') => Promise<void>
}

export const useDailyStore = create<DailyStore>((set) => ({
  tasks: [],
  loading: false,

  loadTasks: async () => {
    const tasks = await window.api.daily.getTasks(today()) as DailyTask[]
    set({ tasks })
  },

  generateTasks: async (context) => {
    set({ loading: true })
    try {
      const tasks = await window.api.daily.generate(context) as DailyTask[]
      set({ tasks })
    } finally {
      set({ loading: false })
    }
  },

  updateTask: async (id, status, feedback) => {
    await window.api.daily.updateTask(id, status, feedback)
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, status, feedback: feedback || null } : t)
    }))
  },

  sendFeedback: async (id, feedback) => {
    await window.api.daily.feedback(id, feedback)
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, feedback } : t)
    }))
  }
}))
