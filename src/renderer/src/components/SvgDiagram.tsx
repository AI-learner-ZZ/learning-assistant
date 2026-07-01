import React, { useMemo } from 'react'
import DOMPurify from 'dompurify'

export function SvgDiagram({ code }: { code: string }): JSX.Element {
  const clean = useMemo(() => {
    try {
      return DOMPurify.sanitize(code, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['use'],
        ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'offset', 'gradientUnits']
      })
    } catch {
      return ''
    }
  }, [code])

  if (!clean || !clean.includes('<svg')) {
    return <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto"><code>{code}</code></pre>
  }

  return (
    <div
      className="my-3 flex justify-center rounded-lg border bg-card/50 p-3 [&_svg]:max-w-full [&_svg]:h-auto"

      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
