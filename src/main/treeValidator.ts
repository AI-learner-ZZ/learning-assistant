export interface NodeRelation {
  id: string
  parent_id: string | null
}

export interface CycleResult {
  hasCycle: boolean
  cycleEdges: { from: string; to: string }[]
}

export function detectCycle(nodes: NodeRelation[]): CycleResult {
  const parentOf = new Map<string, string | null>()
  for (const n of nodes) parentOf.set(n.id, n.parent_id)

  const cycleEdges: { from: string; to: string }[] = []
  const state = new Map<string, 0 | 1 | 2>()

  function visit(id: string): boolean {
    state.set(id, 1)
    const parent = parentOf.get(id) ?? null
    if (parent && parentOf.has(parent)) {
      const ps = state.get(parent) ?? 0
      if (ps === 1) {

        cycleEdges.push({ from: id, to: parent })
        return true
      }
      if (ps === 0 && visit(parent)) {
        cycleEdges.push({ from: id, to: parent })
        return true
      }
    }
    state.set(id, 2)
    return false
  }

  for (const n of nodes) {
    if ((state.get(n.id) ?? 0) === 0) {
      if (visit(n.id)) return { hasCycle: true, cycleEdges }
    }
  }
  return { hasCycle: false, cycleEdges: [] }
}

export function validateReparent(
  nodes: NodeRelation[],
  childId: string,
  newParentId: string | null
): CycleResult {
  const proposed = nodes.map(n => (n.id === childId ? { ...n, parent_id: newParentId } : n))
  return detectCycle(proposed)
}
