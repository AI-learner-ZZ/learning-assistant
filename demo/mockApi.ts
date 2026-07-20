const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

const SUBJECT = { id: 'subj-ai', name: 'Artificial Intelligence', description: 'From zero to graduate level in AI', is_primary: 1, created_at: '2026-01-01' }

interface DemoNode {
  id: string; subject_id: string; parent_id: string | null; name: string; description: string
  status: 'unlocked' | 'learning' | 'mastered' | 'skipped'; progress: number; sort_order: number
  estimated_minutes: number; created_at: string; updated_at: string
}

function node(id: string, parent: string | null, name: string, description: string, status: DemoNode['status'], order: number): DemoNode {
  return { id, subject_id: 'subj-ai', parent_id: parent, name, description, status, progress: status === 'learning' ? 45 : 0, sort_order: order, estimated_minutes: 30, created_at: '', updated_at: '' }
}

const NODES: DemoNode[] = [
  node('math', null, 'Math Foundations', 'Core math for machine learning', 'mastered', 0),
  node('linalg', 'math', 'Linear Algebra', 'Vectors, matrices, eigenvalues', 'mastered', 1),
  node('calc', 'math', 'Calculus & Optimization', 'Gradients and the chain rule', 'mastered', 2),
  node('grad', 'calc', 'Gradient Descent', 'Descend the loss surface', 'learning', 3),
  node('prob', 'math', 'Probability & Statistics', 'Distributions and Bayes', 'unlocked', 4),
  node('py', null, 'Python Programming', 'The core tool of an AI engineer', 'mastered', 5),
  node('numpy', 'py', 'NumPy & Pandas', 'Scientific computing basics', 'learning', 6),
  node('viz', 'py', 'Data Visualization', 'Plotting and intuition', 'unlocked', 7),
  node('ml', null, 'Machine Learning', 'Learning patterns from data', 'learning', 8),
  node('supervised', 'ml', 'Supervised Learning', 'Regression and classification', 'unlocked', 9),
  node('linreg', 'supervised', 'Linear Regression', 'The simplest predictor', 'unlocked', 10),
  node('overfit', 'ml', 'Overfitting & Regularization', 'L1 / L2 and generalization', 'unlocked', 11),
  node('dl', null, 'Deep Learning', 'Neural networks', 'unlocked', 12),
  node('nn', 'dl', 'Neural Network Basics', 'Perceptrons and activations', 'unlocked', 13),
  node('backprop', 'nn', 'Backpropagation', 'The chain rule at scale', 'unlocked', 14)
]

const FEATURED_REPLY = [
  '## Gradient Descent',
  '',
  '**Gradient descent** is an *iterative optimization* algorithm that minimizes a loss function $J(\\theta)$.',
  '',
  '### The core loop',
  '1. Compute the **gradient** $\\nabla J(\\theta)$ at the current point',
  '2. Take a step along the *negative* gradient',
  '3. Repeat until convergence',
  '',
  '$$\\theta_{t+1} = \\theta_t - \\alpha\\,\\nabla J(\\theta_t)$$',
  '',
  '> 💡 The learning rate `α` matters: too large diverges, too small crawls.',
  '',
  '```mermaid',
  'graph TD',
  '  A[Init params] --> B[Compute loss]',
  '  B --> C[Compute gradient]',
  '  C --> D[Update params]',
  '  D --> E{Converged?}',
  '  E -- No --> B',
  '  E -- Yes --> F[Done]',
  '```',
  '',
  '[QUESTION] If the loss stops decreasing but accuracy keeps rising, what might be happening?'
].join('\n')

