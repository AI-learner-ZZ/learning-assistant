# Learning Assistant

*[中文文档 →](README.zh-CN.md)*

An offline-first, conversation-driven desktop companion for **deep, systematic self-study**. You pick a field, get a personalized knowledge tree, and learn one node at a time through a Socratic AI tutor that questions you instead of handing over answers. All data stays on your machine.

Built with Electron + React + TypeScript. Bring your own OpenAI-compatible API key (OpenAI, DeepSeek, or any custom base URL).

---

## Getting Started

### Install & run from source

```bash
npm install
npm run dev
```

On first launch a short **setup wizard** asks for:

1. **Language & theme** — Chinese / English, light / dark.
2. **AI provider & API key** — OpenAI, DeepSeek, or a custom base URL. The key is encrypted with Electron `safeStorage` and never written in plaintext or logs.
3. **Data directory** — where your local SQLite database lives (default is fine).

Then you land on the **knowledge seed** screen: type a field ("Artificial Intelligence", "Nutrition", "Photography composition", …) and the AI generates a starter knowledge tree — or pick one of the built-in subjects to start instantly.

### Build a distributable

```bash
npm run build      # compile main + preload + renderer
npm run package    # produce an installer in dist/ (Windows .exe / macOS .dmg / Linux AppImage+deb)
```

---

## How to Use

### 1. Grow your knowledge tree
The left panel shows a left-to-right tree of skills. Nodes are **locked → learning → mastered**. Click a node to open its learning session on the right. In **edit mode** you can drag to re-parent nodes (cycles are blocked), add or delete nodes, and import/export a subject as JSON. Right-click actions let you **skip** a node or **challenge** why it matters (the AI explains).

### 2. Learn through Socratic dialogue
The tutor never just dumps answers — it probes your reasoning, then teaches in short steps. Key behaviors:

- **Forced questioning** — when the tutor asks you something it marks it `[QUESTION]`; the input stays locked until you answer.
- **Multi-perspective switch** — toggle *Intuitive / Formula / Analogy* explanations; your preference is remembered.
- **Rich rendering** — Markdown, syntax-highlighted code, KaTeX math, **Mermaid** flowcharts, and **SVG** illustrations (for spatial/visual topics like composition grids or the golden spiral) are rendered inline.
- **Web search** (optional) — configure SerpAPI / Bing / SearXNG and the tutor can fetch live facts with dual-source verification.
- **End session** — generate a "cognitive summary" card (new concepts, links to prior knowledge, tomorrow's preview) that you can save as a Markdown note.

### 3. Practice, review, and stay on track
- **Today** — three daily cards (core / review / explore). Difficulty adapts to your *too hard / too easy* feedback; high forgetting-risk nodes are auto-inserted for review.
- **Errors** — mistakes are auto-logged and typed. When one type recurs, a **contrast-learning workshop** pops up to help you disambiguate two confusable concepts.
- **Dashboard** — knowledge coverage ring, forgetting-risk list (one-click review), recent accuracy trend, best-time-of-day analysis, and a study-time heatmap.
- **Project Workshop** — once coverage passes a threshold, a capstone project unlocks; the AI breaks it into steps and guides debugging by asking questions rather than fixing your code.
- **Mock Defense** — an AI examiner poses scenario questions (voice or text answers) and scores your reasoning completeness; export the report.
- **Free Explore** — an unconstrained chat entry; linger too long and it offers to turn the topic into a parallel minor subject.
- **Bottleneck report** — if you stay stuck on a node, generate a shareable Markdown "stuck report" to ask a human for help.

### Resizing & focus
Drag the divider to resize the two panels, or collapse the left panel entirely for a distraction-free learning view.

---

## Architecture

```
src/
  main/                 Electron main process (Node)
    index.ts            Window creation + all IPC handlers
    database.ts         Local SQLite (node-sqlite3-wasm) schema & queries
    settings.ts         Preferences + safeStorage-encrypted API keys
    aiService.ts        OpenAI-compatible calls, system prompts, streaming
    spacedRepetition.ts SM-2 scheduling + Ebbinghaus forgetting risk
    dailyPlanner.ts     Adaptive daily plan (risk injection + difficulty)
    errorAnalysis.ts    Contrast-learning trigger
    treeValidator.ts    Cycle detection for tree edits
    searchService.ts    SerpAPI / Bing / SearXNG
    bottleneckDetector.ts
    fileParser.ts       PDF / DOCX / TXT extraction
    templateLoader.ts   Built-in subject templates
  preload/index.ts      contextBridge — the only renderer↔main channel
  renderer/src/         React UI (Zustand stores, shadcn/ui, React Flow, Recharts)
resources/templates/    Subject knowledge-tree JSON files
```

**Principles**

- **Local-first & private.** Everything persists to a single local SQLite file. The renderer never touches the database directly — all access goes through typed IPC exposed via `contextBridge`. API keys are encrypted at rest with `safeStorage`.
- **Bring-your-own model.** The AI layer targets any OpenAI-compatible endpoint; responses stream token-by-token to the UI.
- **Learning science, not just chat.** A simplified SM-2 algorithm and an Ebbinghaus decay model drive review scheduling; the Socratic system prompt enforces questioning, scoring, error typing, and structured output (Markdown / KaTeX / Mermaid / SVG).
- **The tree is a contract.** The knowledge tree is an editable dependency graph you negotiate with, not a fixed syllabus.

## Tech Stack

Electron 35 · electron-vite · React 18 · TypeScript (strict) · Tailwind CSS + shadcn/ui · Zustand · React Flow · Recharts · node-sqlite3-wasm · openai · react-markdown / rehype-katex / rehype-highlight · Mermaid · DOMPurify · pdf-parse · mammoth.

## Troubleshooting

**App fails to start with `Cannot read properties of undefined (reading 'whenReady')`** — some environments set `ELECTRON_RUN_AS_NODE=1` globally, which makes Electron boot as plain Node.js. `npm run dev` / `npm start` launch through `scripts/launch.mjs`, which deletes that variable in the child process, so this is handled automatically.

## License

MIT
