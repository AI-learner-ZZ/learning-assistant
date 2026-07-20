import { app, BrowserWindow, Notification } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import { initDatabase, getPref, setPref } from './database'
import { getSetting } from './settings'
import { getStreak } from './streak'
import { getHighRiskNodes } from './spacedRepetition'
import { buildDailyNudge } from './nudge'
import { setLanController, lanPort } from './handlers/registry'
import { installIpcTransport } from './transports/ipc'
import { startHttpServer, stopHttpServer, isHttpRunning } from './transports/http'
import { hasCredentials } from './transports/auth'

let mainWindow: BrowserWindow | null = null

function maybeShowDailyNudge(): void {
  try {
    if (!Notification.isSupported()) return
    const today = new Date().toISOString().slice(0, 10)
    const streak = getStreak()
    const nudge = buildDailyNudge({
      dueCount: getHighRiskNodes(5, 3).length,
      streakCount: streak.count,
      streakAtRisk: streak.atRisk,
      alreadyNudgedToday: getPref('last_nudge_date') === today,
      language: getSetting('language')
    })
    if (!nudge) return
    setPref('last_nudge_date', today)
    new Notification({ title: nudge.title, body: nudge.body }).show()
  } catch {  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Learning Assistant',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    setTimeout(maybeShowDailyNudge, 4000)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.learning-assistant.app')
  }

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  })

  initDatabase()

  const savedDir = getPref('dataDir')
  if (savedDir && savedDir !== path.join(app.getPath('userData'), 'data')) {
    initDatabase(savedDir)
  }

  createWindow()
  installIpcTransport(() => mainWindow)
  setLanController({
    start: (port) => startHttpServer(port),
    stop: () => stopHttpServer(),
    isRunning: () => isHttpRunning()
  })

  if (getPref('lan_enabled') === '1' && hasCredentials()) {
    startHttpServer(lanPort()).catch(() => {  })
  }

  if (!process.env['ELECTRON_RENDERER_URL']) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {  })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopHttpServer()
  if (process.platform !== 'darwin') app.quit()
})