const SVG_REPLY = [
  'In visual subjects the tutor draws too. The **rule of thirds** places the subject on an intersection:',
  '',
  '```svg',
  '<svg viewBox="0 0 300 200" width="300" height="200" xmlns="http://www.w3.org/2000/svg">',
  '  <rect x="0" y="0" width="300" height="200" fill="#eef2ff" stroke="#94a3b8"/>',
  '  <line x1="100" y1="0" x2="100" y2="200" stroke="#6366f1" stroke-width="1.5"/>',
  '  <line x1="200" y1="0" x2="200" y2="200" stroke="#6366f1" stroke-width="1.5"/>',
  '  <line x1="0" y1="66" x2="300" y2="66" stroke="#6366f1" stroke-width="1.5"/>',
  '  <line x1="0" y1="133" x2="300" y2="133" stroke="#6366f1" stroke-width="1.5"/>',
  '  <circle cx="200" cy="66" r="10" fill="#f59e0b"/>',
  '  <text x="150" y="190" font-size="12" text-anchor="middle" fill="#475569">subject on an intersection</text>',
  '</svg>',
  '```'
].join('\n')

const HISTORY: Record<string, { id: string; role: string; content: string }[]> = {
  grad: [
    { id: 'm1', role: 'user', content: 'How does gradient descent work?' },
    { id: 'm2', role: 'assistant', content: FEATURED_REPLY },
    { id: 'm3', role: 'user', content: 'Can you show a visual example from another field?' },
    { id: 'm4', role: 'assistant', content: SVG_REPLY }
  ]
}

const streamHandlers = new Map<string, (d: { delta: string; done: boolean; full?: string }) => void>()

async function streamReply(channelId: string, full: string): Promise<void> {
  const cb = streamHandlers.get(channelId)
  if (!cb) return
  const tokens = full.match(/\S+\s*|\s+/g) || [full]
  let acc = ''
  for (const tk of tokens) {
    acc += tk
    cb({ delta: tk, done: false })
    await delay(18)
  }
  cb({ delta: '', done: true, full })
}

function download(name: string, content: string): boolean {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
  return true
}

function scriptedAnswer(): string {
  return [
    "Great question — let's reason it out together rather than me just answering.",
    '',
    '> 💡 This is a **live UI demo** with sample data, so replies are scripted. In the real app the Socratic tutor streams from your own AI model.',
    '',
    'Here is how the pieces connect:',
    '',
    '```mermaid',
    'graph LR',
    '  Q[Your question] --> T[Socratic tutor]',
    '  T --> H[Guiding sub-question]',
    '  H --> Y[You reason it out]',
    '  Y --> M[Node marked learning]',
    '```',
    '',
    '[QUESTION] Try answering: what would *you* check first?'
  ].join('\n')
}

const PREFS: Record<string, string> = {}

