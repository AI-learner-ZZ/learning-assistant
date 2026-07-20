import { ipcMain, type BrowserWindow } from 'electron'
import { HANDLERS, type Ctx } from '../handlers/registry'
import { addSink, busEmit } from './bus'

export function installIpcTransport(getWindow: () => BrowserWindow | null): void {
  addSink((channel, data) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  })

  const ctx: Ctx = { emit: busEmit, getWindow }

  for (const [name, def] of Object.entries(HANDLERS)) {
    ipcMain.handle(name, (_event, ...args: unknown[]) => def.fn(args, ctx))
  }
}
