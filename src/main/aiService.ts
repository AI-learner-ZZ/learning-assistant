import OpenAI from 'openai'
import { getApiKey, getSetting } from './settings'
import { parseSpark } from './spark'

let client: OpenAI | null = null

function getClient(): OpenAI {
  const key = getApiKey()
  if (!key) throw new Error('API key not configured')
  const baseURL = getSetting('apiBaseUrl') || 'https://api.openai.com/v1'
  if (!client || client.baseURL !== baseURL) {
    client = new OpenAI({ apiKey: key, baseURL })
  }
  return client
}

export function resetClient(): void {
  client = null
}

const EMBEDDING_MODEL = 'text-embedding-3-small'

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const openai = getClient()
  const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts })
  return resp.data.map(d => d.embedding as number[])
}

export interface MaterialSuggestion {
  title: string
  url: string
  why: string
  kind: string
}

export function parseMaterials(raw: string): MaterialSuggestion[] {
  const parsed = extractJson<unknown>(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((item): item is MaterialSuggestion => {
      const m = item as MaterialSuggestion
      return !!m && typeof m.title === 'string' && m.title.trim().length > 0 && typeof m.url === 'string' && m.url.trim().length > 0
    })
    .map(m => ({
      title: m.title.trim(),
      url: m.url.trim(),
      why: typeof m.why === 'string' ? m.why : '',
      kind: typeof m.kind === 'string' ? m.kind : 'doc'
    }))
    .slice(0, 12)
}

export async function suggestMaterials(
  subjectName: string,
  language: string,
  searchResults: { title: string; url: string }[] = []
): Promise<MaterialSuggestion[]> {
  const openai = getClient()
  const isZh = language === 'zh'
  const refs = searchResults.length
    ? (isZh ? '\n可参考这些真实链接（优先用真实存在的 URL）：\n' : '\nReal links you may reuse (prefer URLs that actually exist):\n') +
      searchResults.slice(0, 8).map(r => `- ${r.title} ${r.url}`).join('\n')
    : ''
  const prompt = isZh
    ? `学习者想系统学习「${subjectName}」。推荐 5-8 份高质量、权威、稳定的学习材料（官方文档、经典教材、优质教程、练习来源）。${refs}
严格以 JSON 数组返回，不要其他文字：
[{"title":"名称","url":"链接","why":"一句话为什么推荐","kind":"doc|book|tutorial|practice"}]`
    : `The learner wants to systematically learn "${subjectName}". Recommend 5-8 high-quality, authoritative, stable study materials (official docs, classic textbooks, strong tutorials, practice sources).${refs}
Return a strict JSON array only, no other text:
[{"title":"...","url":"...","why":"one-line reason","kind":"doc|book|tutorial|practice"}]`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 900
  })
  return parseMaterials(resp.choices[0].message.content || '[]')
}

function chatModel(): string {
  return getSetting('apiProvider') === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'
}

export type LectureStyle = 'intuitive' | 'formula' | 'analogy'
export type TeachingStance = 'novice' | 'learning' | 'advanced'

const STANCE_ZH: Record<TeachingStance, string> = {
  novice: '【教学姿态：直接教学（新手）】学习者对本节几乎零基础。请先用清晰、具体的语言**直接把核心概念讲清楚**——是什么、为什么重要、怎么用；给一个"示范例"(worked example)和一个生活类比。讲完后**只**问一个简单的确认性问题（[QUESTION]）检查是否听懂。切勿一上来就反问，也不要期待他自行推导。',
  learning: '【教学姿态：半教半问（进行中）】学习者已有初步基础。讲一半、留一半：给出关键线索或框架，再用 [QUESTION] 引导他补全剩下的推理。',
  advanced: '【教学姿态：苏格拉底式（接近掌握）】学习者已基本掌握。不直接给答案，先用 [QUESTION] 追问其思路，引导其自行推导与深化，仅在其卡住时给最小提示。'
}
const STANCE_EN: Record<TeachingStance, string> = {
  novice: '[TEACHING STANCE: Direct instruction (novice)] The learner is near-zero on this node. First **explain the core concept clearly and concretely** — what it is, why it matters, how to use it; give one worked example and one everyday analogy. Then ask ONE simple check question ([QUESTION]) to confirm understanding. Do NOT open with a probing question or expect them to derive it.',
  learning: '[TEACHING STANCE: Half-teach, half-ask (in progress)] The learner has some basis. Teach half, leave half: give the key clue or framework, then use [QUESTION] to guide them to complete the reasoning.',
  advanced: '[TEACHING STANCE: Socratic (near mastery)] The learner mostly has it. Do not give answers directly; probe their reasoning with [QUESTION] first, guiding them to derive and deepen, giving minimal hints only when stuck.'
}

