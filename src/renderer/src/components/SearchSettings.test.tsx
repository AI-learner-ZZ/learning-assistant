import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchSettings } from './SearchSettings'

function mockConfig(provider: string, searxngUrl = ''): void {
  ;(window as unknown as { api: unknown }).api = {
    search: {
      getConfig: vi.fn().mockResolvedValue({ provider, searxngUrl, configured: provider !== 'none' }),
      setConfig: vi.fn().mockResolvedValue(true),
      test: vi.fn().mockResolvedValue({ success: true })
    }
  }
}

beforeEach(() => vi.clearAllMocks())

describe('SearchSettings', () => {
  it('shows the no-key hint and Save/Test for the free provider', async () => {
    mockConfig('free')
    render(<SearchSettings isZh={true} />)
    expect(await screen.findByText(/DuckDuckGo \+ 维基百科/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('输入搜索服务密钥')).not.toBeInTheDocument()
  })

  it('shows the API key field for serpapi', async () => {
    mockConfig('serpapi')
    render(<SearchSettings isZh={true} />)
    expect(await screen.findByPlaceholderText('输入搜索服务密钥')).toBeInTheDocument()
  })

  it('shows the URL field for searxng', async () => {
    mockConfig('searxng', 'https://s.example.com')
    render(<SearchSettings isZh={true} />)
    expect(await screen.findByPlaceholderText('https://searxng.example.com')).toBeInTheDocument()
  })

  it('hides Save/Test when the provider is off', async () => {
    mockConfig('none')
    render(<SearchSettings isZh={true} />)
    expect(await screen.findByText(/双源校验/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
  })
})
