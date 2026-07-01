import { create } from 'zustand'

interface Settings {
  language: 'zh' | 'en'
  theme: 'light' | 'dark'
  apiProvider: string
  apiBaseUrl: string
  dataDir: string
  setupComplete: boolean
}

interface SettingsStore {
  settings: Settings
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSetting: (key: keyof Settings, value: string | boolean) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    language: 'zh',
    theme: 'light',
    apiProvider: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    dataDir: '',
    setupComplete: false
  },
  loaded: false,

  loadSettings: async () => {
    const s = await window.api.settings.getAll()
    set({ settings: s as Settings, loaded: true })

    if (s.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  updateSetting: (key, value) => {
    set(state => ({ settings: { ...state.settings, [key]: value } }))
    if (key === 'theme') {
      if (value === 'dark') document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
    }
  }
}))