const STYLE_INSTRUCTION_ZH: Record<LectureStyle, string> = {
  intuitive: '本次讲解请用"直觉版"：用最朴素的生活直觉和画面感来解释，避免公式与术语。',
  formula: '本次讲解请用"公式版"：给出严谨的数学推导与形式化定义，适合进阶。',
  analogy: '本次讲解请用"类比版"：用用户熟悉领域（如健身、烹饪、游戏）的类比来解释概念。'
}
const STYLE_INSTRUCTION_EN: Record<LectureStyle, string> = {
  intuitive: 'Use the "intuitive" style: explain with plain everyday intuition and mental imagery, avoid formulas and jargon.',
  formula: 'Use the "formula" style: give rigorous mathematical derivations and formal definitions, for advanced learners.',
  analogy: 'Use the "analogy" style: explain concepts via analogies from a domain the user knows (fitness, cooking, games).'
}

export function buildLearnerContext(input: {
  recentlyMastered?: string[]
  strugglingWith?: string[]
  streakDays?: number
  language?: string
}): string {
  const isZh = (input.language || 'zh') === 'zh'
  const parts: string[] = []
  if (input.streakDays && input.streakDays > 1) {
    parts.push(isZh ? `已连续学习 ${input.streakDays} 天` : `on a ${input.streakDays}-day learning streak`)
  }
  if (input.recentlyMastered?.length) {
    const list = input.recentlyMastered.slice(0, 3).join(isZh ? '、' : ', ')
    parts.push(isZh ? `最近掌握了：${list}` : `recently mastered: ${list}`)
  }
  if (input.strugglingWith?.length) {
    const list = input.strugglingWith.slice(0, 3).join(isZh ? '、' : ', ')
    parts.push(isZh ? `常在这些方面出错：${list}` : `tends to slip on: ${list}`)
  }
  if (parts.length === 0) return ''
  const body = parts.join(isZh ? '；' : '; ')
  return isZh
    ? `【关于这位学习者】${body}。请自然地体现你记得他的历程：适时肯定进步、点名薄弱点，让他感到被记住、被鼓励。`
    : `[ABOUT THIS LEARNER] ${body}. Naturally show you remember their journey: acknowledge progress, gently name weak spots, and make them feel remembered and encouraged.`
}

