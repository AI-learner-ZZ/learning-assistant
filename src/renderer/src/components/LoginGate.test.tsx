import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginGate } from './LoginGate'

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('LoginGate', () => {
  it('shows the login form when there is no token', async () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<LoginGate><div>app-content</div></LoginGate>)
    expect(await screen.findByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.queryByText('app-content')).not.toBeInTheDocument()
  })

  it('signs in, stores the token, and renders the app', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: 'tok-123' })
    })))
    render(<LoginGate><div>app-content</div></LoginGate>)

    await userEvent.type(await screen.findByPlaceholderText('Username'), 'me')
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByText('app-content')).toBeInTheDocument()
    expect(localStorage.getItem('lan-token')).toBe('tok-123')
  })

  it('shows an error on wrong credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(<LoginGate><div>app-content</div></LoginGate>)

    await userEvent.type(await screen.findByPlaceholderText('Username'), 'me')
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'bad')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByText(/Wrong username or password/)).toBeInTheDocument()
    expect(screen.queryByText('app-content')).not.toBeInTheDocument()
  })

  it('renders the app immediately when a stored token is still valid', async () => {
    localStorage.setItem('lan-token', 'tok-999')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })))
    render(<LoginGate><div>app-content</div></LoginGate>)
    expect(await screen.findByText('app-content')).toBeInTheDocument()
  })
})
