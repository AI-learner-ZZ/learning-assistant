import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useTutorialStore } from '@/stores/useTutorialStore'
import { SearchSettings } from './SearchSettings'
import { TutorialDialog } from './TutorialDialog'
import { Database, Download, Trash2, Key, FolderOpen, Palette, Globe, Loader2, CheckCircle, GraduationCap, RotateCcw, DownloadCloud } from 'lucide-react'

export function SettingsPage(): JSX.Element {
  const { settings, loadSettings, updateSetting } = useSettingsStore()
  const replayTutorial = useTutorialStore(s => s.replay)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [autoFetch, setAutoFetch] = useState(false)

  useEffect(() => {
    window.api.pref.get('auto_fetch_enabled').then(v => setAutoFetch(v === '1'))
  }, [])

  const toggleAutoFetch = async (): Promise<void> => {
    const next = !autoFetch
    setAutoFetch(next)
    await window.api.pref.set('auto_fetch_enabled', next ? '1' : '0')
  }

  const isZh = settings.language === 'zh'
  const t = (zh: string, en: string): string => isZh ? zh : en

  const handleSaveApiKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    setSaving(true)
    await window.api.settings.update('apiKey', apiKey)
    setApiKey('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleThemeChange = async (value: string): Promise<void> => {
    updateSetting('theme', value as 'light' | 'dark')
    await window.api.settings.update('theme', value)
  }

  const handleLanguageChange = async (value: string): Promise<void> => {
    updateSetting('language', value as 'zh' | 'en')
    await window.api.settings.update('language', value)
    await loadSettings()
  }

  const handleProviderChange = async (value: string): Promise<void> => {
    updateSetting('apiProvider', value)
    await window.api.settings.update('apiProvider', value)
    const urlMap: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1'
    }
    if (urlMap[value]) {
      updateSetting('apiBaseUrl', urlMap[value])
      await window.api.settings.update('apiBaseUrl', urlMap[value])
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    await window.api.data.export()
    setExporting(false)
  }

  const handleChooseDataDir = async (): Promise<void> => {
    const dir = await window.api.settings.chooseDirectory()
    if (dir) {
      updateSetting('dataDir', dir)
      await window.api.settings.update('dataDir', dir)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-lg font-semibold mb-6">{t('设置', 'Settings')}</h2>

      <section className="space-y-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Palette className="h-4 w-4" />
          {t('界面', 'Interface')}
        </div>
        <div className="space-y-3 pl-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('语言', 'Language')}</Label>
            <Select value={settings.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('主题', 'Theme')}</Label>
            <Select value={settings.theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('明亮', 'Light')}</SelectItem>
                <SelectItem value="dark">{t('暗黑', 'Dark')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator className="mb-6" />

      <section className="space-y-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Globe className="h-4 w-4" />
          {t('AI 服务', 'AI Service')}
        </div>
        <div className="space-y-3 pl-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('提供商', 'Provider')}</Label>
            <Select value={settings.apiProvider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="custom">{t('自定义', 'Custom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t('更新 API Key', 'Update API Key')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={t('输入新的 API Key', 'Enter new API Key')}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? t('隐藏', 'Hide') : t('显示', 'Show')}
                </button>
              </div>
              <Button disabled={!apiKey.trim() || saving} onClick={handleSaveApiKey}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Key className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mb-6" />

      <SearchSettings isZh={isZh} />

      <Separator className="my-6" />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Database className="h-4 w-4" />
          {t('数据管理', 'Data Management')}
        </div>
        <div className="space-y-3 pl-6">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('数据目录', 'Data Directory')}</Label>
            <div className="flex gap-2">
              <Input readOnly value={settings.dataDir} className="flex-1 text-xs" />
              <Button variant="outline" size="icon" onClick={handleChooseDataDir}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('导出备份', 'Export Backup')}
          </Button>
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => {
              if (confirm(t('确定要清空所有数据吗？此操作不可撤销。', 'Clear all data? This cannot be undone.'))) {

              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            {t('清空所有数据', 'Clear All Data')}
          </Button>
        </div>
      </section>

      <Separator className="my-6" />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <GraduationCap className="h-4 w-4" />
          {t('新手引导', 'Onboarding')}
        </div>
        <div className="space-y-3 pl-6">
          <p className="text-xs text-muted-foreground">{t('回看每个页面的使用引导，或让引导在切换页面时重新弹出。', 'Review the guide for each page, or make the tips pop up again as you navigate.')}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => setGuideOpen(true)}>
              <GraduationCap className="h-4 w-4" />
              {t('查看引导', 'View guides')}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={replayTutorial}>
              <RotateCcw className="h-4 w-4" />
              {t('重新弹出引导', 'Show tips again')}
            </Button>
          </div>
        </div>
      </section>

      <Separator className="my-6" />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <DownloadCloud className="h-4 w-4" />
          {t('专家模式（实验）', 'Expert Mode (experimental)')}
        </div>
        <div className="space-y-3 pl-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm">{t('允许自动抓取网页', 'Allow automatic web fetching')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('开启后，可在"教材库"里让程序直接抓取 AI 推荐链接的正文并入库；默认关闭，此时只会打开链接由你手动保存。仅抓取你点击的链接，会屏蔽内网地址。', 'When on, the Materials panel can fetch the body text of AI-recommended links directly. Off by default — links just open for you to save manually. Only fetches links you click; private addresses are blocked.')}
              </p>
            </div>
            <Button variant={autoFetch ? 'default' : 'outline'} size="sm" className="shrink-0 w-16" onClick={toggleAutoFetch}>
              {autoFetch ? t('已开启', 'On') : t('已关闭', 'Off')}
            </Button>
          </div>
        </div>
      </section>

      <TutorialDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