export function buildSystemPrompt(context: {
  nodeName?: string
  nodeDescription?: string
  learnedNodes?: string[]
  weakPoints?: string[]
  language?: string
  lectureStyle?: LectureStyle
  difficulty?: string
  searchEnabled?: boolean
  mastery?: TeachingStance
  learnerContext?: string
  retrievedContext?: string
}): string {
  const lang = context.language || 'zh'
  const isZh = lang === 'zh'
  const stance = context.mastery || 'learning'
  const stanceStr = (isZh ? STANCE_ZH : STANCE_EN)[stance]
  const learnerStr = context.learnerContext ? `\n\n${context.learnerContext}` : ''
  const retrievedStr = context.retrievedContext ? `\n\n${context.retrievedContext}` : ''

  const learnedStr = context.learnedNodes?.length
    ? (isZh ? `\n已掌握节点: ${context.learnedNodes.join('、')}` : `\nMastered: ${context.learnedNodes.join(', ')}`)
    : ''
  const weakStr = context.weakPoints?.length
    ? (isZh ? `\n薄弱点: ${context.weakPoints.join('、')}` : `\nWeak points: ${context.weakPoints.join(', ')}`)
    : ''
  const nodeCtx = context.nodeName
    ? (isZh ? `\n当前学习节点: ${context.nodeName}${context.nodeDescription ? ` — ${context.nodeDescription}` : ''}` : `\nCurrent node: ${context.nodeName}${context.nodeDescription ? ` — ${context.nodeDescription}` : ''}`)
    : ''

  const styleStr = context.lectureStyle
    ? '\n' + (isZh ? STYLE_INSTRUCTION_ZH : STYLE_INSTRUCTION_EN)[context.lectureStyle]
    : ''
  const difficultyStr = context.difficulty
    ? (isZh ? `\n难度等级：${context.difficulty}` : `\nDifficulty level: ${context.difficulty}`)
    : ''

  const searchRuleZh = context.searchEnabled
    ? '\n9. 联网搜索：当你需要实时信息或精确事实数据（最新论文、当前统计数据等）时，单独输出一行 FUNCTION_CALL:search:你的查询关键词，系统会执行搜索并把结果回传给你，再继续作答。'
    : '\n9. 无联网能力：你当前无法联网。涉及实时数据时，明确提示"建议开启搜索功能或手动提供数据"，不要编造。'
  const searchRuleEn = context.searchEnabled
    ? '\n9. Web search: when you need real-time info or precise facts (latest papers, current stats), output a single line FUNCTION_CALL:search:your query. The system will run the search and return results for you to continue.'
    : '\n9. No web access: you cannot browse. For real-time data, say "consider enabling web search or provide the data manually" — never fabricate.'

  if (isZh) {
    return `你是用户专属的自适应学习导师，精通认知科学与系统学习法。

${stanceStr}${learnerStr}

【铁律】
1. 教学姿态优先：严格遵循上面的【教学姿态】——对新手先直接把概念讲清楚、给示范例，别一上来就反问；对进阶者才用追问逼其推导。
2. 强制追问：当你需要用户回答时，在问题前加 [QUESTION] 标记，格式：[QUESTION] 你的问题内容。用户必须回答后对话才能继续。
3. 判分与记录：在追问结束后，评估用户回答，用如下格式输出：[SCORE] 正确|部分正确|错误 [ERROR_TYPE] 概念混淆|计算错误|应用偏差|无（若无错误则为"无"）
4. 循序渐进：讲解不超过500字，先给直觉理解再给公式。
5. 知识连通：每讲完一个概念，主动指出它与已学概念的联系。
6. 防幻觉：涉及具体数据、年代、论文引用时，明确标注"建议核实"。
7. 学习小结：当用户明确表示本节学完，输出 [SUMMARY] 开头的一段摘要，包含：新概念、与旧知识的连接、明日建议。
8. 善用图示（系统会自动渲染）：
   - 流程/结构/关系/时序/层级 → 用 \`\`\`mermaid 代码块（graph TD、sequenceDiagram、mindmap、pie 等），节点文字简短。
   - 空间/视觉/几何/美学类（构图网格、三分法、黄金螺旋、色环、版式布局、几何作图、带标注示意图）→ 用 \`\`\`svg 代码块，输出自包含的 <svg>（带 viewBox、width/height 不超过 600、用 <text> 标注），用于 mermaid 表达不了的可视化。${searchRuleZh}

【排版要求】始终用规范的 Markdown 输出，让内容清晰易读（应用已支持渲染）：
- **加粗**标出关键术语与结论；用*斜体*表示强调或术语的原文。
- 用 ## / ### 标题组织较长的讲解；用有序/无序列表拆分步骤与要点。
- 提示、注意、易错点用引用块（\`> 💡 小贴士…\` / \`> ⚠️ 注意…\`）。
- 代码一律用带语言标注的围栏代码块（如 \`\`\`python），行内代码/变量/命令用反引号 \`code\`。
- 对比、参数、优劣用 Markdown 表格。
- 数学公式用 KaTeX：行内 $...$，独立公式 $$...$$。

【当前学习上下文】${nodeCtx}${learnedStr}${weakStr}${styleStr}${difficultyStr}${retrievedStr}

记住：对新手先讲清楚、打好地基，对进阶者才逼他思考——始终温暖、有耐心。`
  }

  return `You are the user's dedicated adaptive learning mentor, expert in cognitive science and systematic learning.

${stanceStr}${learnerStr}

[RULES]
1. Stance first: strictly follow the [TEACHING STANCE] above — for novices, explain clearly and give a worked example first (do NOT open with a probing question); only use Socratic questioning for advanced learners.
2. Forced questioning: when you need the user to answer, prefix your question with [QUESTION], format: [QUESTION] your question. The conversation cannot proceed until the user responds.
3. Scoring: after each Q&A, evaluate the response: [SCORE] Correct|Partial|Incorrect [ERROR_TYPE] ConceptConfusion|CalculationError|ApplicationError|None
4. Incremental: explanations max 500 words, intuition first, formula second.
5. Knowledge connection: after each concept, explicitly link it to previously mastered concepts.
6. Anti-hallucination: for specific data, dates, or paper citations, always add "Verify this".
7. Summary: when the user signals the session is over, output a paragraph starting with [SUMMARY] containing new concepts, connections, and tomorrow's suggestion.
8. Use diagrams (the app auto-renders them):
   - Process/structure/relationship/sequence/hierarchy → a \`\`\`mermaid block (graph TD, sequenceDiagram, mindmap, pie, etc.); keep labels short.
   - Spatial/visual/geometric/aesthetic (composition grids, rule of thirds, golden spiral, colour wheels, layout, geometry, annotated diagrams) → a \`\`\`svg block with a self-contained <svg> (viewBox, width/height ≤ 600, <text> labels) — for visuals mermaid can't express.${searchRuleEn}

[FORMATTING] Always output clean Markdown so content is easy to read (the app renders it):
- **Bold** key terms and conclusions; *italics* for emphasis or original terminology.
- Use ## / ### headings for longer explanations; ordered/unordered lists for steps and points.
- Tips, cautions, and pitfalls as blockquotes (\`> 💡 Tip…\` / \`> ⚠️ Note…\`).
- All code in fenced blocks with a language tag (e.g. \`\`\`python); inline code/vars/commands in backticks \`code\`.
- Comparisons, parameters, pros/cons as Markdown tables.
- Math in KaTeX: inline $...$, display $$...$$.

[CURRENT CONTEXT]${nodeCtx}${learnedStr}${weakStr}${styleStr}${difficultyStr}${retrievedStr}

Remember: for novices, explain clearly and build the foundation first; only push advanced learners to think — always warm and patient.`
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function streamChat(
  messages: ChatMessage[],
  emit: (channel: string, data: unknown) => void,
  channelId: string,
  systemPrompt?: string
): Promise<string> {
  const openai = getClient()
  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt })
  }
  allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

  let fullText = ''

  const stream = await openai.chat.completions.create({
    model: chatModel(),
    messages: allMessages,
    stream: true,
    max_tokens: 2000
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || ''
    if (delta) {
      fullText += delta
      emit(`chat-stream-${channelId}`, { delta, done: false })
    }
  }

  emit(`chat-stream-${channelId}`, { delta: '', done: true, full: fullText })

  return fullText
}

