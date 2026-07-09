import { describe, it, expect } from 'vitest'
import { detectCycle, validateReparent, type NodeRelation } from './treeValidator'

describe('detectCycle', () => {
  it('returns no cycle for an empty tree', () => {
    expect(detectCycle([])).toEqual({ hasCycle: false, cycleEdges: [] })
  })

  it('returns no cycle for a linear chain', () => {
    const nodes: NodeRelation[] = [
      { id: 'a', parent_id: null },
      { id: 'b', parent_id: 'a' },
      { id: 'c', parent_id: 'b' }
    ]
    expect(detectCycle(nodes).hasCycle).toBe(false)
  })

  it('detects a self-loop', () => {
    const res = detectCycle([{ id: 'a', parent_id: 'a' }])
    expect(res.hasCycle).toBe(true)
    expect(res.cycleEdges).toContainEqual({ from: 'a', to: 'a' })
  })

  it('detects a two-node cycle', () => {
    const nodes: NodeRelation[] = [
      { id: 'a', parent_id: 'b' },
      { id: 'b', parent_id: 'a' }
    ]
    expect(detectCycle(nodes).hasCycle).toBe(true)
  })

  it('ignores a parent id that does not exist', () => {
    const nodes: NodeRelation[] = [
      { id: 'a', parent_id: 'ghost' },
      { id: 'b', parent_id: 'a' }
    ]
    expect(detectCycle(nodes).hasCycle).toBe(false)
  })

  it('finds a cycle inside one tree of a forest', () => {
    const nodes: NodeRelation[] = [
      { id: 'r1', parent_id: null },
      { id: 'x', parent_id: 'r1' },
      { id: 'p', parent_id: 'q' },
      { id: 'q', parent_id: 'p' }
    ]
    expect(detectCycle(nodes).hasCycle).toBe(true)
  })
})

describe('validateReparent', () => {
  const nodes: NodeRelation[] = [
    { id: 'a', parent_id: null },
    { id: 'b', parent_id: 'a' },
    { id: 'c', parent_id: 'b' }
  ]

  it('rejects reparenting a node under its own descendant', () => {
    expect(validateReparent(nodes, 'a', 'c').hasCycle).toBe(true)
  })

  it('allows a legal reparent', () => {
    expect(validateReparent(nodes, 'c', 'a').hasCycle).toBe(false)
  })

  it('allows promoting a node to root', () => {
    expect(validateReparent(nodes, 'c', null).hasCycle).toBe(false)
  })

  it('does not mutate the input nodes', () => {
    const snapshot = JSON.parse(JSON.stringify(nodes))
    validateReparent(nodes, 'c', 'a')
    expect(nodes).toEqual(snapshot)
  })
})
