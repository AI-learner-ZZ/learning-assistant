import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MaterialsDialog } from './MaterialsDialog'
import { useSettingsStore } from '@/stores/useSettingsStore'

const list = vi.fn()
const suggest = vi.fn()
const ingest = vi.fn()
const del = vi.fn()
const openExternal = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: 'en' } }))
  list.mockResolvedValue([
    { id: 's1', kind: 'pdf', title: 'My Textbook', status: 'ingested', chunk_count: 12, token_estimate: 9000 }
  ])
  suggest.mockResolvedValue([
    { title: 'Official Docs', url: 'https://example.com', why: 'authoritative', kind: 'doc' }
  ])
  ingest.mockResolvedValue({ sourceId: 'x', chunks: 3 })
  del.mockResolvedValue({ success: true })
  ;(window as unknown as { api: unknown }).api = {
    rag: { list, ingest, delete: del, autoFetchEnabled: vi.fn().mockResolvedValue(false), treeFromMaterials: vi.fn() },
    material: { suggest, fetch: vi.fn() },
    data: { openExternal },
    file: { choose: vi.fn(), parse: vi.fn() }
  }
})

describe('MaterialsDialog', () => {
  it('lists already-imported sources', async () => {
    render(<MaterialsDialog open={true} subjectId="subj" subjectName="AI" onClose={() => {}} />)
    expect(await screen.findByText('My Textbook')).toBeInTheDocument()
    expect(screen.getByText(/12 chunks/)).toBeInTheDocument()
  })

  it('fetches AI material suggestions on demand', async () => {
    render(<MaterialsDialog open={true} subjectId="subj" subjectName="AI" onClose={() => {}} />)
    await screen.findByText('My Textbook')

    await userEvent.click(screen.getByRole('button', { name: /Suggest/ }))
    expect(suggest).toHaveBeenCalledWith('AI')
    expect(await screen.findByText('Official Docs')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Open/ }))
    expect(openExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('imports pasted text as a new source', async () => {
    render(<MaterialsDialog open={true} subjectId="subj" subjectName="AI" onClose={() => {}} />)
    await screen.findByText('My Textbook')

    await userEvent.type(screen.getByPlaceholderText(/paste text content/i), 'some study notes')
    await userEvent.click(screen.getByRole('button', { name: /Import pasted text/ }))
    expect(ingest).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 'subj', kind: 'paste', text: 'some study notes' }))
  })
})