export async function generateDailyTasks(context: {
  currentNodeId: string | null
  currentNodeName: string | null
  unlearnedNodes: string[]
  learnedNodes: string[]
  language: string
  difficulty?: string
}): Promise<{ type: 'core' | 'review' | 'explore'; nodeId?: string; title: string; description: string; minutes: number }[]> {
  const openai = getClient()
  const isZh = context.language === 'zh'
  const difficultyLine = context.difficulty
    ? (isZh ? `\n难度要求：${context.difficulty}` : `\nDifficulty: ${context.difficulty}`)
    : ''

  const prompt = isZh
    ? `你是学习规划助手。根据以下信息为用户生成今日学习计划，以JSON数组返回，不要加其他文字。

当前节点: ${context.currentNodeName || '无'}
待学节点: ${context.unlearnedNodes.slice(0, 5).join('、') || '无'}
已掌握: ${context.learnedNodes.slice(0, 5).join('、') || '无'}${difficultyLine}

返回格式（JSON数组，3个任务）：
[
  {"type":"core","title":"核心新学：XXX","description":"具体学习内容说明","minutes":30},
  {"type":"review","title":"快速复习：XXX","description":"复习说明","minutes":10},
  {"type":"explore","title":"拓展阅读：XXX","description":"拓展内容说明","minutes":5}
]`
    : `You are a learning planner. Generate today's study plan as a JSON array, no extra text.

Current node: ${context.currentNodeName || 'none'}
Pending nodes: ${context.unlearnedNodes.slice(0, 5).join(', ') || 'none'}
Mastered: ${context.learnedNodes.slice(0, 5).join(', ') || 'none'}${difficultyLine}

Return format (JSON array, 3 tasks):
[
  {"type":"core","title":"Core: XXX","description":"What to study","minutes":30},
  {"type":"review","title":"Review: XXX","description":"What to review","minutes":10},
  {"type":"explore","title":"Explore: XXX","description":"What to explore","minutes":5}
]`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  })

  try {
    const text = resp.choices[0].message.content || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }
}

export async function generateOutline(text: string, language: string): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `请分析以下文本，提取章节目录、核心概念和逻辑关系，生成一份结构清晰的知识骨架（Markdown格式）：\n\n${text.slice(0, 6000)}`
    : `Analyze the following text, extract chapters, core concepts, and logical relations. Output a clear knowledge skeleton in Markdown:\n\n${text.slice(0, 6000)}`

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500
  })

  return resp.choices[0].message.content || ''
}

export async function explainNodeNecessity(nodeName: string, language: string): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `学生质疑"${nodeName}"这个知识节点是否必要学习。请用200字以内，说明它在整个学科体系中的必要性和与其他节点的关系。`
    : `A student is questioning whether "${nodeName}" is necessary to study. In under 200 words, explain its necessity and relation to other nodes.`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }]
  })

  return resp.choices[0].message.content || ''
}

