import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoachCard } from './CoachCard'
import { useTutorialStore } from '@/stores/useTutorialStore'
import { useSettingsStore } from '@/stores/useSettingsStore'

function setLanguage(language: 'zh' | 'en'): void {
  useSettingsStore.setState(s => ({ settings: { ...s.settings, language } }))
}

beforeEach(() => {
  localStorage.clear()
  useTutorialStore.setState({ seen: [], active: null })
  setLanguage('zh')
})

describe('CoachCard', () => {
  it('renders nothing when no guide is active', () => {
    const { container } = render(<CoachCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the first tip of the active guide', () => {
    useTutorialStore.setState({ active: 'welcome' })
    render(<CoachCard />)
    expect(screen.getByText('苏格拉底式 AI 学伴')).toBeInTheDocument()
  })

  it('advances to the next tip on click', async () => {
    const user = userEvent.setup()
    useTutorialStore.setState({ active: 'welcome' })
    render(<CoachCard />)
    await user.click(screen.getByRole('button', { name: /下一条/ }))
    expect(screen.getByText('左树右聊')).toBeInTheDocument()
  })

  it('dismisses and marks the guide seen after the last tip', async () => {
    const user = userEvent.setup()
    useTutorialStore.setState({ active: 'welcome' })
    render(<CoachCard />)
    await user.click(screen.getByRole('button', { name: /下一条/ }))
    await user.click(screen.getByRole('button', { name: /下一条/ }))
    await user.click(screen.getByRole('button', { name: /知道了/ }))
    expect(screen.queryByText('随时回看')).not.toBeInTheDocument()
    expect(useTutorialStore.getState().seen).toContain('welcome')
    expect(useTutorialStore.getState().active).toBeNull()
  })

  it('skips the guide from the skip button', async () => {
    const user = userEvent.setup()
    useTutorialStore.setState({ active: 'welcome' })
    render(<CoachCard />)
    await user.click(screen.getAllByRole('button', { name: /跳过/ })[0])
    expect(useTutorialStore.getState().seen).toContain('welcome')
    expect(useTutorialStore.getState().active).toBeNull()
  })

  it('renders English when the language is en', () => {
    setLanguage('en')
    useTutorialStore.setState({ active: 'welcome' })
    render(<CoachCard />)
    expect(screen.getByText('A Socratic AI companion')).toBeInTheDocument()
  })
})
