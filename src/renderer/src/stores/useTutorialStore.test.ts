import { describe, it, expect, beforeEach } from 'vitest'
import { useTutorialStore } from './useTutorialStore'

beforeEach(() => {
  localStorage.clear()
  useTutorialStore.setState({ seen: [], active: null })
})

describe('useTutorialStore', () => {
  it('activates an unseen guide on request', () => {
    useTutorialStore.getState().request('welcome')
    expect(useTutorialStore.getState().active).toBe('welcome')
  })

  it('ignores a request while another guide is active', () => {
    useTutorialStore.setState({ active: 'welcome' })
    useTutorialStore.getState().request('tree')
    expect(useTutorialStore.getState().active).toBe('welcome')
  })

  it('ignores a request for an already seen guide', () => {
    useTutorialStore.setState({ seen: ['tree'] })
    useTutorialStore.getState().request('tree')
    expect(useTutorialStore.getState().active).toBeNull()
  })

  it('marks a guide seen, persists it, and clears the active guide on dismiss', () => {
    useTutorialStore.getState().request('welcome')
    useTutorialStore.getState().dismiss('welcome')
    const state = useTutorialStore.getState()
    expect(state.seen).toContain('welcome')
    expect(state.active).toBeNull()
    expect(JSON.parse(localStorage.getItem('tutorial-seen') ?? '[]')).toContain('welcome')
  })

  it('does not duplicate a guide already in seen', () => {
    useTutorialStore.setState({ seen: ['welcome'], active: 'welcome' })
    useTutorialStore.getState().dismiss('welcome')
    expect(useTutorialStore.getState().seen).toEqual(['welcome'])
  })

  it('reflects persisted state via isSeen', () => {
    useTutorialStore.setState({ seen: ['daily'] })
    expect(useTutorialStore.getState().isSeen('daily')).toBe(true)
    expect(useTutorialStore.getState().isSeen('errors')).toBe(false)
  })

  it('clears seen and reopens the welcome guide on replay', () => {
    useTutorialStore.setState({ seen: ['welcome', 'tree'] })
    useTutorialStore.getState().replay()
    const state = useTutorialStore.getState()
    expect(state.seen).toEqual([])
    expect(state.active).toBe('welcome')
    expect(JSON.parse(localStorage.getItem('tutorial-seen') ?? 'null')).toEqual([])
  })
})
