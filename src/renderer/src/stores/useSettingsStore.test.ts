import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './useSettingsStore'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: 'zh', theme: 'light' } }))
})

describe('updateSetting', () => {
  it('updates a plain setting value', () => {
    useSettingsStore.getState().updateSetting('language', 'en')
    expect(useSettingsStore.getState().settings.language).toBe('en')
  })

  it('adds the dark class when switching to the dark theme', () => {
    useSettingsStore.getState().updateSetting('theme', 'dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class when switching back to light', () => {
    useSettingsStore.getState().updateSetting('theme', 'dark')
    useSettingsStore.getState().updateSetting('theme', 'light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
