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

const markShown = vi.fn()
const prefSet = vi.fn()

const NO_RECAP = { due: false, recap: { title: '', lines: [], empty: true } }

interface MockOpts {
  recap?: unknown
  goal?: string | null
  spark?: string
}

function mockApi(streak: unknown, risks: unknown, opts: MockOpts = {}): void {
  ;(window as unknown as { api: unknown }).api = {
    streak: { get: vi.fn().mockResolvedValue(streak) },
    dashboard: { risks: vi.fn().mockResolvedValue(risks) },
    recap: { get: vi.fn().mockResolvedValue(opts.recap ?? NO_RECAP), markShown },
    warmup: { generate: vi.fn().mockResolvedValue([]), complete: vi.fn() },
    spark: { get: vi.fn().mockResolvedValue({ text: opts.spark ?? '' }) },
    pref: { get: vi.fn().mockResolvedValue(opts.goal ?? null), set: prefSet }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: 'en' } }))
  useTreeStore.setState({ nodes: [], currentSubjectId: 's1' })
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

  it('shows the weekly recap when due and marks it shown on dismiss', async () => {
    mockApi(
      { count: 3, longest: 3, active: true, atRisk: false, broken: false },
      [],
      { recap: { due: true, recap: { title: 'How far you came this week', lines: ['Lit up 2 new nodes'], empty: false } } }
    )
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByText('How far you came this week')).toBeInTheDocument()
    expect(screen.getByText('Lit up 2 new nodes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /keep learning/ }))
    expect(markShown).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: /Start learning/ })).toBeInTheDocument()
  })

  it('does not show the recap when it is not due', async () => {
    mockApi({ count: 0, longest: 0, active: false, atRisk: false, broken: false }, [])
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByRole('button', { name: /Start learning/ })).toBeInTheDocument()
    expect(screen.queryByText(/How far you came/)).not.toBeInTheDocument()
  })

  it('shows the North Star goal with progress toward it', async () => {
    mockApi(
      { count: 0, longest: 0, active: false, atRisk: false, broken: false },
      [],
      { goal: 'Build a recommender system' }
    )
    useTreeStore.setState({ nodes: [node('a', 'mastered'), node('b', 'unlocked'), node('c', 'unlocked'), node('d', 'unlocked')] })
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByText('Build a recommender system')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('lets the user set a goal when none exists', async () => {
    mockApi({ count: 0, longest: 0, active: false, atRisk: false, broken: false }, [], { goal: null })
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByRole('button', { name: /Set a learning goal/ })).toBeInTheDocument()
  })

  it('shows a curiosity spark and can dismiss it', async () => {
    mockApi(
      { count: 0, longest: 0, active: false, atRisk: false, broken: false },
      [],
      { spark: 'Entropy in decision trees is the same idea that limits every zip file.' }
    )
    useTreeStore.setState({ nodes: [node('a', 'unlocked')] })
    render(<HomePanel onOpenNode={() => {}} onGoDaily={() => {}} onOpenProject={() => {}} />)

    expect(await screen.findByText(/limits every zip file/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
    expect(screen.queryByText(/limits every zip file/)).not.toBeInTheDocument()
  })
})
