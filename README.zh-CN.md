# Learning Assistant（AI 学伴）

*[English →](README.md)*

一款**离线优先、对话驱动**的桌面学习伴侣，用于**深度、系统化的自学**。选一个领域，得到一棵专属知识树，在苏格拉底式 AI 导师的引导下一个节点一个节点地学 —— 它不会直接给答案，而是不断追问你的思路。所有数据都留在你自己的电脑上。

技术栈：Electron + React + TypeScript。自带 OpenAI 兼容的 API Key（OpenAI、DeepSeek，或任意自定义 base URL）。

---

## 快速开始

### 从源码安装并运行

```bash
npm install
npm run dev
```

首次启动会有一个简短的**设置向导**：

1. **语言与主题** —— 中 / 英，明亮 / 暗黑。
2. **AI 提供商与 API Key** —— OpenAI、DeepSeek 或自定义 base URL。Key 通过 Electron `safeStorage` 加密存储，绝不明文落盘或写入日志。
3. **数据目录** —— 本地 SQLite 数据库的存放位置（默认即可）。

随后进入**知识种子**页：输入一个领域（"人工智能""营养学""摄影构图"……），AI 会为你生成一棵初始知识树 —— 也可以直接选用内置学科立即开始。

### 打包安装程序

```bash
npm run build      # 编译 main + preload + renderer
npm run package    # 在 dist/ 生成安装包（Windows .exe / macOS .dmg / Linux AppImage+deb）
```

---

## 使用说明

### 1. 培育你的知识树
左侧面板是一棵从左到右生长的能力树。节点状态：**未点亮 → 学习中 → 已掌握**。点击节点即在右侧打开对应的学习会话。进入**编辑模式**后可拖拽改变父子关系（会阻止产生环）、增删节点、把学科导入/导出为 JSON。右键还能**跳过**节点或**质疑**它的必要性（AI 会解释原因）。

### 2. 在苏格拉底式对话中学习
导师不会直接抛答案 —— 它先追问你的推理，再分小步讲解。核心特性：

- **强制追问** —— 导师提问时会打上 `[QUESTION]` 标记，回答之前输入框保持锁定。
- **多视角切换** —— 在 *直觉版 / 公式版 / 类比版* 之间切换讲解风格，偏好会被记住。
- **富文本渲染** —— Markdown、语法高亮代码、KaTeX 公式、**Mermaid** 流程图、以及**SVG** 示意图（用于构图网格、黄金螺旋等空间/视觉类概念）都会内联渲染。
- **联网搜索**（可选）—— 配置 SerpAPI / Bing / SearXNG 后，导师可获取实时事实并做双源校验。
- **结束学习** —— 生成一张"认知小结"卡片（新概念、与旧知识的连接、明日预告），可保存为 Markdown 笔记。

### 3. 练习、复习、保持节奏
- **今日** —— 三张每日卡片（核心 / 复习 / 拓展）。难度会根据你的 *太难 / 太简单* 反馈自适应；高遗忘风险的节点会被自动插入复习。
- **错误** —— 错误自动记录并分类。当某类错误反复出现时，会弹出**对比学习工作坊**，帮你辨析两个易混概念。
- **仪表盘** —— 知识覆盖度环形图、遗忘风险清单（一键复习）、近期正确率趋势、最佳学习时段分析、学习时长热力图。
- **项目工坊** —— 覆盖度达到阈值后解锁毕业项目；AI 把它拆成步骤，并以反问方式引导你调试，而不是直接改代码。
- **模拟答辩** —— AI 评委给出场景题（可语音或文字作答），对你的思维完整性打分，报告可导出。
- **自由探索** —— 无约束的通用对话入口；停留过久会提示把该话题设为并行的副科。
- **卡点报告** —— 若长期卡在某节点，可生成一份可分享的 Markdown"卡点报告"，方便向真人求助。

### 调节与专注
拖动中间分隔条可调整左右比例，或直接折叠左侧面板，获得无干扰的沉浸学习视图。

---

## 架构

```
src/
  main/                 Electron 主进程（Node）
    index.ts            窗口创建 + 全部 IPC 处理器
    database.ts         本地 SQLite（node-sqlite3-wasm）表结构与查询
    settings.ts         偏好设置 + safeStorage 加密的 API Key
    aiService.ts        OpenAI 兼容调用、系统提示词、流式响应
    spacedRepetition.ts SM-2 调度 + 艾宾浩斯遗忘风险
    dailyPlanner.ts     自适应日课表（风险插入 + 难度调节）
    errorAnalysis.ts    对比学习触发
    treeValidator.ts    知识树编辑的环检测
    searchService.ts    SerpAPI / Bing / SearXNG
    bottleneckDetector.ts
    fileParser.ts       PDF / DOCX / TXT 文本提取
    templateLoader.ts   内置学科模板
  preload/index.ts      contextBridge —— 渲染进程与主进程唯一通道
  renderer/src/         React 界面（Zustand、shadcn/ui、React Flow、Recharts）
resources/templates/    学科知识树 JSON 模板
```

**设计原则**

- **本地优先、隐私安全。** 所有数据持久化到单一本地 SQLite 文件。渲染进程从不直接访问数据库 —— 全部经由 `contextBridge` 暴露的类型化 IPC。API Key 通过 `safeStorage` 加密存储。
- **自带模型。** AI 层对接任意 OpenAI 兼容端点；回复逐 token 流式推送到界面。
- **不只是聊天，更是学习科学。** 简化版 SM-2 算法与艾宾浩斯衰减模型驱动复习调度；苏格拉底系统提示词强制追问、判分、错误归类，并输出结构化内容（Markdown / KaTeX / Mermaid / SVG）。
- **知识树是一份合约。** 它是一张可编辑、可谈判的依赖图，而非固定课表。

## 技术栈

Electron 35 · electron-vite · React 18 · TypeScript（严格模式）· Tailwind CSS + shadcn/ui · Zustand · React Flow · Recharts · node-sqlite3-wasm · openai · react-markdown / rehype-katex / rehype-highlight · Mermaid · DOMPurify · pdf-parse · mammoth。

## 故障排除

**启动报错 `Cannot read properties of undefined (reading 'whenReady')`** —— 某些环境全局设置了 `ELECTRON_RUN_AS_NODE=1`，会让 Electron 以纯 Node.js 模式启动。`npm run dev` / `npm start` 通过 `scripts/launch.mjs` 启动，会在子进程中删除该变量，因此已自动规避。

## 许可证

MIT
