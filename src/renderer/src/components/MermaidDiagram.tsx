import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false
function ensureInit(): void {
  if (initialized) return
  const dark = document.documentElement.classList.contains('dark')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default',
    fontFamily: 'inherit'
  })
  initialized = true
}

let counter = 0

export function MermaidDiagram({ code }: { code: string }): JSX.Element {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState(false)
  const idRef = useRef(`mermaid-${counter++}`)

  useEffect(() => {
    let active = true
    ensureInit()
    mermaid
      .render(idRef.current, code)
      .then(({ svg }) => { if (active) { setSvg(svg); setError(false) } })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [code])

  if (error) {
    return (
      <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto"><code>{code}</code></pre>
    )
  }

  return (
    <div
      className="my-3 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto rounded-lg border bg-card/50 p-3"

      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