export async function generateNodePrimer(
  nodeName: string,
  nodeDescription: string | null,
  learnedNodes: string[],
  language: string
): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const learned = learnedNodes.slice(0, 8).join(isZh ? '、' : ', ') || (isZh ? '（暂无）' : '(none yet)')
  const prompt = isZh
    ? `为一个零基础学习者写一段「${nodeName}」的**入门定向简报**（150-250字，Markdown）。${nodeDescription ? `节点简介：${nodeDescription}。` : ''}
必须包含四小节（用 **加粗** 小标题）：
- **是什么**：一句直觉性的定义
- **为什么重要 / 用在哪**
- **你已具备的基础**：结合他已掌握的：${learned}
- **一个常见误区**
语气亲切，像老师带你进门。**不要提问，不要用 [QUESTION] 标记，不要判分。**`
    : `Write an **orientation primer** for a total beginner on "${nodeName}" (150-250 words, Markdown). ${nodeDescription ? `Node blurb: ${nodeDescription}. ` : ''}
Include four short sections (bold sub-headings):
- **What it is**: one intuitive definition
- **Why it matters / where it's used**
- **What you already know**: connect to what they've mastered: ${learned}
- **One common pitfall**
Warm, welcoming tone, like a teacher easing them in. **Do NOT ask questions, do NOT use the [QUESTION] marker, do NOT score.**`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600
  })
  return resp.choices[0].message.content || ''
}

export interface ResourceItem { title: string; url: string; source: string; why: string }

export async function curateResources(
  nodeName: string,
  results: { title: string; snippet: string; url: string; source: string }[],
  language: string
): Promise<ResourceItem[]> {
  if (results.length === 0) return []
  const openai = getClient()
  const isZh = language === 'zh'
  const list = results.slice(0, 8).map((r, i) => `${i}. ${r.title} — ${r.source}\n${r.snippet}\n${r.url}`).join('\n\n')
  const prompt = isZh
    ? `学习者正在学「${nodeName}」。从以下真实搜索结果中，挑出最适合初学者的 3 个学习资源（教程/课程/讲义/优质视频/文章），每个给一句"为什么推荐"。严格以 JSON 数组返回，url 必须原样来自结果，不要编造：
[{"title":"...","url":"...","source":"...","why":"一句话理由"}]

搜索结果：
${list}`
    : `The learner is studying "${nodeName}". From these REAL search results, pick the 3 best beginner-friendly resources (tutorial/course/notes/quality video/article), each with a one-line "why". Return a strict JSON array; urls must come verbatim from the results, do not fabricate:
[{"title":"...","url":"...","source":"...","why":"one-line reason"}]

Results:
${list}`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  })
  const text = resp.choices[0].message.content || '[]'
  const m = text.match(/\[[\s\S]*\]/)
  try {
    return m ? JSON.parse(m[0]) : []
  } catch {
    return []
  }
}

export async function suggestResourceSearch(nodeName: string, language: string): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `学习者在学「${nodeName}」但未开启联网搜索。请用 100 字以内，给出 3-4 个适合搜索的关键词/资源类型建议（例如"XX 入门教程""XX 可视化 讲解"），并说明可去哪类平台找（如 YouTube、B站、经典教材、官方文档）。不要编造具体链接。`
    : `The learner is studying "${nodeName}" but web search is off. In under 100 words, suggest 3-4 search keywords/resource types (e.g. "XX beginner tutorial", "XX visual explanation") and where to look (YouTube, classic textbooks, official docs). Do NOT invent specific links.`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }]
  })
  return resp.choices[0].message.content || ''
}

export async function generateSummary(
  nodeName: string,
  conversation: ChatMessage[],
  language: string
): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const transcript = conversation
    .filter(m => m.role !== 'system')
    .slice(-20)
    .map(m => `${m.role === 'user' ? (isZh ? '学生' : 'Student') : (isZh ? '导师' : 'Tutor')}: ${m.content}`)
    .join('\n')

  const prompt = isZh
    ? `根据以下"${nodeName}"的学习对话，生成一张精炼的"今日认知小结"卡片，用 Markdown 输出，必须包含三个小标题：
## 🌱 新概念
（列出本节学到的核心概念，每条一行）
## 🔗 与旧知识的连接
（说明这些概念与之前学过内容的联系）
## 🎯 明日预告
（建议明天学习或复习什么）

对话记录：
${transcript}`
    : `Based on the following learning conversation about "${nodeName}", produce a concise "Today's Cognitive Summary" card in Markdown with exactly three sections:
## 🌱 New Concepts
## 🔗 Connections to Prior Knowledge
## 🎯 Tomorrow's Preview

Transcript:
${transcript}`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800
  })
  return resp.choices[0].message.content || ''
}

