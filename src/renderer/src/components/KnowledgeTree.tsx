import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  Connection
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useTreeStore, TreeNode } from '@/stores/useTreeStore'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { SkipForward, HelpCircle, Pencil, Plus, Upload, Download, Trash2, X } from 'lucide-react'
import { Button } from './ui/button'

interface NodeData {
  label: string
  status: TreeNode['status']
  progress: number
  nodeId: string
  editMode?: boolean
  onSelect: (id: string) => void
  onSkip: (id: string) => void
  onQuestion: (id: string, name: string) => void
  onDelete?: (id: string) => void
  onAddChild?: (id: string) => void
}

function KnowledgeNode({ data, selected }: NodeProps<NodeData>): JSX.Element {
  const { t } = useT()
  const statusConfig = {
    unlocked: 'border-border bg-card text-foreground',
    learning: 'border-primary/70 bg-primary/5 text-primary animate-breathing',
    mastered: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300',
    skipped: 'border-muted bg-muted/50 text-muted-foreground opacity-60'
  }

  const dotColor = {
    unlocked: 'bg-muted-foreground',
    learning: 'bg-primary',
    mastered: 'bg-green-500',
    skipped: 'bg-muted-foreground'
  }

  return (
    <div
      className={cn(
        'px-4 py-2.5 rounded-lg border-2 shadow-sm cursor-pointer min-w-[120px] max-w-[180px] transition-all hover:shadow-md group',
        statusConfig[data.status],

        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background border-primary'
      )}
      onClick={() => data.onSelect(data.nodeId)}
    >
      <Handle type="target" position={Position.Left} className="!bg-border !w-2 !h-2" />

      <div className="flex items-center gap-1.5">
        <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor[data.status])} />
        <span className="text-xs font-medium leading-tight line-clamp-2">{data.label}</span>
      </div>

      {data.status === 'learning' && data.progress > 0 && (
        <div className="mt-1.5 h-1 bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${data.progress}%` }} />
        </div>
      )}

      <div className={cn(
        'absolute -top-6 right-0 gap-1 bg-popover border rounded-md px-1 py-0.5 shadow-sm z-10 before:absolute before:inset-x-0 before:-bottom-2 before:h-2 before:content-[""]',
        selected ? 'flex' : 'hidden group-hover:flex'
      )}>
        {data.editMode ? (
          <>
            <button
              className="p-0.5 hover:text-green-500 transition-colors"
              title={t('新增子节点', 'Add child')}
              onClick={e => { e.stopPropagation(); data.onAddChild?.(data.nodeId) }}
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:text-red-500 transition-colors"
              title={t('删除此节点', 'Delete node')}
              onClick={e => { e.stopPropagation(); data.onDelete?.(data.nodeId) }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <button
              className="p-0.5 hover:text-yellow-500 transition-colors"
              title={t('跳过此节点', 'Skip node')}
              onClick={e => { e.stopPropagation(); data.onSkip(data.nodeId) }}
            >
              <SkipForward className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:text-blue-500 transition-colors"
              title={t('质疑此节点必要性', 'Challenge necessity')}
              onClick={e => { e.stopPropagation(); data.onQuestion(data.nodeId, data.label) }}
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-border !w-2 !h-2" />
    </div>
  )
}

const nodeTypes = { knowledgeNode: KnowledgeNode }

function buildLayout(nodes: TreeNode[]): { rfNodes: Node[]; rfEdges: Edge[] } {
  const LEVEL_WIDTH = 230
  const NODE_HEIGHT = 52
  const Y_GAP = 22

  const byParent = new Map<string | null, TreeNode[]>()
  for (const n of nodes) {
    const key = n.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(n)
  }

  const positions = new Map<string, { x: number; y: number }>()
  let cursor = 0

  function layout(node: TreeNode, depth: number): number {
    const children = byParent.get(node.id) || []
    let y: number
    if (children.length === 0) {
      y = cursor
      cursor += NODE_HEIGHT + Y_GAP
    } else {
      const childYs = children.map(c => layout(c, depth + 1))
      y = (childYs[0] + childYs[childYs.length - 1]) / 2
    }
    positions.set(node.id, { x: depth * LEVEL_WIDTH, y })
    return y
  }

  const roots = byParent.get(null) || []
  for (const root of roots) layout(root, 0)

  const rfNodes: Node[] = nodes.map(n => ({
    id: n.id,
    type: 'knowledgeNode',
    position: positions.get(n.id) || { x: 0, y: 0 },
    data: {}
  }))

  const rfEdges: Edge[] = nodes
    .filter(n => n.parent_id)
    .map(n => ({
      id: `e-${n.parent_id}-${n.id}`,
      source: n.parent_id!,
      target: n.id,
      type: 'smoothstep',
      style: { stroke: 'hsl(var(--border))', strokeWidth: 2 },
      animated: n.status === 'learning'
    }))

  return { rfNodes, rfEdges }
}

interface KnowledgeTreeProps {
  onNodeSelect: (node: TreeNode) => void
  onExplainNode: (nodeId: string, nodeName: string) => void
  onClearSelection: () => void
}

export function KnowledgeTree({ onNodeSelect, onExplainNode, onClearSelection }: KnowledgeTreeProps): JSX.Element {
  const { t } = useT()
  const { nodes, selectedNodeId, currentSubjectId, selectNode, updateNodeStatus, loadNodes, loadSubjects } = useTreeStore()
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])

  const [editMode, setEditMode] = useState(false)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [addingChildOf, setAddingChildOf] = useState<string | null | 'root'>(null)
  const [newNodeName, setNewNodeName] = useState('')

  const handleSelect = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    selectNode(id)
    onNodeSelect(node)
  }, [nodes, selectNode, onNodeSelect])

  const handlePaneClick = useCallback(() => {
    selectNode(null)
    onClearSelection()
  }, [selectNode, onClearSelection])

  const handleSkip = useCallback((id: string) => {
    updateNodeStatus(id, 'skipped')
  }, [updateNodeStatus])

  const handleQuestion = useCallback((id: string, name: string) => {
    onExplainNode(id, name)
  }, [onExplainNode])

  const handleDelete = useCallback(async (id: string) => {
    const hasChildren = nodes.some(n => n.parent_id === id)
    const cascade = hasChildren
      ? confirm(t('该节点有子节点。点击"确定"级联删除所有子节点，点击"取消"仅删除该节点（子节点上移）。', 'This node has children. Click OK to cascade-delete all children, or Cancel to delete only this node (children move up).'))
      : false
    await window.api.tree.deleteNode(id, cascade)
    if (currentSubjectId) await loadNodes(currentSubjectId)
  }, [nodes, currentSubjectId, loadNodes])

  const handleConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target || !currentSubjectId) return

    const result = await window.api.tree.reparent(conn.target, conn.source, currentSubjectId) as { success: boolean; cycleEdges?: unknown[] }
    if (!result.success) {
      setCycleError(t('检测到循环依赖，已阻止该连接。', 'Cycle detected — connection blocked.'))
      setTimeout(() => setCycleError(null), 3000)
      return
    }
    await loadNodes(currentSubjectId)
  }, [currentSubjectId, loadNodes])

  const handleAddNode = async (): Promise<void> => {
    if (!newNodeName.trim() || !currentSubjectId) return
    const parentId = addingChildOf === 'root' ? null : addingChildOf
    await window.api.tree.addNode({ subjectId: currentSubjectId, parentId, name: newNodeName.trim() })
    setNewNodeName('')
    setAddingChildOf(null)
    await loadNodes(currentSubjectId)
  }

  const handleExport = async (): Promise<void> => {
    if (currentSubjectId) await window.api.tree.export(currentSubjectId)
  }

  const handleImport = async (): Promise<void> => {
    const newId = await window.api.tree.import() as string | null
    if (newId) {
      await loadSubjects()
    }
  }

  const { rfNodes: layoutNodes, rfEdges: layoutEdges } = useMemo(
    () => buildLayout(nodes),
    [nodes]
  )

  useEffect(() => {
    const enriched = layoutNodes.map(n => {
      const treeNode = nodes.find(t => t.id === n.id)!
      return {
        ...n,
        draggable: editMode,
        data: {
          label: treeNode.name,
          status: treeNode.status,
          progress: treeNode.progress,
          nodeId: n.id,
          editMode,
          onSelect: handleSelect,
          onSkip: handleSkip,
          onQuestion: handleQuestion,
          onDelete: handleDelete,
          onAddChild: (id: string) => setAddingChildOf(id)
        },
        selected: n.id === selectedNodeId
      }
    })
    setRfNodes(enriched)
    setRfEdges(layoutEdges)
  }, [layoutNodes, layoutEdges, nodes, selectedNodeId, editMode, handleSelect, handleSkip, handleQuestion, handleDelete, setRfNodes, setRfEdges])

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
        <div>
          <div className="text-4xl mb-3">🌱</div>
          <p>{t('暂无知识树节点', 'No knowledge nodes yet')}</p>
          <p className="text-xs mt-1">{t('正在加载学科模板...', 'Loading subject template...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
        <Button
          size="sm"
          variant={editMode ? 'default' : 'ghost'}
          className="h-7 gap-1 text-xs px-2"
          onClick={() => setEditMode(!editMode)}
          title={t('切换编辑模式（拖拽连线改变父子关系）', 'Toggle edit mode (drag to re-parent)')}
        >
          <Pencil className="h-3.5 w-3.5" /> {editMode ? t('退出编辑', 'Exit') : t('编辑', 'Edit')}
        </Button>
        {editMode && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs px-2" onClick={() => setAddingChildOf('root')} title={t('新增根节点', 'Add root node')}>
            <Plus className="h-3.5 w-3.5" /> {t('节点', 'Node')}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleExport} title={t('导出为 JSON', 'Export as JSON')}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleImport} title={t('从 JSON 导入新学科', 'Import subject from JSON')}>
          <Upload className="h-3.5 w-3.5" />
        </Button>
      </div>

      {cycleError && (
        <div className="absolute top-12 right-2 z-10 bg-destructive text-destructive-foreground text-xs px-3 py-2 rounded-lg shadow-lg">
          ⚠️ {cycleError}
        </div>
      )}

      {addingChildOf !== null && (
        <div className="absolute top-12 left-2 z-10 bg-background border rounded-lg p-3 shadow-lg w-64">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">
              {addingChildOf === 'root' ? t('新增根节点', 'Add root node') : t('新增子节点', 'Add child node')}
            </span>
            <button onClick={() => { setAddingChildOf(null); setNewNodeName('') }}><X className="h-3.5 w-3.5" /></button>
          </div>
          <input
            autoFocus
            className="w-full text-sm border rounded-md px-2 py-1 bg-background mb-2"
            placeholder={t('节点名称', 'Node name')}
            value={newNodeName}
            onChange={e => setNewNodeName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNode() }}
          />
          <Button size="sm" className="w-full h-7 text-xs" disabled={!newNodeName.trim()} onClick={handleAddNode}>{t('添加', 'Add')}</Button>
        </div>
      )}

      {editMode && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full">
          {t('编辑模式：拖动节点右侧圆点连到另一节点左侧，即可设置父子关系', 'Edit mode: drag from a node\'s right dot to another node\'s left to set parent/child')}
        </div>
      )}

      <ReactFlow
        key={currentSubjectId ?? 'none'}
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        nodesConnectable={editMode}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 40, y: 40, zoom: 0.95 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={editMode}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--border))" gap={20} size={1} />
        <Controls className="!shadow-sm" />
        <MiniMap
          nodeColor={n => {
            const status = (n.data as NodeData).status
            const colors = { unlocked: '#94a3b8', learning: '#3b82f6', mastered: '#22c55e', skipped: '#cbd5e1' }
            return colors[status as keyof typeof colors] || '#94a3b8'
          }}
          className="!rounded-lg !shadow-sm"
        />
      </ReactFlow>
    </div>
  )
}
