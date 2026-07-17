import { create } from 'zustand'

export interface Celebration {
  nodeId: string
  nodeName: string
  masteredCount: number
  totalCount: number
}

interface CelebrationStore {
  current: Celebration | null
  celebrate: (celebration: Celebration) => void
  dismiss: () => void
}

export const useCelebrationStore = create<CelebrationStore>((set) => ({
  current: null,
  celebrate: (celebration) => set({ current: celebration }),
  dismiss: () => set({ current: null })
}))