export interface ContrastWorkshop {
  errorType: string
  conceptA: { title: string; explanation: string }
  conceptB: { title: string; explanation: string }
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export async function generateContrastWorkshop(
  errorType: string,
  nodeNames: string[],
  language: string
): Promise<ContrastWorkshop> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `用户在以下知识点上反复犯"${errorType}"类型的错误：${nodeNames.join('、')}。
设计一个"对比学习工作坊"，帮助用户辨析两个最容易混淆的概念。严格以JSON返回，不要加其他文字：
{
  "conceptA": {"title": "概念A名称", "explanation": "概念A的正确解释（80字内）"},
  "conceptB": {"title": "概念B名称", "explanation": "概念B的正确解释（80字内）"},
  "question": "一道辨析选择题，描述一个场景，让用户判断该用A还是B",
  "options": ["选项0", "选项1", "选项2"],
  "correctIndex": 0,
  "explanation": "为什么这个答案正确（100字内）"
}`
    : `The user repeatedly makes "${errorType}" errors on: ${nodeNames.join(', ')}.
Design a "contrast learning workshop" to help distinguish two easily-confused concepts. Return strict JSON only:
{
  "conceptA": {"title": "Concept A", "explanation": "Correct explanation of A (<80 words)"},
  "conceptB": {"title": "Concept B", "explanation": "Correct explanation of B (<80 words)"},
  "question": "A discrimination question describing a scenario asking whether to use A or B",
  "options": ["option 0", "option 1", "option 2"],
  "correctIndex": 0,
  "explanation": "Why this answer is correct (<100 words)"
}`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6
  })
  const text = resp.choices[0].message.content || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  return { errorType, ...parsed } as ContrastWorkshop
}

export async function gradeChoice(
  question: string,
  options: string[],
  chosenIndex: number,
  correctIndex: number,
  language: string
): Promise<{ correct: boolean; feedback: string }> {
  const correct = chosenIndex === correctIndex

  const isZh = language === 'zh'
  const feedback = correct
    ? (isZh ? '回答正确！你已经能区分这两个概念了。' : 'Correct! You can now distinguish these concepts.')
    : (isZh ? `还不对。正确答案是「${options[correctIndex]}」。` : `Not quite. The correct answer is "${options[correctIndex]}".`)
  return { correct, feedback }
}

export function extractJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  const start = text.search(/[{[]/)
  if (start === -1) return fallback
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  const end = text.lastIndexOf(close)
  if (end <= start) return fallback
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return fallback
  }
}

export interface WarmupQuestion {
  question: string
  options: string[]
  correctIndex: number
  nodeName: string
}

export function parseWarmupQuestions(raw: string): WarmupQuestion[] {
  const parsed = extractJson<unknown>(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((item): item is WarmupQuestion => {
      const q = item as WarmupQuestion
      return (
        !!q &&
        typeof q.question === 'string' &&
        q.question.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every(o => typeof o === 'string') &&
        typeof q.correctIndex === 'number' &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
      )
    })
    .map(q => ({ ...q, nodeName: typeof q.nodeName === 'string' ? q.nodeName : '' }))
    .slice(0, 8)
}

export async function generateWarmup(nodeNames: string[], language: string, grounding: string[] = []): Promise<WarmupQuestion[]> {
  if (nodeNames.length === 0) return []
  const openai = getClient()
  const isZh = language === 'zh'
  const list = nodeNames.slice(0, 12).join(isZh ? '、' : ', ')
  const groundStr = grounding.length
    ? (isZh ? `\n请优先依据学习者自己的材料出题（只考材料里出现过的内容）：\n${grounding.join('\n')}` : `\nGround the questions in the learner's own materials (only test what appears in them):\n${grounding.join('\n')}`)
    : ''
  const prompt = isZh
    ? `学习者已经学过这些知识点：${list}。${groundStr}
出 5 道"快速回忆"单选题，用于 60 秒热身。要求：每题 10 秒内能答完、聚焦核心概念的主动回忆、四个选项且只有一个正确、干扰项要合理但明确错误。
严格以 JSON 数组返回，不要任何其他文字：
[{"question":"题干","options":["A","B","C","D"],"correctIndex":0,"nodeName":"对应知识点"}]`
    : `The learner has studied these topics: ${list}.${groundStr}
Write 5 rapid-recall multiple-choice questions for a 60-second warm-up. Requirements: answerable in under 10 seconds, focused on active recall of core concepts, exactly four options with only one correct, distractors plausible but clearly wrong.
Return a strict JSON array only, no other text:
[{"question":"...","options":["A","B","C","D"],"correctIndex":0,"nodeName":"topic"}]`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 1200
  })
  return parseWarmupQuestions(resp.choices[0].message.content || '[]')
}

export async function generateSpark(learnedNodes: string[], language: string): Promise<string> {
  if (learnedNodes.length < 2) return ''
  const openai = getClient()
  const isZh = language === 'zh'
  const list = learnedNodes.slice(0, 15).join(isZh ? '、' : ', ')
  const prompt = isZh
    ? `学习者最近学过这些知识点：${list}。
用一句让人"原来如此/没想到"的话，点出其中两个概念之间的意外联系，或一个反直觉的小事实，用来激发好奇心。
要求：像朋友闲聊，具体、有画面感，不超过 40 字，只输出这一句，不要引号、不要前缀。`
    : `The learner recently studied: ${list}.
In ONE surprising sentence, reveal an unexpected connection between two of these concepts, or a counter-intuitive fact, to spark curiosity.
Requirements: conversational and concrete, under 30 words, output only the sentence — no quotes, no prefix.`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 120
  })
  return parseSpark(resp.choices[0].message.content || '')
}

