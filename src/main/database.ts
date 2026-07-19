const { Database: SqliteDatabase } = require('node-sqlite3-wasm')

interface WasmDatabase {
  exec(sql: string): void
  run(sql: string, values?: unknown[] | Record<string, unknown>): { changes: number; lastInsertRowid: number }
  get(sql: string, values?: unknown[] | Record<string, unknown>): unknown
  all(sql: string, values?: unknown[] | Record<string, unknown>): unknown[]
  close(): void
}

import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: WasmDatabase | null = null

export function getDb(): WasmDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initDatabase(dataDir?: string): void {
  if (db) {
    try { db.close() } catch {  }
    db = null
  }
  const dir = dataDir || path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'data.db')
  db = new SqliteDatabase(dbPath) as WasmDatabase
  createTables()
  runMigrations()
}

function runMigrations(): void {
  const d = getDb()
  const tryExec = (sql: string): void => {
    try { d.exec(sql) } catch {  }
  }

  tryExec('ALTER TABLE error_log ADD COLUMN resolved INTEGER DEFAULT 0')
}

function createTables(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_tree (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'unlocked',
      progress INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      estimated_minutes INTEGER DEFAULT 30,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_records (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      session_date TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 0,
      correct_rate REAL DEFAULT 0,
      forgetting_risk REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      last_reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      node_id TEXT,
      subject_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS error_log (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      node_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      estimated_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'pending',
      feedback TEXT,
      task_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_state (
      node_id TEXT PRIMARY KEY,
      ease_factor REAL DEFAULT 2.5,
      interval_days REAL DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      last_correct_rate REAL DEFAULT 0,
      last_reviewed_at TEXT,
      next_review_date TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_steps (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      kind TEXT DEFAULT 'txt',
      title TEXT NOT NULL,
      origin TEXT,
      status TEXT DEFAULT 'pending',
      chunk_count INTEGER DEFAULT 0,
      token_estimate INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doc_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      seq INTEGER DEFAULT 0,
      text TEXT NOT NULL,
      embedding TEXT
    );

    CREATE TABLE IF NOT EXISTS node_sources (
      node_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL
    );
  `)
}

export interface KnowledgeNode {
  id: string
  subject_id: string
  parent_id: string | null
  name: string
  description: string | null
  status: 'unlocked' | 'learning' | 'mastered' | 'skipped'
  progress: number
  sort_order: number
  estimated_minutes: number
  created_at: string
  updated_at: string
}

export function getNodes(subjectId: string): KnowledgeNode[] {
  return getDb()
    .all('SELECT * FROM knowledge_tree WHERE subject_id = ? ORDER BY sort_order ASC', [subjectId]) as KnowledgeNode[]
}

export function getAllNodes(): KnowledgeNode[] {
  return getDb().all('SELECT * FROM knowledge_tree ORDER BY sort_order ASC') as KnowledgeNode[]
}

export function getNodeById(id: string): KnowledgeNode | null {
  return (getDb().get('SELECT * FROM knowledge_tree WHERE id = ?', [id]) as KnowledgeNode | undefined) ?? null
}

export function deleteNode(id: string, cascade: boolean): void {
  if (cascade) {

    const all = getAllNodes()
    const toDelete = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const n of all) {
        if (n.parent_id && toDelete.has(n.parent_id) && !toDelete.has(n.id)) {
          toDelete.add(n.id)
          changed = true
        }
      }
    }
    for (const nid of toDelete) {
      getDb().run('DELETE FROM knowledge_tree WHERE id = ?', [nid])
    }
  } else {

    const node = getNodeById(id)
    getDb().run('UPDATE knowledge_tree SET parent_id = ? WHERE parent_id = ?', [node?.parent_id ?? null, id])
    getDb().run('DELETE FROM knowledge_tree WHERE id = ?', [id])
  }
}

export function updateNodeRelations(updates: { id: string; parent_id: string | null; sort_order: number }[]): void {
  for (const u of updates) {
    getDb().run("UPDATE knowledge_tree SET parent_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?", [u.parent_id, u.sort_order, u.id])
  }
}

export function upsertNode(node: Partial<KnowledgeNode> & { id: string; subject_id: string; name: string }): void {
  getDb().run(
    `INSERT INTO knowledge_tree (id, subject_id, parent_id, name, description, status, progress, sort_order, estimated_minutes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       parent_id = excluded.parent_id,
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       progress = excluded.progress,
       sort_order = excluded.sort_order,
       estimated_minutes = excluded.estimated_minutes,
       updated_at = datetime('now')`,
    [node.id, node.subject_id, node.parent_id ?? null, node.name, node.description ?? null,
     node.status ?? 'unlocked', node.progress ?? 0, node.sort_order ?? 0, node.estimated_minutes ?? 30]
  )
}

export function deleteSubjectNodes(subjectId: string): void {
  getDb().run('DELETE FROM knowledge_tree WHERE subject_id = ?', [subjectId])
}

export function updateNodeStatus(id: string, status: string, progress?: number): void {
  if (progress !== undefined) {
    getDb().run("UPDATE knowledge_tree SET status = ?, progress = ?, updated_at = datetime('now') WHERE id = ?", [status, progress, id])
  } else {
    getDb().run("UPDATE knowledge_tree SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id])
  }
}

export interface Subject {
  id: string
  name: string
  description: string | null
  is_primary: number
  created_at: string
}

export function getSubjects(): Subject[] {
  return getDb().all('SELECT * FROM subjects ORDER BY is_primary DESC, created_at ASC') as Subject[]
}

export function upsertSubject(subject: Partial<Subject> & { id: string; name: string }): void {
  getDb().run(
    `INSERT INTO subjects (id, name, description, is_primary)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, is_primary = excluded.is_primary`,
    [subject.id, subject.name, subject.description ?? null, subject.is_primary ?? 0]
  )
}

export function deleteSubject(id: string): void {
  getDb().run('DELETE FROM knowledge_tree WHERE subject_id = ?', [id])
  getDb().run('DELETE FROM conversations WHERE subject_id = ?', [id])
  getDb().run('DELETE FROM subjects WHERE id = ?', [id])
}

export function countSubjects(): number {
  const row = getDb().get('SELECT COUNT(*) as c FROM subjects') as { c: number } | undefined
  return row?.c ?? 0
}

export interface Project {
  id: string
  subject_id: string
  title: string
  description: string | null
  status: 'active' | 'completed'
  created_at: string
}

export interface ProjectStep {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  sort_order: number
  created_at: string
}

export function createProject(p: { id: string; subject_id: string; title: string; description: string | null }): void {
  getDb().run(
    "INSERT INTO projects (id, subject_id, title, description, status) VALUES (?, ?, ?, ?, 'active')",
    [p.id, p.subject_id, p.title, p.description]
  )
}

export function getProjects(subjectId: string): Project[] {
  return getDb().all('SELECT * FROM projects WHERE subject_id = ? ORDER BY created_at DESC', [subjectId]) as Project[]
}

export function updateProjectStatus(id: string, status: string): void {
  getDb().run('UPDATE projects SET status = ? WHERE id = ?', [status, id])
}

export function createProjectStep(s: Omit<ProjectStep, 'created_at' | 'status'> & { status?: string }): void {
  getDb().run(
    "INSERT INTO project_steps (id, project_id, title, description, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    [s.id, s.project_id, s.title, s.description, s.status ?? 'todo', s.sort_order]
  )
}

export function getProjectSteps(projectId: string): ProjectStep[] {
  return getDb().all('SELECT * FROM project_steps WHERE project_id = ? ORDER BY sort_order ASC', [projectId]) as ProjectStep[]
}

export function updateProjectStepStatus(id: string, status: string): void {
  getDb().run('UPDATE project_steps SET status = ? WHERE id = ?', [status, id])
}

export function getBottleneckCandidates(minErrors: number, sinceDays: number): {
  node_id: string; node_name: string; error_count: number; first_error: string; last_error: string
}[] {
  return getDb().all(`
    SELECT e.node_id,
           k.name as node_name,
           COUNT(*) as error_count,
           MIN(e.created_at) as first_error,
           MAX(e.created_at) as last_error
    FROM error_log e
    LEFT JOIN knowledge_tree k ON k.id = e.node_id
    WHERE e.created_at >= datetime('now', ?)
    GROUP BY e.node_id
    HAVING error_count >= ?
    ORDER BY error_count DESC
  `, [`-${sinceDays} days`, minErrors]) as {
    node_id: string; node_name: string; error_count: number; first_error: string; last_error: string
  }[]
}

export function getStudyTimeDistribution(): { weekday: number; hour: number; count: number }[] {
  return getDb().all(`
    SELECT CAST(strftime('%w', created_at, 'localtime') AS INTEGER) as weekday,
           CAST(strftime('%H', created_at, 'localtime') AS INTEGER) as hour,
           COUNT(*) as count
    FROM learning_records
    GROUP BY weekday, hour
  `) as { weekday: number; hour: number; count: number }[]
}

export function getAccuracyByHour(): { hour: number; accuracy: number; count: number }[] {
  return getDb().all(`
    SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) as hour,
           AVG(correct_rate) as accuracy,
           COUNT(*) as count
    FROM learning_records
    GROUP BY hour
    ORDER BY hour ASC
  `) as { hour: number; accuracy: number; count: number }[]
}

export interface ConversationMessage {
  id: string
  node_id: string | null
  subject_id: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export function saveMessage(msg: Omit<ConversationMessage, 'created_at'>): void {
  getDb().run(
    'INSERT INTO conversations (id, node_id, subject_id, role, content) VALUES (?, ?, ?, ?, ?)',
    [msg.id, msg.node_id, msg.subject_id, msg.role, msg.content]
  )
}

export function getMessages(nodeId: string): ConversationMessage[] {
  return getDb().all('SELECT * FROM conversations WHERE node_id = ? ORDER BY created_at ASC', [nodeId]) as ConversationMessage[]
}

export function clearMessages(nodeId: string): void {
  getDb().run('DELETE FROM conversations WHERE node_id = ?', [nodeId])
}

export interface ErrorEntry {
  id: string
  node_id: string
  error_type: string
  error_content: string | null
  created_at: string
}

export function logError(entry: Omit<ErrorEntry, 'created_at'>): void {
  getDb().run(
    'INSERT INTO error_log (id, node_id, error_type, error_content, resolved) VALUES (?, ?, ?, ?, 0)',
    [entry.id, entry.node_id, entry.error_type, entry.error_content ?? null]
  )
}

export function getErrors(): (ErrorEntry & { node_name?: string })[] {
  return getDb().all(`
    SELECT e.*, k.name as node_name
    FROM error_log e
    LEFT JOIN knowledge_tree k ON k.id = e.node_id
    ORDER BY e.created_at DESC
    LIMIT 100
  `) as (ErrorEntry & { node_name?: string })[]
}

export function getUnresolvedErrorCounts(): { error_type: string; count: number }[] {
  return getDb().all(`
    SELECT error_type, COUNT(*) as count
    FROM error_log
    WHERE resolved = 0
    GROUP BY error_type
    ORDER BY count DESC
  `) as { error_type: string; count: number }[]
}

export function getUnresolvedErrorsByType(errorType: string): (ErrorEntry & { node_name?: string })[] {
  return getDb().all(`
    SELECT e.*, k.name as node_name
    FROM error_log e
    LEFT JOIN knowledge_tree k ON k.id = e.node_id
    WHERE e.resolved = 0 AND e.error_type = ?
    ORDER BY e.created_at DESC
  `, [errorType]) as (ErrorEntry & { node_name?: string })[]
}

export function resolveErrorsByType(errorType: string): void {
  getDb().run('UPDATE error_log SET resolved = 1 WHERE error_type = ? AND resolved = 0', [errorType])
}

export interface SourceRow {
  id: string
  subject_id: string
  kind: string
  title: string
  origin: string | null
  status: string
  chunk_count: number
  token_estimate: number
  created_at: string
}

export interface ChunkRow {
  id: string
  source_id: string
  subject_id: string
  seq: number
  text: string
  embedding: string | null
}

export function insertSource(s: Omit<SourceRow, 'created_at'>): void {
  getDb().run(
    `INSERT OR REPLACE INTO sources (id, subject_id, kind, title, origin, status, chunk_count, token_estimate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.subject_id, s.kind, s.title, s.origin, s.status, s.chunk_count, s.token_estimate]
  )
}

export function getSources(subjectId: string): SourceRow[] {
  return getDb().all('SELECT * FROM sources WHERE subject_id = ? ORDER BY created_at DESC', [subjectId]) as SourceRow[]
}

export function deleteSource(id: string): void {
  getDb().run('DELETE FROM doc_chunks WHERE source_id = ?', [id])
  getDb().run('DELETE FROM sources WHERE id = ?', [id])
}

export function insertChunks(chunks: ChunkRow[]): void {
  for (const c of chunks) {
    getDb().run(
      'INSERT OR REPLACE INTO doc_chunks (id, source_id, subject_id, seq, text, embedding) VALUES (?, ?, ?, ?, ?, ?)',
      [c.id, c.source_id, c.subject_id, c.seq, c.text, c.embedding]
    )
  }
}

export function getChunksBySubject(subjectId: string): ChunkRow[] {
  return getDb().all('SELECT * FROM doc_chunks WHERE subject_id = ?', [subjectId]) as ChunkRow[]
}

export function countSources(subjectId: string): number {
  const row = getDb().get('SELECT COUNT(*) as c FROM sources WHERE subject_id = ?', [subjectId]) as { c: number } | undefined
  return row?.c ?? 0
}

export function getPref(key: string): string | null {
  const row = getDb().get('SELECT value FROM user_prefs WHERE key = ?', [key]) as { value: string } | undefined
  return row?.value ?? null
}

export function setPref(key: string, value: string): void {
  getDb().run(
    "INSERT INTO user_prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    [key, value]
  )
}

export interface DailyTask {
  id: string
  task_type: 'core' | 'review' | 'explore'
  node_id: string | null
  title: string
  description: string | null
  estimated_minutes: number
  status: 'pending' | 'done'
  feedback: string | null
  task_date: string
}

export function getTodayTasks(date: string): DailyTask[] {
  return getDb().all('SELECT * FROM daily_tasks WHERE task_date = ? ORDER BY task_type ASC', [date]) as DailyTask[]
}

export function saveTodayTasks(tasks: Omit<DailyTask, 'status' | 'feedback'>[]): void {
  for (const t of tasks) {
    getDb().run(
      `INSERT OR REPLACE INTO daily_tasks (id, task_type, node_id, title, description, estimated_minutes, task_date, status, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', null)`,
      [t.id, t.task_type, t.node_id, t.title, t.description, t.estimated_minutes, t.task_date]
    )
  }
}

export function updateTaskStatus(id: string, status: string, feedback?: string): void {
  getDb().run('UPDATE daily_tasks SET status = ?, feedback = ? WHERE id = ?', [status, feedback ?? null, id])
}

export function insertLearningRecord(record: {
  id: string; node_id: string; session_date: string; duration_minutes: number; correct_rate: number
}): void {
  getDb().run(
    `INSERT INTO learning_records (id, node_id, session_date, duration_minutes, correct_rate, last_reviewed_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [record.id, record.node_id, record.session_date, record.duration_minutes, record.correct_rate]
  )
}

export function getLatestRecordPerNode(): {
  node_id: string; session_date: string; correct_rate: number; last_reviewed_at: string; review_count: number
}[] {
  return getDb().all(`
    SELECT lr.node_id,
           lr.session_date,
           lr.correct_rate,
           lr.last_reviewed_at,
           (SELECT COUNT(*) FROM learning_records r2 WHERE r2.node_id = lr.node_id) as review_count
    FROM learning_records lr
    INNER JOIN (
      SELECT node_id, MAX(created_at) as max_created
      FROM learning_records GROUP BY node_id
    ) latest ON latest.node_id = lr.node_id AND latest.max_created = lr.created_at
  `) as { node_id: string; session_date: string; correct_rate: number; last_reviewed_at: string; review_count: number }[]
}

export function getMasteredSince(days: number): { id: string; name: string }[] {
  return getDb().all(
    `SELECT id, name FROM knowledge_tree
     WHERE status = 'mastered' AND updated_at >= datetime('now', ?)
     ORDER BY updated_at DESC`,
    [`-${days} days`]
  ) as { id: string; name: string }[]
}

export function getRecordsSince(days: number): { sessions: number; minutes: number; accuracy: number } {
  const row = getDb().get(
    `SELECT COUNT(*) as sessions,
            COALESCE(SUM(duration_minutes), 0) as minutes,
            COALESCE(AVG(correct_rate), 0) as accuracy
     FROM learning_records
     WHERE created_at >= datetime('now', ?)`,
    [`-${days} days`]
  ) as { sessions: number; minutes: number; accuracy: number } | undefined
  return row ?? { sessions: 0, minutes: 0, accuracy: 0 }
}

export function getDailyAccuracy(days: number): { day: string; accuracy: number; count: number }[] {
  return getDb().all(`
    SELECT session_date as day,
           AVG(correct_rate) as accuracy,
           COUNT(*) as count
    FROM learning_records
    WHERE session_date >= date('now', ?)
    GROUP BY session_date
    ORDER BY session_date ASC
  `, [`-${days} days`]) as { day: string; accuracy: number; count: number }[]
}

export interface ReviewState {
  node_id: string
  ease_factor: number
  interval_days: number
  repetitions: number
  last_correct_rate: number
  last_reviewed_at: string | null
  next_review_date: string | null
}

export function getReviewState(nodeId: string): ReviewState | null {
  return (getDb().get('SELECT * FROM review_state WHERE node_id = ?', [nodeId]) as ReviewState | undefined) ?? null
}

export function getAllReviewStates(): ReviewState[] {
  return getDb().all('SELECT * FROM review_state') as ReviewState[]
}

export function upsertReviewState(s: ReviewState): void {
  getDb().run(
    `INSERT INTO review_state (node_id, ease_factor, interval_days, repetitions, last_correct_rate, last_reviewed_at, next_review_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(node_id) DO UPDATE SET
       ease_factor = excluded.ease_factor,
       interval_days = excluded.interval_days,
       repetitions = excluded.repetitions,
       last_correct_rate = excluded.last_correct_rate,
       last_reviewed_at = excluded.last_reviewed_at,
       next_review_date = excluded.next_review_date`,
    [s.node_id, s.ease_factor, s.interval_days, s.repetitions, s.last_correct_rate, s.last_reviewed_at, s.next_review_date]
  )
}
