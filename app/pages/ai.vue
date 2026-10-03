<template>
  <div class="ai-page">
    <NCard style="max-width:800px;margin:0 auto">
      <template #header>
        <NSpace align="center" :wrap="false">
          <span style="font-size:28px">🤖</span>
          <div>
            <NText strong style="font-size:18px">Leverage OJ — AI Context</NText>
            <br />
            <NText depth="3" style="font-size:13px">提供接口说明与 MCP 配置，帮助 AI 测试和迭代你的游戏。</NText>
          </div>
        </NSpace>
      </template>

      <NAlert type="success" :show-icon="false" style="margin-bottom:20px">
        <NSpace align="center" justify="space-between">
          <div>
            <NText strong>AI 上下文链接：</NText>
            <NText code style="margin-left:8px">{{ contextUrl }}</NText>
          </div>
          <NButton size="small" @click="copyUrl">
            {{ copied ? '✅ 已复制' : '📋 复制链接' }}
          </NButton>
        </NSpace>
      </NAlert>

      <NCollapse :default-expanded-names="['workflow', 'judge', 'bot', 'api', 'mcp']">
        <NCollapseItem title="🔄 AI 工作流程" name="workflow">
          <ol style="line-height:2;margin:0;padding-left:20px">
            <li>调用 <NText code>list_examples</NText> 查看官方示例状态，或 <NText code>list_games</NText> 选择现有游戏；缺少示例时请管理员显式安装，不会自动写入。</li>
            <li>编写裁判代码（judge）实现游戏规则</li>
            <li>编写若干简单 bot 测试</li>
            <li>调用 <NText code>test_judge</NText> 运行对局，检查 rounds</li>
            <li>检查对局状态与 <NText code>analyze_match</NText> 的回合诊断；确认正常结束且分数正确，测试对局不计入 ELO。</li>
            <li>调用 <NText code>submit_judge</NText> 提交裁判</li>
            <li>编写可视化 HTML，调用 <NText code>submit_renderer</NText></li>
            <li>调用 <NText code>submit_bot</NText> 把写好的 bot 发布到榜单</li>
          </ol>
        </NCollapseItem>

        <NCollapseItem title="⚖️ 裁判协议（Judge Protocol）" name="judge">
          <NText depth="3" style="display:block;margin-bottom:8px">每轮 stdin → stdout，控制游戏流程</NText>
          <NCode :code="judgeProtocol" language="text" />
        </NCollapseItem>

        <NCollapseItem title="🤖 Bot 协议" name="bot">
          <NCode :code="botTemplate" language="python" />
        </NCollapseItem>

        <NCollapseItem title="🔌 MCP 工具列表" name="mcp">
          <NDataTable :columns="mcpCols" :data="mcpTools" :scroll-x="540" size="small" :bordered="false" />
          <NDivider />
          <p>先在本机后端目录运行 <NText code>pnpm install --frozen-lockfile</NText> 和 <NText code>pnpm build</NText>，再把下面的路径与密钥占位符替换为你的配置。stdio 服务在本机启动，网页不会替你安装或保存密钥。</p>
          <p><NuxtLink to="/settings/api-keys">管理 API 密钥</NuxtLink>：推荐使用可撤销的 API Key。旧客户端可改用 <NText code>LEVERAGE_TOKEN</NText>，但 JWT 通常 15 分钟过期；两个变量不能同时配置。不要分享含真实密钥的配置。</p>
          <NText depth="3" style="font-size:12px">MCP 客户端 stdio 配置（macOS Claude Desktop：~/Library/Application Support/Claude/claude_desktop_config.json）：</NText>
          <NCode :code="claudeConfig" language="json" style="margin-top:8px" />
        </NCollapseItem>

        <NCollapseItem title="📡 REST API 速查" name="api">
          <NDataTable :columns="apiCols" :data="apiEndpoints" :scroll-x="540" size="small" :bordered="false" />
        </NCollapseItem>

        <NCollapseItem title="🎨 渲染器协议" name="renderer">
          <NCode :code="rendererTemplate" language="html" />
        </NCollapseItem>
      </NCollapse>

      <NDivider />
      <NText depth="3" style="font-size:12px">
        机器可读纯文本端点（适合直接粘贴给 AI）：
        <NText tag="a" :href="contextUrl" target="_blank" rel="noopener noreferrer" type="primary">{{ contextUrl }}</NText>
      </NText>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import { NCard, NText, NSpace, NButton, NAlert, NCode, NCollapse, NCollapseItem, NDataTable, NDivider } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'

const config = useRuntimeConfig()
const contextUrl = computed(() => new URL(`${String(config.public.apiBase || '/api').replace(/\/$/, '')}/ai`, window.location.origin).href)
const apiUrl = computed(() => new URL(String(config.public.apiBase || '/api'), window.location.origin).href.replace(/\/$/, ''))

