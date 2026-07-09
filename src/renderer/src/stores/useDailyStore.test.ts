import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDailyStore, type DailyTask } from './useDailyStore'

function task(id: string): DailyTask {
  return {
    id,
    task_type: 'core',
    node_id: null,
    title: `Task ${id}`,
    description: null,
    estimated_minutes: 10,
    status: 'pending',
    feedback: null,
    task_date: '2026-07-01'
  }
}

const updateTask = vi.fn()
const feedback = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { api: unknown }).api = { daily: { updateTask, feedback } }
  useDailyStore.setState({ tasks: [task('t1'), task('t2')], loading: false })
})

describe('updateTask', () => {
  it('marks a task done locally after persisting', async () => {
    await useDailyStore.getState().updateTask('t1', 'done', 'too_easy')
    expect(updateTask).toHaveBeenCalledWith('t1', 'done', 'too_easy')
    const t1 = useDailyStore.getState().tasks.find(t => t.id === 't1')
    expect(t1?.status).toBe('done')
    expect(t1?.feedback).toBe('too_easy')
  })

  it('leaves other tasks untouched', async () => {
    await useDailyStore.getState().updateTask('t1', 'done')
    const t2 = useDailyStore.getState().tasks.find(t => t.id === 't2')
    expect(t2?.status).toBe('pending')
  })
})

describe('sendFeedback', () => {
  it('records feedback locally after persisting', async () => {
    await useDailyStore.getState().sendFeedback('t2', 'too_hard')
    expect(feedback).toHaveBeenCalledWith('t2', 'too_hard')
    expect(useDailyStore.getState().tasks.find(t => t.id === 't2')?.feedback).toBe('too_hard')
  })
})
