import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WarmupDialog } from './WarmupDialog'
import { useSettingsStore } from '@/stores/useSettingsStore'

const QUESTION = {
  question: 'What direction does gradient descent step?',
  options: ['Along the gradient', 'Opposite the gradient'],
  correctIndex: 1,
  nodeName: 'Gradient Descent'
}

const generate = vi.fn()
const complete = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: 'en' } }))
  ;(window as unknown as { api: unknown }).api = { warmup: { generate, complete } }
})

describe('WarmupDialog', () => {
  it('loads and renders the first question with its options', async () => {
    generate.mockResolvedValue([QUESTION])
    render(<WarmupDialog open={true} onClose={() => {}} />)

    expect(await screen.findByText(QUESTION.question)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Along the gradient' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opposite the gradient' })).toBeInTheDocument()
  })

  it('shows an empty state when there is nothing to warm up on', async () => {
    generate.mockResolvedValue([])
    render(<WarmupDialog open={true} onClose={() => {}} />)

    expect(await screen.findByText(/Nothing studied yet/)).toBeInTheDocument()
  })
})