export interface GeneratedTreeNode {
  name: string
  description?: string
  children?: GeneratedTreeNode[]
}

export async function generateKnowledgeTree(
  domain: string,
  language: string,
  digest = ''
): Promise<{ name: string; description: string; nodes: GeneratedTreeNode[] }> {
  const openai = getClient()
  const isZh = language === 'zh'
  const digestZh = digest
    ? `\n请【严格基于学习者提供的以下材料目录】来组织这棵树，让节点尽量对应材料真实覆盖的主题，不要凭空添加材料未涉及的大块内容：\n${digest}\n`
    : ''
  const digestEn = digest
    ? `\nOrganize the tree [strictly around the learner's own materials below]; make nodes correspond to topics the materials actually cover, and do not invent large areas the materials never mention:\n${digest}\n`
    : ''
  const prompt = isZh
    ? `你是一位资深大学教授。为"零基础学习者"设计《${domain}》的系统化学习知识树，目标是达到大学本科毕业生水平。${digestZh}
要求：6-8个主分支（核心能力），每个主分支下2-4个子节点，体现由浅入深的依赖关系。
严格以JSON返回，不要加其他文字：
{
  "name": "${domain}",
  "description": "一句话学科简介",
  "nodes": [
    {"name": "主分支1", "description": "简介", "children": [
      {"name": "子节点1", "description": "简介"},
      {"name": "子节点2", "description": "简介"}
    ]}
  ]
}`
    : `You are a senior university professor. Design a systematic knowledge tree for learning "${domain}" from zero to an undergraduate-graduate level.${digestEn}
Requirements: 6-8 main branches (core competencies), each with 2-4 child nodes, reflecting a shallow-to-deep dependency order.
Return strict JSON only:
{
  "name": "${domain}",
  "description": "one-line subject intro",
  "nodes": [
    {"name": "branch 1", "description": "intro", "children": [
      {"name": "child 1", "description": "intro"}
    ]}
  ]
}`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000
  })
  const text = resp.choices[0].message.content || '{}'
  return extractJson(text, { name: domain, description: '', nodes: [] as GeneratedTreeNode[] })
}

export interface GeneratedProject {
  title: string
  description: string
  steps: { title: string; description: string }[]
}

export async function generateProject(
  subjectName: string,
  masteredNodes: string[],
  language: string
): Promise<GeneratedProject> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `学生在学习《${subjectName}》，已掌握：${masteredNodes.slice(0, 12).join('、') || '基础内容'}。
设计一个能综合运用所学的"毕业项目"，拆解成 4-6 个最小可行步骤（每步是一个可独立完成的小任务，不要直接给代码/答案）。
严格以JSON返回：
{
  "title": "项目名称",
  "description": "项目目标与产出说明（100字内）",
  "steps": [
    {"title": "步骤1标题", "description": "该步骤要做什么、产出什么"}
  ]
}`
    : `A student studying "${subjectName}" has mastered: ${masteredNodes.slice(0, 12).join(', ') || 'the basics'}.
Design a capstone project applying their knowledge, broken into 4-6 minimal viable steps (each an independently completable task; don't give code/answers).
Return strict JSON:
{
  "title": "project title",
  "description": "goal and deliverable (<100 words)",
  "steps": [ {"title": "step 1", "description": "what to do and produce"} ]
}`

  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500
  })
  const text = resp.choices[0].message.content || '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return (jsonMatch ? JSON.parse(jsonMatch[0]) : { title: subjectName, description: '', steps: [] }) as GeneratedProject
}

export function buildProjectStepPrompt(stepTitle: string, stepDescription: string, language: string): string {
  const isZh = language === 'zh'
  return isZh
    ? `你是项目导师。当前项目步骤："${stepTitle}" — ${stepDescription}。
铁律：不要直接给出完整代码或答案。当用户粘贴代码或截图报错时，用反问引导其自己调试（例如"你期望这行返回什么？实际是什么？"）。给最小可行提示，逼用户成为自己的调试者。`
    : `You are a project mentor. Current step: "${stepTitle}" — ${stepDescription}.
Rule: never give full code or answers. When the user pastes code or an error, guide debugging via questions ("what do you expect this line to return? what does it actually return?"). Give minimal hints; make the user their own debugger.`
}