interface DemoSource {
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

const SOURCES: DemoSource[] = [
  { id: 'src-demo', subject_id: SUBJECT.id, kind: 'pdf', title: 'Deep Learning (Goodfellow) — ch.6', origin: 'deeplearningbook.org', status: 'ingested', chunk_count: 24, token_estimate: 28000, created_at: '' }
]

export const mockApi = {
  settings: {
    getAll: () => Promise.resolve({ language: 'en', theme: 'light', apiProvider: 'openai', apiBaseUrl: '', dataDir: '', setupComplete: true }),
    isSetupComplete: () => Promise.resolve(true),
    saveSetup: () => Promise.resolve(),
    update: () => Promise.resolve(),
    chooseDirectory: () => Promise.resolve(null),
    hasApiKey: () => Promise.resolve(true)
  },
  subjects: {
    getAll: () => Promise.resolve([SUBJECT]),
    count: () => Promise.resolve(1),
    create: () => Promise.resolve('subj-ai'),
    createFromDomain: () => delay(600).then(() => 'subj-ai'),
    delete: () => Promise.resolve(),
    getActive: () => Promise.resolve('subj-ai'),
    setActive: () => Promise.resolve()
  },
  templates: {
    list: () => Promise.resolve([
      { file: 'ai.json', id: 'subj-ai', name: 'Artificial Intelligence', description: 'From zero to graduate level in AI', nodeCount: 15 },
      { file: 'nutrition.json', id: 'n', name: 'Nutrition', description: 'Energy metabolism to lifecycle nutrition', nodeCount: 12 },
      { file: 'fitness.json', id: 'f', name: 'Fitness', description: 'Anatomy to program design', nodeCount: 12 }
    ]),
    load: () => Promise.resolve('subj-ai')
  },
  project: {
    coverage: () => Promise.resolve({ total: 15, mastered: 6, percent: 40 }),
    list: () => Promise.resolve([]),
    generate: () => delay(700).then(() => ({
      id: 'p1', subject_id: 'subj-ai', title: 'Weather data mini-project', description: 'Fetch a weather API and visualize it.', status: 'active',
      steps: [
        { id: 's1', project_id: 'p1', title: 'Find a stable weather API', description: 'Pick one and read its docs.', status: 'todo', sort_order: 0 },
        { id: 's2', project_id: 'p1', title: 'Write a request function', description: 'Fetch and parse the JSON.', status: 'todo', sort_order: 1 },
        { id: 's3', project_id: 'p1', title: 'Visualize the result', description: 'Plot the forecast.', status: 'todo', sort_order: 2 }
      ]
    })),
    updateStep: () => Promise.resolve(),
    complete: () => delay(500).then(() => '## 🎉 Summary\nYou built an end-to-end data project.\n## 🚀 Next Steps\nAdd caching and a nicer chart.'),
    stepHistory: () => Promise.resolve([]),
    stepChat: (p: { channelId: string }) => { streamReply(p.channelId, "What do you *expect* that line to return, and what does it actually return?"); return Promise.resolve({ success: true }) }
  },
  defense: {
    questions: () => delay(500).then(() => ['Design a recommendation system end to end — walk me through data to deployment.']),
    grade: () => delay(500).then(() => ({ score: 78, logicGaps: ['Jumped from collaborative filtering to cold-start without covering matrix factorization.'], missingPoints: ['Evaluation metric choice'], accuracy: 'Concepts mostly accurate.', overall: 'Solid structure — tighten the middle derivation.' })),
    export: (p: { content: string }) => Promise.resolve(download('defense-report.md', p.content))
  },
  bottleneck: {
    check: () => Promise.resolve([]),
    report: () => delay(400).then(() => '## 📍 Stuck Node\nBackpropagation\n## ❓ Questions\nWhy does the gradient vanish in deep nets?'),
    export: (c: string) => Promise.resolve(download('bottleneck.md', c))
  },
  tree: {
    getNodes: () => Promise.resolve(NODES),
    updateStatus: () => Promise.resolve(),
    upsertNode: () => Promise.resolve(),
    explainNecessity: () => delay(500).then(() => 'This node is a prerequisite: without it later concepts become "parameter-tuning magic". Master it first.'),
    reparent: () => Promise.resolve({ success: true }),
    reorder: () => Promise.resolve(),
    addNode: () => Promise.resolve('new'),
    deleteNode: () => Promise.resolve(),
    export: (id: string) => Promise.resolve(download('knowledge-tree.json', JSON.stringify({ subject: SUBJECT, nodes: NODES }, null, 2))),
    import: () => Promise.resolve(null)
  },
  node: {
    primer: (p: { nodeId: string; nodeName: string }) => {
      const primer = [
        `Let's get oriented on **${p.nodeName}** before diving in.`,
        '',
        '**What it is** — the core idea in one intuitive sentence.',
        "**Why it matters** — where you'll actually use it downstream.",
        "**What you already know** — it builds on concepts you've mastered.",
        '**A common pitfall** — the mistake most beginners make here.',
        '',
        '> 💡 In the desktop app this primer is generated live by your own AI and adapts to what you already know.'
      ].join('\n')
      HISTORY[p.nodeId] = [{ id: 'primer-' + p.nodeId, role: 'assistant', content: primer }, ...(HISTORY[p.nodeId] || [])]
      return delay(500).then(() => primer)
    }
  },
  resources: {
    find: (nodeName: string) => delay(600).then(() => ({
      configured: true,
      items: [
        { title: `${nodeName} — overview`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(nodeName)}`, source: 'wikipedia.org', why: 'A solid, neutral overview to orient yourself.' },
        { title: `${nodeName} explained (video)`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(nodeName + ' tutorial')}`, source: 'youtube.com', why: 'Visual walkthrough for intuition.' }
      ],
      suggestion: ''
    }))
  },
  chat: {
    getHistory: (nodeId: string) => Promise.resolve(HISTORY[nodeId] || []),
    clear: () => Promise.resolve(),
    send: (p: { channelId: string }) => { streamReply(p.channelId, scriptedAnswer()); return Promise.resolve({ success: true }) },
    onStream: (channelId: string, cb: (d: { delta: string; done: boolean; full?: string }) => void) => {
      streamHandlers.set(channelId, cb)
      return () => streamHandlers.delete(channelId)
    },
    onSearch: () => () => {}
  },
  explore: {
    chat: (p: { channelId: string }) => { streamReply(p.channelId, 'Ask me anything — in the demo this is a scripted reply. In the app it is an unconstrained chat with your model.'); return Promise.resolve({ success: true }) }
  },
  errors: {
    getAll: () => Promise.resolve([
      { id: 'e1', node_id: 'overfit', node_name: 'Overfitting & Regularization', error_type: 'ConceptConfusion', error_content: 'Mixed up L1 and L2 regularization effects.', created_at: '2026-06-28 21:00' },
      { id: 'e2', node_id: 'grad', node_name: 'Gradient Descent', error_type: 'ApplicationError', error_content: 'Chose too large a learning rate.', created_at: '2026-06-27 20:10' }
    ])
  },
  lecture: {
    getStyle: () => Promise.resolve('intuitive'),
    setStyle: () => Promise.resolve()
  },
  learning: {
    complete: () => Promise.resolve({})
  },
  streak: {
    get: () => Promise.resolve({ count: 5, longest: 12, active: false, atRisk: true, broken: false, freezes: 2 })
  },
  recap: {
    get: () => Promise.resolve({
      due: false,
      recap: {
        title: 'How far you came this week',
        lines: [
          'Lit up 3 new nodes: Linear Algebra, Python Programming, NumPy & Pandas',
          '7 sessions, 210 minutes in total',
          '78% average accuracy',
          '5-day streak — keep it rolling 🔥'
        ],
        empty: false
      }
    }),
    markShown: () => Promise.resolve()
  },
  warmup: {
    generate: () => delay(700).then(() => [
      {
        question: 'Gradient descent updates parameters in which direction?',
        options: ['Along the gradient', 'Opposite the gradient', 'Perpendicular to it', 'Randomly'],
        correctIndex: 1,
        nodeName: 'Gradient Descent'
      },
      {
        question: 'A learning rate that is far too large usually causes what?',
        options: ['Divergence / oscillation', 'Perfect convergence', 'Slower but safer descent', 'No effect'],
        correctIndex: 0,
        nodeName: 'Gradient Descent'
      },
      {
        question: 'Which regularizer tends to drive weights exactly to zero?',
        options: ['L2', 'L1', 'Dropout', 'BatchNorm'],
        correctIndex: 1,
        nodeName: 'Overfitting & Regularization'
      },
      {
        question: 'In NumPy, what does broadcasting let you do?',
        options: ['Send data over a network', 'Operate on arrays of different shapes', 'Compile to C', 'Shuffle rows'],
        correctIndex: 1,
        nodeName: 'NumPy & Pandas'
      },
      {
        question: 'Matrix multiplication A(m×n)·B(n×p) yields a matrix of what shape?',
        options: ['m×n', 'n×p', 'm×p', 'p×m'],
        correctIndex: 2,
        nodeName: 'Linear Algebra'
      }
    ]),
    complete: () => Promise.resolve({ count: 6, longest: 12, active: true, atRisk: false, broken: false, freezes: 2 })
  },
  dashboard: {
    coverage: () => Promise.resolve({ total: 15, mastered: 6, learning: 3, percent: 40 }),
    risks: () => Promise.resolve([
      { node_id: 'linalg', name: 'Linear Algebra', risk: 0.72, daysUntilDue: -1, lastReviewedAt: null },
      { node_id: 'numpy', name: 'NumPy & Pandas', risk: 0.55, daysUntilDue: 1, lastReviewedAt: null }
    ]),
    accuracy: () => Promise.resolve(
      ['06-26', '06-27', '06-28', '06-29', '06-30', '07-01', '07-02'].map((d, i) => ({ day: `2026-${d}`, accuracy: 0.6 + i * 0.04, count: 3 }))
    ),
    heatmap: () => Promise.resolve(
      [[1, 21, 3], [2, 21, 4], [3, 9, 2], [3, 21, 5], [4, 21, 3], [6, 15, 4], [0, 21, 2]].map(([weekday, hour, count]) => ({ weekday, hour, count }))
    ),
    bestTime: () => Promise.resolve([{ hour: 21, accuracy: 0.86, count: 12 }, { hour: 9, accuracy: 0.63, count: 8 }])
  },
  contrast: {
    check: () => Promise.resolve(null),
    generate: () => delay(600).then(() => ({
      errorType: 'ConceptConfusion',
      conceptA: { title: 'L1 Regularization', explanation: 'Drives some weights to exactly zero — feature selection.' },
      conceptB: { title: 'L2 Regularization', explanation: 'Shrinks all weights smoothly toward zero, none exactly zero.' },
      question: 'You have 100 features and want to auto-select ~10 key ones. Which do you use?',
      options: ['L1', 'L2', 'Neither'],
      correctIndex: 0,
      explanation: 'L1 induces sparsity, zeroing out irrelevant features.'
    })),
    submit: (p: { chosenIndex: number; correctIndex: number }) => Promise.resolve({ correct: p.chosenIndex === p.correctIndex, feedback: p.chosenIndex === p.correctIndex ? 'Correct!' : 'Not quite — L1 is the sparse one.' }),
    onAvailable: () => () => {}
  },
  search: {
    getConfig: () => Promise.resolve({ provider: 'none', searxngUrl: '', configured: false }),
    setConfig: (cfg: { provider: string }) => Promise.resolve(cfg.provider !== 'none'),
    test: () => delay(500).then(() => ({ success: true }))
  },
  summary: {
    generate: () => delay(600).then(() => '## 🌱 New Concepts\n- Gradient descent, learning rate\n## 🔗 Connections\nPairs with the loss function you learned earlier.\n## 🎯 Tomorrow\nApply it to linear regression.'),
    save: (p: { content: string }) => Promise.resolve(download('summary.md', p.content))
  },
  daily: {
    getTasks: () => Promise.resolve([
      { id: 't1', task_type: 'core', node_id: 'grad', title: 'Core: Gradient Descent', description: 'Understand the update rule and learning rate.', estimated_minutes: 30, status: 'pending', feedback: null, task_date: '' },
      { id: 't2', task_type: 'review', node_id: 'linalg', title: 'Review: Linear Algebra', description: 'Refresh matrix multiplication.', estimated_minutes: 10, status: 'pending', feedback: null, task_date: '' },
      { id: 't3', task_type: 'explore', node_id: null, title: 'Explore: an AI ethics article', description: '5-minute read to widen perspective.', estimated_minutes: 5, status: 'pending', feedback: null, task_date: '' }
    ]),
    generate: () => delay(600).then(() => [
      { id: 't1', task_type: 'core', node_id: 'grad', title: 'Core: Gradient Descent', description: 'Understand the update rule and learning rate.', estimated_minutes: 30, status: 'pending', feedback: null, task_date: '' },
      { id: 't2', task_type: 'review', node_id: 'linalg', title: 'Review: Linear Algebra', description: 'Refresh matrix multiplication.', estimated_minutes: 10, status: 'pending', feedback: null, task_date: '' },
      { id: 't3', task_type: 'explore', node_id: null, title: 'Explore: an AI ethics article', description: '5-minute read.', estimated_minutes: 5, status: 'pending', feedback: null, task_date: '' }
    ]),
    updateTask: () => Promise.resolve(),
    feedback: () => Promise.resolve(0)
  },
  file: {
    choose: () => Promise.resolve(null),
    parse: () => Promise.resolve({ text: '', filename: '' }),
    generateOutline: () => delay(400).then(() => '# Outline\n(File parsing is desktop-only; try it in the app.)')
  },
  data: {
    export: () => Promise.resolve(false),
    openExternal: (url: string) => { window.open(url, '_blank', 'noopener'); return Promise.resolve() }
  },
  pref: {
    get: (key: string) => Promise.resolve(PREFS[key] ?? (key.startsWith('goal:') ? 'Build a recommender system on my own' : null)),
    set: (key: string, value: string) => { PREFS[key] = value; return Promise.resolve() }
  },
  spark: {
    get: () => delay(400).then(() => ({
      text: 'The "entropy" you met in decision trees is the same idea that sets the limit of every zip file.'
    }))
  },
  material: {
    fetch: (p: { url: string }) => delay(800).then(() => {
      const id = Math.random().toString(36).slice(2)
      SOURCES.unshift({ id, subject_id: SUBJECT.id, kind: 'url', title: p.url, origin: p.url, status: 'ingested', chunk_count: 6, token_estimate: 4200, created_at: '' })
      return { enabled: true, sourceId: id, chunks: 6, title: p.url }
    }),
    suggest: () => delay(700).then(() => [
      { title: 'Official documentation', url: 'https://example.com/docs', why: 'The authoritative reference — always current.', kind: 'doc' },
      { title: 'A well-regarded textbook (PDF)', url: 'https://example.com/book.pdf', why: 'Builds the concepts from the ground up.', kind: 'book' },
      { title: 'Hands-on tutorial series', url: 'https://example.com/tutorial', why: 'Learn by doing, with worked examples.', kind: 'tutorial' },
      { title: 'Practice question bank', url: 'https://example.com/practice', why: 'Test yourself with realistic scenarios.', kind: 'practice' }
    ])
  },
  rag: {
    ingest: (p: { title: string; text: string }) => delay(500).then(() => {
      const id = Math.random().toString(36).slice(2)
      const chunks = Math.max(1, Math.round(p.text.length / 1200))
      SOURCES.unshift({ id, subject_id: SUBJECT.id, kind: 'txt', title: p.title, origin: null, status: 'ingested', chunk_count: chunks, token_estimate: Math.round(p.text.length / 4), created_at: '' })
      return { sourceId: id, chunks }
    }),
    list: () => Promise.resolve(SOURCES),
    delete: (id: string) => { const i = SOURCES.findIndex(s => s.id === id); if (i >= 0) SOURCES.splice(i, 1); return Promise.resolve({ success: true }) },
    autoFetchEnabled: () => Promise.resolve(PREFS['auto_fetch_enabled'] === '1'),
    treeFromMaterials: () => delay(900).then(() => ({ success: true, nodes: 18 }))
  },
  app: {
    getVersion: () => Promise.resolve('demo')
  },
  lan: {
    info: () => Promise.resolve({ hasCredentials: false, enabled: false, running: false, port: 8735, ips: [] }),
    setup: () => Promise.resolve(true),
    enable: () => Promise.resolve({ running: false, error: 'demo' }),
    sessions: () => Promise.resolve([]),
    revoke: () => Promise.resolve({ revoked: false })
  },
  isWeb: false
}
