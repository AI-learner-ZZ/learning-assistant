#!/usr/bin/env node
import { spawn } from 'node:child_process'

const mode = process.argv[2] === 'preview' ? 'preview' : 'dev'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const bin = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'

const child = spawn(bin, [mode], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32'
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('Failed to launch electron-vite:', err)
  process.exit(1)
})
