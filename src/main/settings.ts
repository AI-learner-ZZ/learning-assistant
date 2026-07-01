import { safeStorage, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getPref, setPref } from './database'

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.enc')
}

export function saveApiKey(key: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key)
    fs.writeFileSync(getConfigPath(), encrypted)
  } else {

    fs.writeFileSync(getConfigPath(), Buffer.from(key).toString('base64'))
    setPref('api_key_fallback', '1')
  }
}

export function getApiKey(): string | null {
  if (!fs.existsSync(getConfigPath())) return null
  try {
    const data = fs.readFileSync(getConfigPath())
    if (safeStorage.isEncryptionAvailable() && getPref('api_key_fallback') !== '1') {
      return safeStorage.decryptString(data)
    }
    return Buffer.from(data.toString(), 'base64').toString()
  } catch {
    return null
  }
}

export function clearApiKey(): void {
  if (fs.existsSync(getConfigPath())) fs.unlinkSync(getConfigPath())
}

export interface AppSettings {
  language: 'zh' | 'en'
  theme: 'light' | 'dark'
  apiProvider: string
  apiBaseUrl: string
  dataDir: string
  setupComplete: boolean
}

function getDefaults(): AppSettings {
  return {
    language: 'zh',
    theme: 'light',
    apiProvider: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    dataDir: path.join(app.getPath('userData'), 'data'),
    setupComplete: false
  }
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const val = getPref(key)
  if (val === null) return getDefaults()[key]
  if (key === 'setupComplete') return (val === 'true') as AppSettings[K]
  return val as AppSettings[K]
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  setPref(key, String(value))
}

export function getAllSettings(): AppSettings {
  return {
    language: getSetting('language'),
    theme: getSetting('theme'),
    apiProvider: getSetting('apiProvider'),
    apiBaseUrl: getSetting('apiBaseUrl'),
    dataDir: getSetting('dataDir'),
    setupComplete: getSetting('setupComplete')
  }
}

export function isSetupComplete(): boolean {
  return getSetting('setupComplete') && getApiKey() !== null
}
