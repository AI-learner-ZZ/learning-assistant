import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { upsertSubject, upsertNode, deleteSubjectNodes } from './database'

interface TemplateNode {
  id?: string
  name: string
  description?: string
  estimatedMinutes?: number
  children?: TemplateNode[]
}

interface Template {
  id: string
  name: string
  description?: string
  nodes: TemplateNode[]
}

export interface TemplateMeta {
  file: string
  id: string
  name: string
  description: string
  nodeCount: number
}

function getTemplateDir(): string {

  if (!app.isPackaged) {
    return path.join(app.getAppPath(), 'resources', 'templates')
  }
  return path.join(process.resourcesPath, 'resources', 'templates')
}

function countNodes(nodes: TemplateNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0)
}

export function listTemplates(): TemplateMeta[] {
  const dir = getTemplateDir()
  if (!fs.existsSync(dir)) return []
  const metas: TemplateMeta[] = []
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      const tpl: Template = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
      metas.push({
        file,
        id: tpl.id,
        name: tpl.name,
        description: tpl.description || '',
        nodeCount: countNodes(tpl.nodes)
      })
    } catch {

    }
  }
  return metas
}

function flattenNodes(
  nodes: TemplateNode[],
  subjectId: string,
  parentId: string | null = null,
  order = { val: 0 }
): Parameters<typeof upsertNode>[0][] {
  const result: Parameters<typeof upsertNode>[0][] = []
  for (const n of nodes) {
    const nodeId = randomUUID()
    result.push({
      id: nodeId,
      subject_id: subjectId,
      parent_id: parentId,
      name: n.name,
      description: n.description || null,
      status: 'unlocked',
      progress: 0,
      sort_order: order.val++,
      estimated_minutes: n.estimatedMinutes || 30
    })
    if (n.children?.length) {
      result.push(...flattenNodes(n.children, subjectId, nodeId, order))
    }
  }
  return result
}

export function loadTemplate(file: string, isPrimary = false): string | null {
  const templatePath = path.join(getTemplateDir(), file)
  if (!fs.existsSync(templatePath)) return null
  try {
    const tpl: Template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))
    const subjectId = randomUUID()
    upsertSubject({ id: subjectId, name: tpl.name, description: tpl.description, is_primary: isPrimary ? 1 : 0 })
    for (const node of flattenNodes(tpl.nodes, subjectId)) {
      upsertNode(node)
    }
    return subjectId
  } catch (e) {
    console.error('[templateLoader] Failed to load template:', e)
    return null
  }
}

export function createSubjectFromTree(
  name: string,
  description: string,
  nodes: TemplateNode[],
  isPrimary = true
): string {
  const subjectId = randomUUID()
  upsertSubject({ id: subjectId, name, description, is_primary: isPrimary ? 1 : 0 })
  for (const node of flattenNodes(nodes, subjectId)) {
    upsertNode(node)
  }
  return subjectId
}

export function replaceSubjectTree(subjectId: string, nodes: TemplateNode[]): number {
  deleteSubjectNodes(subjectId)
  const flat = flattenNodes(nodes, subjectId)
  for (const node of flat) {
    upsertNode(node)
  }
  return flat.length
}
