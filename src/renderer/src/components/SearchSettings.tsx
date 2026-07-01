import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Search, Loader2, CheckCircle, XCircle } from 'lucide-react'

type Provider = 'none' | 'serpapi' | 'bing' | 'searxng'

export function SearchSettings({ isZh }: { isZh: boolean }): JSX.Element {
  const t = (zh: string, en: string): string => (isZh ? zh : en)
  const [provider, setProvider] = useState<Provider>('none')
  const [searxngUrl, setSearxngUrl] = useState('')
  const [key, setKey] = useState('')
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    window.api.search.getConfig().then(cfg => {
      const c = cfg as { provider: Provider; searxngUrl: string; configured: boolean }
      setProvider(c.provider)
      setSearxngUrl(c.searxngUrl)
      setConfigured(c.configured)
    })
  }, [])

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const ok = await window.api.search.setConfig({
        provider,
        key: key || undefined,
        searxngUrl: provider === 'searxng' ? searxngUrl : undefined
      }) as boolean
      setConfigured(ok)
      setKey('')
    } finally {
      setSaving(false)
    }
  }

  const test = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await window.api.search.test('hello') as { success: boolean }
      setTestResult(res.success ? 'ok' : 'fail')
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Search className="h-4 w-4" />
        {t('联网搜索', 'Web Search')}
        {configured && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
      </div>
      <div className="space-y-3 pl-6">
        <p className="text-xs text-muted-foreground">
          {t('配置后，AI 在需要实时数据时可自动联网搜索并做双源校验。', 'Once configured, the AI can search the web for real-time data with dual-source verification.')}
        </p>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('搜索提供商', 'Provider')}</Label>
          <Select value={provider} onValueChange={v => setProvider(v as Provider)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('关闭', 'Off')}</SelectItem>
              <SelectItem value="serpapi">SerpAPI</SelectItem>
              <SelectItem value="bing">Bing</SelectItem>
              <SelectItem value="searxng">SearXNG</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === 'searxng' && (
          <div className="space-y-1.5">
            <Label className="text-sm">SearXNG URL</Label>
            <Input placeholder="https://searxng.example.com" value={searxngUrl} onChange={e => setSearxngUrl(e.target.value)} />
          </div>
        )}

        {(provider === 'serpapi' || provider === 'bing') && (
          <div className="space-y-1.5">
            <Label className="text-sm">{t('搜索 API Key', 'Search API Key')}</Label>
            <Input type="password" placeholder={t('输入搜索服务密钥', 'Enter search API key')} value={key} onChange={e => setKey(e.target.value)} />
          </div>
        )}

        {provider !== 'none' && (
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={save} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('保存', 'Save')}
            </Button>
            <Button size="sm" variant="outline" disabled={testing} onClick={test} className="flex-1">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" />
                : testResult === 'ok' ? <CheckCircle className="h-4 w-4 text-green-500" />
                : testResult === 'fail' ? <XCircle className="h-4 w-4 text-red-500" />
                : t('测试', 'Test')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