const copied = ref(false)
function copyUrl() {
  navigator.clipboard.writeText(contextUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const judgeProtocol = `# 每轮收到 (stdin):
{"round": N, "responses": {"0": "<bot0输出>", "1": "<bot1输出>"}}

# 每轮输出 (stdout):
{
  "commands": {"0": <给bot0的数据>, "1": <给bot1的数据>},
  "display":  <任意展示数据>,
  "verdict":  "continue" | "finish",
  "scores":   {"0": 1, "1": 0},   # 只在 finish 时提供
  "debug":    "可选调试信息"
}

# 注意：
# - 第1轮 responses 为空 {} — 仍须输出 commands
# - 记得 sys.stdout.flush()
# - finish 后进程退出`

const botTemplate = `import sys, json

while True:
    line = sys.stdin.readline()
    if not line:
        break
    data = json.loads(line)
    # data = 裁判发给你的 commands[pid]
    
    move = 0  # 你的逻辑
    
    print(json.dumps({"move": move, "debug": "思考过程"}))
    sys.stdout.flush()`

const claudeConfig = computed(() => JSON.stringify({
  mcpServers: {
    leverage: {
      command: 'node',
      args: ['/path/to/leverage-backend-neo/dist/src/mcp/leverage-mcp.js'],
      env: {
        LEVERAGE_API_KEY: '<your-api-key>',
        LEVERAGE_BASE_URL: apiUrl.value,
      },
    },
  },
}, null, 2))

const rendererTemplate = `<!DOCTYPE html>
<html>
<body>
<div id="app">等待数据...</div>
<script>
window.addEventListener('message', e => {
  if (e.data.type === 'gameLog') {
    const { gameLog, round } = e.data;
    const r = gameLog.rounds[round] || gameLog.rounds.at(-1);
    const display = r?.judgeCmd?.display || {};
    document.getElementById('app').textContent = JSON.stringify(display, null, 2);
  }
  if (e.data.type === 'gameState') {
    // 真人对局：gameState.requests 最后一项是最新裁判指令
    const latest = JSON.parse(e.data.gameState.requests.at(-1) || '{}');
    // 展示 UI，玩家操作后 window.parent.postMessage({ type: 'humanMove', move: JSON.stringify({ [String(e.data.playerIndex)]: 5 }) }, '*')
  }
});
</${'script'}>
</body>
</html>`

const mcpCols: DataTableColumns<any> = [
  { title: '工具', key: 'tool', width: 180, render: r => h(NText, { code: true }, () => r.tool) },
  { title: '说明', key: 'desc' },
]
const mcpTools = [
  { tool: 'list_games', desc: '列出所有游戏' },
  { tool: 'list_examples', desc: '公开查询官方示例安装状态，不写入数据' },
  { tool: 'install_example', desc: 'admin/sa 显式安装固定示例，需 confirm: true；重复复用原 ID，冲突不覆盖' },
  { tool: 'test_judge', desc: '用裁判+两个bot跑测试对局，返回 rounds 详情' },
  { tool: 'test_bot', desc: '用已有对手测试你的 bot' },
  { tool: 'get_leaderboard', desc: '获取游戏榜单' },
  { tool: 'list_gamers', desc: '列出游戏的所有 bot' },
  { tool: 'get_match_result', desc: '按 matchId 获取对局结果' },
  { tool: 'submit_bot', desc: '提交新 bot 到榜单' },
  { tool: 'submit_judge', desc: '更新游戏裁判代码（需 admin）' },
  { tool: 'submit_renderer', desc: '更新游戏可视化 HTML（需 admin）' },
  { tool: 'get_judge', desc: '读取当前游戏裁判代码（需 supervisor/admin/sa）' },
  { tool: 'list_matches', desc: '按游戏、Bot、状态与测试标记查询对局' },
  { tool: 'get_gamer', desc: '读取 Bot 元数据与允许访问的源码，遵守后端可见性规则' },
  { tool: 'analyze_match', desc: '读取回合指令、Bot 响应与调试信息' },
]

const apiCols: DataTableColumns<any> = [
  { title: '方法', key: 'method', width: 70 },
  { title: '路径', key: 'path', width: 240, render: r => h(NText, { code: true }, () => r.path) },
  { title: '说明', key: 'desc' },
]
const apiEndpoints = [
  { method: 'POST', path: '/auth/login', desc: '获取 JWT token' },
  { method: 'GET', path: '/compete/games', desc: '列出游戏（?page=1&perPage=20）' },
  { method: 'GET', path: '/compete/examples', desc: '查询示例是否已安装' },
  { method: 'POST', path: '/compete/examples/closest-v1/install', desc: 'admin/sa 显式安装官方示例' },
  { method: 'POST', path: '/compete/games/{id}/playground-judge', desc: '测试裁判+bot，返回 matchId' },
  { method: 'GET', path: '/compete/matches/{id}', desc: '轮询对局状态 / 获取 gameLog' },
  { method: 'GET', path: '/compete/games/{id}/judger', desc: '读取裁判代码' },
  { method: 'PATCH', path: '/compete/games/{id}', desc: '更新裁判/渲染器（admin）' },
  { method: 'GET', path: '/compete/gamers', desc: '列出 bot（?gameId=1）' },
  { method: 'POST', path: '/compete/gamers', desc: '提交新 bot' },
]
</script>

<style scoped>
.ai-page {
  padding: var(--lv-space-6) var(--lv-space-3);
  width: 100%;
  min-width: 0;
  font-family: var(--lv-font-ui);
  line-height: 1.7;
}
.ai-page :deep(.n-code) { display: block; width: 100%; max-width: 100%; overflow: auto; }
.ai-page :deep(.n-text) { overflow-wrap: anywhere; }
.ai-page p { margin: var(--lv-space-3) 0; }
</style>
