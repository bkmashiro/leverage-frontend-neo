export const TUTORIAL_TRACKS = [
  {
    id: 'bot', title: '我的第一个 Bot', shortTitle: 'Bot 入门',
    desc: '理解输入与输出，写出可测试的 Bot。', level: '入门',
    chapters: ['Bot 是如何工作的', '写你的第一个 Bot', '调试信息与 JSON 输出', '理解 BotInput', '测试与保存 Bot'],
  },
  {
    id: 'judge', title: '编写自定义裁判', shortTitle: '裁判开发',
    desc: '设计规则、处理异常并测试游戏。', level: '进阶',
    chapters: ['裁判是什么', '写猜数字裁判', '处理异常输入', '测试与发布游戏'],
  },
  {
    id: 'renderer', title: '自定义游戏渲染器', shortTitle: '游戏可视化',
    desc: '呈现对局，支持真人交互与回放。', level: '进阶',
    chapters: ['渲染器是什么', '写最小渲染器', '支持真人交互', '发布到游戏'],
  },
] as const

export type TutorialTrack = (typeof TUTORIAL_TRACKS)[number]['id']
