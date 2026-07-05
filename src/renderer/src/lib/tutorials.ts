export interface Tip {
  title: [string, string]
  body: [string, string]
}

export interface Guide {
  key: string
  name: [string, string]
  tips: Tip[]
}

export const GUIDES: Guide[] = [
  {
    key: 'welcome',
    name: ['欢迎', 'Welcome'],
    tips: [
      {
        title: ['苏格拉底式 AI 学伴', 'A Socratic AI companion'],
        body: ['选一个领域 → 得到一棵知识树 → 一个节点一个节点地学。导师不直接给答案，而是引导你思考。', 'Pick a field → get a knowledge tree → learn node by node. The tutor guides your thinking instead of handing over answers.']
      },
      {
        title: ['左树右聊', 'Tree on the left, chat on the right'],
        body: ['左侧是知识树与工具，右侧是与 AI 导师的对话。可拖动中间分隔条，或折叠左栏专注学习。', 'The left panel holds the tree and tools; the right is your chat with the tutor. Drag the divider or collapse the left panel to focus.']
      },
      {
        title: ['随时回看', 'Replay anytime'],
        body: ['这些引导可以随时在「设置 → 新手引导」里回看。', 'You can revisit these guides anytime in Settings → Onboarding.']
      }
    ]
  },
  {
    key: 'tree',
    name: ['知识树', 'Knowledge Tree'],
    tips: [
      {
        title: ['点节点开始学', 'Click a node to learn'],
        body: ['点击任意节点，右侧进入该节点的学习对话；第一次打开会先给你一段"入门简报"。', 'Click any node to open its learning chat; a fresh node greets you with an orientation primer.']
      },
      {
        title: ['节点三态', 'Three node states'],
        body: ['灰=未点亮，蓝=学习中，绿=已掌握。点击空白画布可取消选中。', 'Grey = locked, blue = learning, green = mastered. Click the empty canvas to deselect.']
      },
      {
        title: ['编辑你的树', 'Edit your tree'],
        body: ['点"编辑"可拖拽连线改父子关系、增删节点、导入/导出学科（会阻止产生环）。', 'Click "Edit" to re-parent by dragging, add/delete nodes, and import/export a subject (cycles are blocked).']
      }
    ]
  },
  {
    key: 'chat',
    name: ['对话学习', 'Learning Chat'],
    tips: [
      {
        title: ['自适应教学', 'Adaptive teaching'],
        body: ['导师会按你的掌握度调整：新手先讲清楚，进阶才追问。遇到"追问"必须作答才能继续。', 'The tutor adapts to your level: it explains first for novices and probes advanced learners. You must answer a "Question" to proceed.']
      },
      {
        title: ['顶部工具', 'Top-bar tools'],
        body: ['可切换 直觉/公式/类比 讲解风格；书签图标=找真实学习资源，书本图标=阅读模式（选中文字→讲解/考我）。', 'Switch Intuitive/Formula/Analogy styles; the bookmark finds real resources, the book opens Reading mode (select text → explain/quiz).']
      },
      {
        title: ['结束生成小结', 'End to get a summary'],
        body: ['学完点"结束学习"，会生成一张今日认知小结卡片，可保存为笔记。', 'Click "End" when done to generate a summary card you can save as a note.']
      }
    ]
  },
  {
    key: 'daily',
    name: ['今日', 'Daily'],
    tips: [
      {
        title: ['每日三张卡', 'Three daily cards'],
        body: ['点"生成课表"获得核心新学、快速复习、拓展阅读三张任务。', 'Click "Generate" for three tasks: core learning, quick review, and exploration.']
      },
      {
        title: ['难度自适应', 'Adaptive difficulty'],
        body: ['用"太难/太简单"反馈，系统会自动调整后续内容难度。', 'Use the "too hard / too easy" feedback and the difficulty of later content adapts.']
      },
      {
        title: ['自动安排复习', 'Auto-scheduled review'],
        body: ['高遗忘风险的节点会被自动排进今天的复习任务。', 'Nodes at high forgetting risk are automatically added as review tasks.']
      }
    ]
  },
  {
    key: 'dashboard',
    name: ['仪表盘', 'Dashboard'],
    tips: [
      {
        title: ['掌握全局', 'See the big picture'],
        body: ['环形图=知识覆盖度，列表=未来3天遗忘风险（可一键复习）。', 'The ring shows coverage; the list shows 3-day forgetting risk with one-click review.']
      },
      {
        title: ['学习曲线', 'Your trends'],
        body: ['折线=近7天正确率，还有最佳学习时段分析和学习时长热力图。', 'The line is 7-day accuracy, plus best-time-of-day analysis and a study-time heatmap.']
      },
      {
        title: ['项目与答辩', 'Projects & defense'],
        body: ['覆盖度达到阈值会解锁"项目工坊"；也可开"模拟答辩"检验思维完整性。', 'Hit the coverage threshold to unlock the Project Workshop; try Mock Defense to test your reasoning.']
      }
    ]
  },
  {
    key: 'errors',
    name: ['错误库', 'Error Log'],
    tips: [
      {
        title: ['自动记录错误', 'Errors logged automatically'],
        body: ['追问答错时会自动记录并分类（概念混淆/计算/应用）。', 'Wrong answers are logged and typed automatically (concept / calculation / application).']
      },
      {
        title: ['对比学习', 'Contrast learning'],
        body: ['同类错误累计到阈值，会触发"对比学习工作坊"帮你辨析易混概念。', 'When one error type recurs enough, a Contrast-Learning workshop pops up to disambiguate confusable concepts.']
      },
      {
        title: ['一键复习', 'One-click review'],
        body: ['点每条错误的"复习"直接回到该节点巩固。', 'Click "Review" on any error to jump back to that node and reinforce it.']
      }
    ]
  },
  {
    key: 'settings',
    name: ['设置', 'Settings'],
    tips: [
      {
        title: ['个性化与密钥', 'Preferences & keys'],
        body: ['在这里改语言/主题、更新 API Key、配置联网搜索。', 'Change language/theme, update your API key, and configure web search here.']
      },
      {
        title: ['本地数据', 'Local data'],
        body: ['所有数据存在本地，可随时导出备份。', 'All data stays on your machine; export a backup anytime.']
      },
      {
        title: ['回看引导', 'Replay guides'],
        body: ['忘了怎么用？在下方"新手引导"里随时回看或重新弹出。', 'Forgot something? Replay or re-trigger the guides from Onboarding below.']
      }
    ]
  }
]

export const GUIDE_MAP: Record<string, Guide> = Object.fromEntries(GUIDES.map(g => [g.key, g]))
