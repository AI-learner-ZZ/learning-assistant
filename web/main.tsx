import React from 'react'
import ReactDOM from 'react-dom/client'
import { httpApi } from '../src/renderer/src/lib/httpApi'
import App from '../src/renderer/src/App'
import { LoginGate } from '../src/renderer/src/components/LoginGate'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import '../src/renderer/src/styles/globals.css'

;(window as unknown as { api: typeof httpApi }).api = httpApi

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LoginGate>
      <App />
    </LoginGate>
  </React.StrictMode>
)
