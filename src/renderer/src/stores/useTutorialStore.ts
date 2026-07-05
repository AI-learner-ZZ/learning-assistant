import { create } from 'zustand'

const KEY = 'tutorial-seen'

function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

interface TutorialStore {
  seen: string[]
  active: string | null
  isSeen: (key: string) => boolean
  request: (key: string) => void
  dismiss: (key: string) => void
  setActive: (key: string | null) => void
  replay: () => void
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  seen: loadSeen(),
  active: null,

  isSeen: (key) => get().seen.includes(key),

  request: (key) => {
    if (get().active || get().seen.includes(key)) return
    set({ active: key })
  },

  dismiss: (key) => {
    const seen = get().seen.includes(key) ? get().seen : [...get().seen, key]
    localStorage.setItem(KEY, JSON.stringify(seen))
    set({ seen, active: get().active === key ? null : get().active })
  },

  setActive: (key) => set({ active: key }),

  replay: () => {
    localStorage.setItem(KEY, '[]')
    set({ seen: [], active: 'welcome' })
  }
}))
