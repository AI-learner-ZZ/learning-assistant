import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { BookOpen, Key, FolderOpen, CheckCircle, Loader2 } from 'lucide-react'

interface SetupWizardProps {
  onComplete: () => void
}

const STEPS = ['language', 'api', 'storage'] as const
type Step = typeof STEPS[number]

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { value: 'custom', label: '自定义 / Custom', baseUrl: '' }
]

export function SetupWizard({ onComplete }: SetupWizardProps): JSX.Element {
  const [step, setStep] = useState<Step>('language')
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [apiKey, setApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [dataDir, setDataDir] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)

  const isZh = language === 'zh'
  const t = (zh: string, en: string): string => isZh ? zh : en

  const handleProviderChange = (val: string): void => {
    const p = PROVIDERS.find(p => p.value === val) || PROVIDERS[0]
    setProvider(p)
    if (p.value !== 'custom') setCustomBaseUrl(p.baseUrl)
  }

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      await window.api.settings.saveSetup({
        language,
        theme,
        apiProvider: provider.value,
        apiBaseUrl: provider.value === 'custom' ? customBaseUrl : provider.baseUrl,
        apiKey,
        dataDir: dataDir || ''
      })
      setTestResult('success')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const chooseDataDir = async (): Promise<void> => {
    const dir = await window.api.settings.chooseDirectory()
    if (dir) setDataDir(dir)
  }

  const finish = async (): Promise<void> => {
    setSaving(true)
    await window.api.settings.saveSetup({
      language,
      theme,
      apiProvider: provider.value,
      apiBaseUrl: provider.value === 'custom' ? customBaseUrl : provider.baseUrl,
      apiKey,
      dataDir: dataDir || ''
    })
    setSaving(false)
    onComplete()
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <BookOpen className="h-12 w-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">{t('欢迎使用 Learning Assistant', 'Welcome to Learning Assistant')}</h1>
          <p className="text-muted-foreground mt-1">{t('让我们花两分钟完成初始设置', 'Let\'s take two minutes to set up')}</p>
        </div>

        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-12 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">

          {step === 'language' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('界面偏好', 'Interface Preferences')}</h2>
              <div className="space-y-2">
                <Label>{t('语言 / Language', 'Language')}</Label>
                <Select value={language} onValueChange={v => setLanguage(v as 'zh' | 'en')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('主题', 'Theme')}</Label>
                <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('明亮', 'Light')}</SelectItem>
                    <SelectItem value="dark">{t('暗黑', 'Dark')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full mt-4" onClick={() => setStep('api')}>
                {t('下一步', 'Next')}
              </Button>
            </div>
          )}

          {step === 'api' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('AI 服务配置', 'AI Service Configuration')}</h2>
              </div>
              <div className="space-y-2">
                <Label>{t('AI 提供商', 'AI Provider')}</Label>
                <Select value={provider.value} onValueChange={handleProviderChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {provider.value === 'custom' && (
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    placeholder="https://your-api.example.com/v1"
                    value={customBaseUrl}
                    onChange={e => setCustomBaseUrl(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder={t('粘贴你的 API Key', 'Paste your API Key')}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
              </div>
              {testResult === 'success' && (
                <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />{t('连接成功', 'Connection successful')}</p>
              )}
              {testResult === 'error' && (
                <p className="text-sm text-destructive">{t('连接失败，请检查 Key 和网络', 'Connection failed. Check your key and network.')}</p>
              )}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep('language')}>{t('上一步', 'Back')}</Button>
                <Button variant="outline" disabled={!apiKey || testing} onClick={testConnection} className="flex-1">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('测试连接', 'Test Connection')}
                </Button>
                <Button disabled={!apiKey} onClick={() => setStep('storage')} className="flex-1">
                  {t('下一步', 'Next')}
                </Button>
              </div>
            </div>
          )}

          {step === 'storage' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('数据存储', 'Data Storage')}</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('所有学习数据将保存在你选择的目录中。留空则使用默认目录。', 'All learning data will be saved in the selected directory. Leave blank for default.')}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  placeholder={t('默认目录（推荐）', 'Default directory (recommended)')}
                  value={dataDir}
                  className="flex-1"
                />
                <Button variant="outline" onClick={chooseDataDir}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep('api')}>{t('上一步', 'Back')}</Button>
                <Button className="flex-1" disabled={saving} onClick={finish}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('完成设置，开始学习！', 'Complete Setup & Start Learning!')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
