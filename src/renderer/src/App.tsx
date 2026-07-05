import React, { useEffect, useState, useCallback, useRef } from 'react'
import { SetupWizard } from './components/SetupWizard'
import { KnowledgeTree } from './components/KnowledgeTree'
import { ChatPanel } from './components/ChatPanel'
import { DailyTasks } from './components/DailyTasks'
import { ErrorLog } from './components/ErrorLog'
import { SettingsPage } from './components/SettingsPage'
import { Dashboard } from './components/Dashboard'
import { ContrastLearning } from './components/ContrastLearning'
import { KnowledgeSeed } from './components/KnowledgeSeed'
import { FreeExplore } from './components/FreeExplore'
import { ProjectWorkshop } from './components/ProjectWorkshop'
import { DefenseMode } from './components/DefenseMode'
import { CoachCard } from './components/CoachCard'
import { useTutorialStore } from './stores/useTutorialStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from './components/ui/toast'
import { useSettingsStore } from './stores/useSettingsStore'
import { useTreeStore, TreeNode } from './stores/useTreeStore'
import { useChatStore } from './stores/useChatStore'
import { Separator } from './components/ui/separator'
import { BookOpen, CalendarDays, AlertTriangle, Settings, Loader2, LayoutDashboard, Scale, Compass, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from './lib/utils'

interface ToastMessage {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export default function App(): JSX.Element {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [needsSeed, setNeedsSeed] = useState<boolean | null>(null)
  const [addingSubject, setAddingSubject] = useState(false)
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [leftTab, setLeftTab] = useState<'tree' | 'daily' | 'dashboard' | 'errors' | 'settings'>('tree')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [contrastError, setContrastError] = useState<string | null>(null)
  const [contrastBanner, setContrastBanner] = useState<{ errorType: string; count: number } | null>(null)
  const [showFreeExplore, setShowFreeExplore] = useState(false)
  const [showProject, setShowProject] = useState(false)
  const [showDefense, setShowDefense] = useState(false)

  const [leftWidth, setLeftWidth] = useState(() => Number(localStorage.getItem('leftWidth')) || 384)
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem('leftCollapsed') === '1')
  const draggingRef = useRef(false)

  useEffect(() => { localStorage.setItem('leftWidth', String(leftWidth)) }, [leftWidth])
  useEffect(() => { localStorage.setItem('leftCollapsed', leftCollapsed ? '1' : '0') }, [leftCollapsed])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    const startX = e.clientX
    const startW = leftWidth
    const onMove = (ev: MouseEvent): void => {
      if (!draggingRef.current) return
      setLeftWidth(Math.min(720, Math.max(260, startW + ev.clientX - startX)))
    }
    const onUp = (): void => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth])

  const { loadSettings, settings } = useSettingsStore()
  const { loadSubjects, subjects, currentSubjectId, selectSubject } = useTreeStore()
  const { setNodeId } = useChatStore()

  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...msg, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadSettings()
      const complete = await window.api.settings.isSetupComplete()
      setSetupComplete(complete)
      if (complete) {
        const has = (await window.api.subjects.count() as number) > 0
        setNeedsSeed(!has)
        if (has) {
          await loadSubjects()
          const pending = await window.api.contrast.check() as { errorType: string; count: number } | null
          if (pending) setContrastBanner(pending)
        }
      }
    }
    init()
  }, [loadSettings, loadSubjects])

  useEffect(() => {
    const unsub = window.api.contrast.onAvailable((data) => {
      setContrastBanner({ errorType: data.errorType, count: data.count })
    })
    return () => { unsub() }
  }, [])

  const tutorialActive = useTutorialStore(s => s.active)
  const requestTutorial = useTutorialStore(s => s.request)

  useEffect(() => {
    if (setupComplete !== true || needsSeed !== false || tutorialActive) return
    const seen = useTutorialStore.getState().isSeen
    if (!seen('welcome')) { requestTutorial('welcome'); return }
    if (leftTab === 'tree' && selectedNode && !seen('chat')) { requestTutorial('chat'); return }
    if (!seen(leftTab)) { requestTutorial(leftTab) }
  }, [setupComplete, needsSeed, tutorialActive, leftTab, selectedNode, requestTutorial])

  const handleSetupComplete = useCallback(async () => {
    setSetupComplete(true)
    const has = (await window.api.subjects.count() as number) > 0
    setNeedsSeed(!has)
    if (has) await loadSubjects()
  }, [loadSubjects])

  const handleSeedCreated = useCallback(async () => {
    setNeedsSeed(false)
    setAddingSubject(false)
    await loadSubjects()
  }, [loadSubjects])

  const handleSwitchSubject = useCallback(async (id: string) => {
    if (id === '__add__') { setAddingSubject(true); return }
    setSelectedNode(null)
    setNodeId(null)
    await selectSubject(id)
  }, [selectSubject, setNodeId])

  const handleNodeSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node)
    setNodeId(node.id)
  }, [setNodeId])

  const handleClearSelection = useCallback(() => {
    setSelectedNode(null)
    setNodeId(null)
  }, [setNodeId])

  const handleExplainNode = useCallback(async (nodeId: string, nodeName: string) => {
    const zh = useSettingsStore.getState().settings.language === 'zh'
    setExplanationLoading(true)
    try {
      const explanation = await window.api.tree.explainNecessity(nodeName) as string
      addToast({ title: zh ? `为什么学「${nodeName}」？` : `Why learn "${nodeName}"?`, description: explanation })
    } catch {
      addToast({ title: zh ? '获取解释失败' : 'Failed to get explanation', variant: 'destructive' })
    } finally {
      setExplanationLoading(false)
    }
  }, [addToast])

  const handleTaskStart = useCallback((nodeId: string | null) => {
    if (!nodeId) return

    setNodeId(nodeId)
    setLeftTab('tree')
  }, [setNodeId])

  const handleReviewNode = useCallback((nodeId: string) => {
    setNodeId(nodeId)
    setLeftTab('tree')
  }, [setNodeId])

  if (setupComplete === null || (setupComplete && needsSeed === null)) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!setupComplete) {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  if (needsSeed) {
    return <KnowledgeSeed onCreated={handleSeedCreated} />
  }

  const isZh = settings.language === 'zh'

  return (
    <ToastProvider>
      <div className="h-full flex flex-col overflow-hidden relative">
        <div className="flex flex-1 overflow-hidden">

          <div
            className="shrink-0 border-r flex flex-col overflow-hidden"
            style={{ width: leftCollapsed ? 0 : leftWidth }}
          >
            <div className="px-2 pt-2 shrink-0 flex items-center gap-1">
              <Select value={currentSubjectId ?? ''} onValueChange={handleSwitchSubject}>
                <SelectTrigger className="h-9 text-sm flex-1">
                  <SelectValue placeholder={isZh ? '选择学科' : 'Select subject'} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.is_primary ? (isZh ? '（主科）' : ' (main)') : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add__">
                    <span className="flex items-center gap-1 text-primary"><Plus className="h-3.5 w-3.5" />{isZh ? '新增学科' : 'Add subject'}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <button
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={isZh ? '折叠左侧面板' : 'Collapse panel'}
                onClick={() => setLeftCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <Tabs value={leftTab} onValueChange={v => setLeftTab(v as typeof leftTab)} className="flex flex-col h-full">
              <div className="px-2 py-2 border-b shrink-0">
                <TabsList className="w-full h-9">
                  <TabsTrigger value="tree" className="flex-1 gap-1 text-xs px-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {isZh ? '知识树' : 'Tree'}
                  </TabsTrigger>
                  <TabsTrigger value="daily" className="flex-1 gap-1 text-xs px-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {isZh ? '今日' : 'Daily'}
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="flex-1 gap-1 text-xs px-1">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    {isZh ? '仪表盘' : 'Stats'}
                  </TabsTrigger>
                  <TabsTrigger value="errors" className="flex-1 gap-1 text-xs px-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {isZh ? '错误' : 'Errors'}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1 gap-1 text-xs px-1">
                    <Settings className="h-3.5 w-3.5" />
                    {isZh ? '设置' : 'Set'}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="tree" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <KnowledgeTree onNodeSelect={handleNodeSelect} onExplainNode={handleExplainNode} onClearSelection={handleClearSelection} />
                </TabsContent>
                <TabsContent value="daily" className="h-full m-0 overflow-y-auto">
                  <DailyTasks onTaskStart={handleTaskStart} />
                </TabsContent>
                <TabsContent value="dashboard" className="h-full m-0 overflow-hidden">
                  <Dashboard
                    onReviewNode={handleReviewNode}
                    onOpenProject={() => setShowProject(true)}
                    onOpenDefense={() => setShowDefense(true)}
                  />
                </TabsContent>
                <TabsContent value="errors" className="h-full m-0 overflow-y-auto">
                  <ErrorLog onReviewNode={handleReviewNode} />
                </TabsContent>
                <TabsContent value="settings" className="h-full m-0 overflow-y-auto">
                  <SettingsPage />
                </TabsContent>
              </div>
            </Tabs>

            <div className="border-t shrink-0 p-2">
              <button
                onClick={() => setShowFreeExplore(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md py-1.5 transition-colors"
              >
                <Compass className="h-3.5 w-3.5" />
                {isZh ? '自由探索' : 'Free Explore'}
              </button>
            </div>
          </div>

          {!leftCollapsed && (
            <div
              onMouseDown={startDrag}
              className="group relative w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
              title={isZh ? '拖动调整宽度' : 'Drag to resize'}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          )}

          <div className="flex-1 overflow-hidden relative">
            {leftCollapsed && (
              <button
                className="absolute top-2 left-2 z-20 h-8 w-8 flex items-center justify-center rounded-md border bg-background/90 backdrop-blur text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm transition-colors"
                title={isZh ? '展开左侧面板' : 'Expand panel'}
                onClick={() => setLeftCollapsed(false)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <ChatPanel
              nodeId={selectedNode?.id || null}
              nodeName={selectedNode?.name || null}
              nodeDescription={selectedNode?.description || null}
              headerInset={leftCollapsed}
            />
          </div>
        </div>

        <div className="h-6 border-t bg-muted/30 flex items-center px-4 gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {selectedNode
              ? `${isZh ? '当前节点' : 'Node'}: ${selectedNode.name}`
              : (isZh ? '选择知识节点开始学习' : 'Select a node to begin')}
          </span>
          {explanationLoading && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {isZh ? '正在生成解释...' : 'Generating explanation...'}
              </span>
            </>
          )}
        </div>

        {contrastBanner && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white rounded-full shadow-lg px-4 py-2 flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-2">
            <Scale className="h-4 w-4" />
            <span>
              {isZh
                ? `你在「${contrastBanner.errorType}」上反复出错，来做个对比练习吧`
                : `Repeated "${contrastBanner.errorType}" errors — try a contrast exercise`}
            </span>
            <button
              className="bg-white/20 hover:bg-white/30 rounded-full px-3 py-0.5 text-xs font-medium"
              onClick={() => { setContrastError(contrastBanner.errorType) }}
            >
              {isZh ? '开始' : 'Start'}
            </button>
            <button className="hover:opacity-70" onClick={() => setContrastBanner(null)}>✕</button>
          </div>
        )}
      </div>

      <ContrastLearning
        open={contrastError !== null}
        errorType={contrastError || ''}
        onClose={() => { setContrastError(null); setContrastBanner(null) }}
        onResolved={() => { setContrastBanner(null) }}
      />

      <FreeExplore
        open={showFreeExplore}
        onClose={() => setShowFreeExplore(false)}
        onSubjectCreated={handleSeedCreated}
      />

      <ProjectWorkshop
        open={showProject}
        subjectId={currentSubjectId}
        onClose={() => setShowProject(false)}
      />

      <DefenseMode
        open={showDefense}
        subjectId={currentSubjectId}
        subjectName={subjects.find(s => s.id === currentSubjectId)?.name || ''}
        onClose={() => setShowDefense(false)}
      />

      {addingSubject && (
        <div className="fixed inset-0 z-50">
          <KnowledgeSeed onCreated={handleSeedCreated} overlay />
          <button
            className="absolute top-4 right-4 z-[51] text-muted-foreground hover:text-foreground bg-background border rounded-full p-2 shadow-sm"
            onClick={() => setAddingSubject(false)}
          >
            ✕
          </button>
        </div>
      )}

      <ToastViewport />
      {toasts.map(t => (
        <Toast key={t.id} variant={t.variant}>
          <div className="grid gap-1">
            <ToastTitle className={cn(t.variant === 'destructive' && 'text-destructive-foreground')}>
              {t.title}
            </ToastTitle>
            {t.description && (
              <ToastDescription className="text-xs max-h-32 overflow-y-auto">
                {t.description}
              </ToastDescription>
            )}
          </div>
          <ToastClose />
        </Toast>
      ))}

      <CoachCard />
    </ToastProvider>
  )
}
