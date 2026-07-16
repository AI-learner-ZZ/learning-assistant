import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomePanel } from './HomePanel'
import { useTreeStore, type TreeNode } from '@/stores/useTreeStore'
import { useSettingsStore } from '@/stores/useSettingsStore'

function node(id: string, status: TreeNode['status'], parent_id: string | null = null): TreeNode {
  return {
    id,
    subject_id: 's',
    parent_id,
    name: `Node ${id}`,
    description: null,
    status,
    progress: 0,
    sort_order: 0,
    estimated_minutes: 0,
    created_at: '',
    updated_at: ''
  }
}

function mockApi(streak: unknown, risks: unknown): void {
  ;(window as unknown as { api: unknown }).api = {
    streak: { get: vi.fn().mockResolvedValue(streak) },
    dashboard: { risks: vi.fn().mockResolvedValue(risks) }
  }
}

beforeEach(() => {
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: 'en' } }))
  useTreeStore.setState({ nodes: [] })
})

describe('HomePanel', () => {
  it('surfaces the highest-risk due review and opens it', async () => {
    mockApi(
      { count: 5, longest: 5, active: false, atRisk: true, broken: false },
      [{ node_id: 'a', name: 'Alpha', risk: 0.9 }]
    )
    useTreeStore.setState({ nodes: [node('a', 'mastered')] })
    const onOpenNode = vi.fn()
    render(<HomePanel onOpenNode={onOpenNode} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText(/5-day streak/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Start review/ }))
    expect(onOpenNode).toHaveBeenCalledWith('a')
  })

  it('starts the next unlocked node when nothing is due', async () => {
    mockApi({ count: 0, longest: 0, active: false, atRisk: false, broken: false }, [])
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    const onOpenNode = vi.fn()
    render(<HomePanel onOpenNode={onOpenNode} onGoDaily={() => {}} onOpenProject={() => {}} />)

    await userEvent.click(await screen.findByRole('button', { name: /Start learning/ }))
    expect(onOpenNode).toHaveBeenCalledWith('a')
  })

  it('offers the project workshop when the subject is fully mastered', async () => {
    mockApi({ count: 0, longest: 3, active: false, atRisk: false, broken: true }, [])
    useTreeStore.setState({ nodes: [node('a', 'mastered'), node('b', 'mastered')] })
    const onOpenProject = vi.fn()
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={onOpenProject} />)

    await userEvent.click(await screen.findByRole('button', { name: /Open Project Workshop/ }))
    expect(onOpenProject).toHaveBeenCalled()
  })
})
