import React from 'react'
import ReactDOM from 'react-dom/client'
import { mockApi } from './mockApi'
import App from '../src/renderer/src/App'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import '../src/renderer/src/styles/globals.css'

;(window as unknown as { api: typeof mockApi }).api = mockApi

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <a
      href="https://github.com/AI-learner-ZZ/learning-assistant"
      target="_blank"
      rel="noopener"
      className="fixed bottom-2 right-2 z-[999] text-[11px] px-2.5 py-1 rounded-full bg-primary text-primary-foreground shadow-md hover:opacity-90"
    >
      Live UI demo · sample data · get the desktop app →
    </a>
  </React.StrictMode>
)