export async function generateProjectReport(
  projectTitle: string,
  stepTitles: string[],
  language: string
): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const prompt = isZh
    ? `学生完成了项目《${projectTitle}》，包含步骤：${stepTitles.join('；')}。
生成一份"项目完成报告"（Markdown），包含：## 🎉 成果总结、## 💪 你展现的能力、## 🚀 后续进阶建议。`
    : `The student completed project "${projectTitle}" with steps: ${stepTitles.join('; ')}.
Generate a "Project Completion Report" (Markdown) with: ## 🎉 Summary, ## 💪 Skills Demonstrated, ## 🚀 Next Steps.`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000
  })
  return resp.choices[0].message.content || ''
}

export async function generateDefenseQuestions(
  subjectName: string,
  masteredNodes: string[],
  language: string,
  grounding: string[] = []
): Promise<string[]> {
  const openai = getClient()
  const isZh = language === 'zh'
  const groundStr = grounding.length
    ? (isZh ? `\n尽量围绕学习者自己的材料出题：\n${grounding.join('\n')}` : `\nCentre the questions on the learner's own materials:\n${grounding.join('\n')}`)
    : ''
  const prompt = isZh
    ? `你是一位严格但不带恶意的答辩评审。学生学习《${subjectName}》，已掌握：${masteredNodes.slice(0, 12).join('、') || '基础内容'}。${groundStr}
出3道"场景应用题"，要求学生综合运用知识、讲解完整思路（而非选择题）。严格以JSON数组返回：["题目1","题目2","题目3"]`
    : `You are a strict but fair defense reviewer. The student studied "${subjectName}", mastering: ${masteredNodes.slice(0, 12).join(', ') || 'basics'}.${groundStr}
Pose 3 scenario application questions requiring full reasoning (not multiple choice). Return strict JSON array: ["q1","q2","q3"]`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  })
  const text = resp.choices[0].message.content || '[]'
  const m = text.match(/\[[\s\S]*\]/)
  return m ? JSON.parse(m[0]) : []
}

export interface DefenseReport {
  score: number
  logicGaps: string[]
  missingPoints: string[]
  accuracy: string
  overall: string
}

export async function gradeDefense(
  question: string,
  answer: string,
  language: string,
  grounding: string[] = []
): Promise<DefenseReport> {
  const openai = getClient()
  const isZh = language === 'zh'
  const groundStr = grounding.length
    ? (isZh ? `\n请依据学习者自己的材料判断概念准确性（材料未覆盖处不要武断扣分）：\n${grounding.join('\n')}` : `\nJudge concept accuracy against the learner's own materials (do not penalize harshly for things the materials never cover):\n${grounding.join('\n')}`)
    : ''
  const prompt = isZh
    ? `答辩题：${question}
学生的回答：${answer}${groundStr}

作为评审，评估其"思维完整性"。严格以JSON返回：
{
  "score": 0到100的整数,
  "logicGaps": ["逻辑跳步或断点1", "..."],
  "missingPoints": ["遗漏的关键点1", "..."],
  "accuracy": "概念准确性评价（50字内）",
  "overall": "总体评语与改进建议（100字内）"
}`
    : `Defense question: ${question}
Student answer: ${answer}${groundStr}

As a reviewer, assess "thinking completeness". Return strict JSON:
{
  "score": integer 0-100,
  "logicGaps": ["logic gap 1", "..."],
  "missingPoints": ["missing key point 1", "..."],
  "accuracy": "concept accuracy note (<50 words)",
  "overall": "overall comment & improvement (<100 words)"
}`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4
  })
  const text = resp.choices[0].message.content || '{}'
  const m = text.match(/\{[\s\S]*\}/)
  return (m ? JSON.parse(m[0]) : { score: 0, logicGaps: [], missingPoints: [], accuracy: '', overall: '' }) as DefenseReport
}

export async function generateBottleneckReport(
  nodeName: string,
  errorSamples: { error_type: string; error_content: string | null }[],
  language: string
): Promise<string> {
  const openai = getClient()
  const isZh = language === 'zh'
  const errorsText = errorSamples
    .map((e, i) => `${i + 1}. [${e.error_type}] ${e.error_content ?? ''}`)
    .join('\n')
  const prompt = isZh
    ? `学生在"${nodeName}"这个知识点上反复卡住。以下是其错误记录：
${errorsText}

生成一份可以发给老师或社区求助的"卡点报告"（Markdown），包含：
## 📍 卡点节点
## 🧠 当前错误思路（推断学生可能的误解）
## 🛠 已尝试的路径
## ❓ 具体瓶颈与求助问题`
    : `A student is repeatedly stuck on "${nodeName}". Error log:
${errorsText}

Generate a "bottleneck report" (Markdown) to share with a teacher/community, with:
## 📍 Stuck Node
## 🧠 Current (mis)understanding
## 🛠 Paths Tried
## ❓ Specific Bottleneck & Questions`
  const resp = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000
  })
  return resp.choices[0].message.content || ''
}
