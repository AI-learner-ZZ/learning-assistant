import { describe, it, expect } from 'vitest'
import { isFetchableUrl, extractReadableText } from './fetchService'

describe('isFetchableUrl', () => {
  it('accepts public http and https urls', () => {
    expect(isFetchableUrl('https://aws.amazon.com/docs')).toBe(true)
    expect(isFetchableUrl('http://example.org')).toBe(true)
  })

  it('rejects non-http protocols', () => {
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false)
    expect(isFetchableUrl('ftp://example.com')).toBe(false)
    expect(isFetchableUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects localhost and private/link-local addresses', () => {
    expect(isFetchableUrl('http://localhost:3000')).toBe(false)
    expect(isFetchableUrl('http://127.0.0.1')).toBe(false)
    expect(isFetchableUrl('http://10.0.0.5')).toBe(false)
    expect(isFetchableUrl('http://192.168.1.1')).toBe(false)
    expect(isFetchableUrl('http://172.16.0.1')).toBe(false)
    expect(isFetchableUrl('http://169.254.1.1')).toBe(false)
    expect(isFetchableUrl('http://printer.local')).toBe(false)
  })

  it('rejects malformed urls', () => {
    expect(isFetchableUrl('not a url')).toBe(false)
    expect(isFetchableUrl('')).toBe(false)
  })
})

describe('extractReadableText', () => {
  it('pulls the title and strips scripts and styles', () => {
    const html = '<html><head><title>My Page</title><style>.x{color:red}</style></head><body><script>evil()</script><p>Hello world</p></body></html>'
    const out = extractReadableText(html)
    expect(out.title).toBe('My Page')
    expect(out.text).toContain('Hello world')
    expect(out.text).not.toContain('evil')
    expect(out.text).not.toContain('color:red')
  })

  it('prefers the main/article region when present', () => {
    const html = '<body><nav>menu links</nav><article><p>Real content here.</p></article><footer>copyright</footer></body>'
    const out = extractReadableText(html)
    expect(out.text).toContain('Real content here.')
    expect(out.text).not.toContain('menu links')
    expect(out.text).not.toContain('copyright')
  })

  it('decodes entities and collapses whitespace', () => {
    const out = extractReadableText('<p>a &amp; b\n\n   c</p>')
    expect(out.text).toBe('a & b c')
  })
})
