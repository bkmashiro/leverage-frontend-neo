<template>
  <div class="match-detail-page">
    <CompeteAdminViewBanner :admin-path="`/admin/compete/match/${matchId}`" />
    <NSpin :show="loading">
      <template v-if="match">
        <!-- 面包屑 -->
        <NBreadcrumb style="margin-bottom: 16px">
          <NBreadcrumbItem @click="navigateTo('/compete')">Bot 对战</NBreadcrumbItem>
          <NBreadcrumbItem v-if="match.game">
            <a v-if="Number.isSafeInteger(Number(match.game.id)) && Number(match.game.id) > 0" :href="`/compete/games/${match.game.id}`">{{ match.game.name || match.game.title }}</a>
            <span v-else>{{ match.game.name || match.game.title }}</span>
          </NBreadcrumbItem>
          <NBreadcrumbItem>对局 #{{ match.id }}</NBreadcrumbItem>
        </NBreadcrumb>

        <!-- 状态行：状态 tag + 时间（替代整张详情卡片） -->
        <NSpace align="center" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <NTag :type="statusType" size="small" :bordered="false">{{ statusLabel }}</NTag>
          <NText depth="3" style="font-size:12px">
            {{ match.createdAt ? new Date(match.createdAt).toLocaleString('zh-CN') : '' }}
          </NText>
          <NText v-if="isRunning" depth="3" style="font-size:12px">• 每 3 秒刷新</NText>
        </NSpace>

        <!-- 人类玩家输入区 -->
        <NCard
          v-if="myHumanGamer && match?.status === 1"
          style="margin-bottom: 16px; border: 2px solid #18a058"
        >
          <template #header>
            <NSpace align="center">
              <span>🎮 你的回合</span>
              <NTag size="small" type="success" :bordered="false">
                你是 {{ myHumanGamer.index === 0 ? '先手 ✕' : '后手 ○' }}
              </NTag>
            </NSpace>
          </template>

          <!-- Renderer iframe: always mounted when rendererHtml exists, hidden when not your turn -->
          <!-- cachedRendererHtml prevents srcdoc from changing on every poll (which would reload the iframe) -->
          <div
            v-if="cachedRendererHtml"
            v-show="!!humanTurn"
            style="margin-bottom:12px"
          >
            <iframe
              ref="humanRendererRef"
              :srcdoc="cachedRendererHtml"
              sandbox="allow-scripts"
              style="width:100%;height:420px;border:1px solid #e0e0e6;border-radius:8px"
              @load="onHumanRendererLoad"
            />
          </div>

          <!-- Your-turn controls (countdown + fallback board + text input) -->
          <template v-if="humanTurn">
            <NSpace align="center" style="margin-bottom:12px">
              <NText type="success" strong>轮到你了！</NText>
              <NTag :type="countdownSec > 30 ? 'success' : countdownSec > 10 ? 'warning' : 'error'" size="small">
                ⏱ {{ countdownSec }}s
              </NTag>
            </NSpace>

            <!-- Inline board fallback (no rendererHtml) -->
            <template v-if="!cachedRendererHtml">
              <div v-if="tttBoard" class="ttt-board" style="margin-bottom:16px">
                <div
                  v-for="(cell, i) in tttBoard"
                  :key="i"
                  class="ttt-cell"
                  :class="{ 'can-click': cell === 0 }"
                  @click="cell === 0 && !submittingMove && clickCell(i)"
                >
                  <span v-if="cell === 1" style="color:#d03050;font-size:22px;font-weight:bold">✕</span>
                  <span v-else-if="cell === 2" style="color:#2080f0;font-size:22px;font-weight:bold">○</span>
                  <span v-else style="color:#aaa;font-size:12px">{{ i }}</span>
                </div>
              </div>
            </template>

            <!-- Text input: shown when renderer isn't interactive (or no renderer) -->
            <NSpace v-if="!iframeInteractive" align="center" style="margin-top:4px">
              <NInput
                v-model:value="humanMove"
                placeholder='输入移动（如 {"0": 4}）'
                style="width: 300px; font-family: monospace"
                @keyup.enter="submitHumanMove"
              />
              <NButton type="primary" :loading="submittingMove" @click="submitHumanMove">提交</NButton>
            </NSpace>
          </template>

          <!-- Waiting state -->
          <template v-else>
            <NSpace align="center">
              <NSpin size="small" />
              <NText depth="3">等待对手移动中…</NText>
            </NSpace>
          </template>
        </NCard>

        <!-- 胜者 Banner -->
        <NAlert
          v-if="isCompleted && winnerInfo"
          :type="winnerInfo.isDraw ? 'warning' : 'success'"
          :show-icon="false"
          style="margin-bottom:12px;font-size:15px"
        >
          <NSpace align="center">
            <span style="font-size:20px">{{ winnerInfo.isDraw ? '🤝' : '🏆' }}</span>
            <NText strong style="font-size:15px">{{ winnerInfo.isDraw ? '平局！' : `胜者：${winnerInfo.names.join('、')}` }}</NText>
            <template v-if="parsedResult?.finalResult">
              <NDivider vertical />
              <NSpace>
                <span v-for="row in scoreRows" :key="row.key" style="font-size:13px">
                  <NText strong>{{ row.name }}</NText>：{{ row.score }}
                </span>
              </NSpace>
            </template>
          </NSpace>
        </NAlert>

        <!-- 错误信息 -->
        <NCard v-if="isFailed && match.result" title="对局失败详情" style="margin-bottom: 12px">
          <NAlert type="error" :title="failedSummary.title">
            <NDescriptions :column="1" size="small" label-placement="left" style="margin-top:8px">
              <NDescriptionsItem label="失败原因">{{ failedSummary.reason }}</NDescriptionsItem>
              <NDescriptionsItem v-if="failedSummary.botName" label="问题 Bot">{{ failedSummary.botName }}</NDescriptionsItem>
              <NDescriptionsItem v-if="failedSummary.suggestion" label="建议">{{ failedSummary.suggestion }}</NDescriptionsItem>
            </NDescriptions>
          </NAlert>
        </NCard>

        <!-- 游戏回放（优先展示，最重要的内容） -->
        <template v-if="isCompleted && gameLog">
          <NCard style="margin-bottom: 12px" :content-style="{ padding: '12px' }">
            <BotzoneGameRenderer
              :game-log="gameLog"
              :renderer-html="match.game?.rendererHtml"
              :current-round="replayRound"
            />
          </NCard>
        </template>

        <!-- 折叠的次要信息 -->
        <NCollapse style="margin-bottom: 12px">
          <NCollapseItem title="参与 Bot & 对局详情" name="details">
            <!-- 参与 Bot -->
            <NDataTable
              :columns="gamerColumns"
              :data="gamerList"
              :bordered="false"
              style="margin-bottom: 12px"
            />
            <!-- 对局结果 -->
            <template v-if="isCompleted && parsedResult">
              <NDescriptions :columns="2" bordered size="small">
                <NDescriptionsItem v-if="parsedResult.verdict" label="裁决">
                  <NTag type="info" size="small" :bordered="false">{{ parsedResult.verdict }}</NTag>
                </NDescriptionsItem>
                <NDescriptionsItem v-if="parsedResult.roundCount !== undefined" label="总回合数">
                  {{ parsedResult.roundCount }}
                </NDescriptionsItem>
                <NDescriptionsItem label="对局 ID">#{{ match.id }}</NDescriptionsItem>
                <NDescriptionsItem v-if="match.externalJobId" label="任务 ID">
                  <NText code>{{ match.externalJobId }}</NText>
                </NDescriptionsItem>
              </NDescriptions>
              <template v-if="parsedResult.finalResult && scoreRows.length">
                <NDivider title-placement="left" style="margin: 12px 0">最终得分</NDivider>
                <NDataTable :columns="scoreColumns" :data="scoreRows" :bordered="false" size="small" />
              </template>
            </template>
          </NCollapseItem>
        </NCollapse>
      </template>

      <NResult v-else-if="!loading" status="404" title="对局不存在">
        <template #footer>
          <NButton @click="navigateTo('/compete')">返回对战大厅</NButton>
        </template>
      </NResult>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag, NButton, NCollapse, NCollapseItem, NDivider } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { normalizeGameLog } from '~/utils/botzone-log'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const matchId = computed(() => Number(route.params.id))
const competeApi = useCompeteApi()

// 回放当前回合（供 GameRenderer 使用）
const replayRound = ref(0)

const match = ref<any>(null)
// Cached rendererHtml — only updates when content actually changes (prevents iframe reload on poll)
const cachedRendererHtml = ref<string>('')
watch(() => match.value?.game?.rendererHtml, (html) => {
  if (html && html !== cachedRendererHtml.value) cachedRendererHtml.value = html
}, { immediate: true })
const loading = ref(false)
let pollingTimer: ReturnType<typeof setInterval> | null = null

// status is a number: 0=PENDING, 1=RUNNING, 2=FINISHED, 3=ERROR
const MATCH_STATUS = { PENDING: 0, RUNNING: 1, FINISHED: 2, ERROR: 3 }

async function fetchMatch() {
  loading.value = true
  try {
    const res = await competeApi.getMatch(matchId.value)
    match.value = res.data
    // 如果对局已结束，停止轮询
    const s = res.data?.status
    if (s === MATCH_STATUS.FINISHED || s === MATCH_STATUS.ERROR) {
      stopPolling()
    }
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

function startPolling() {
  if (pollingTimer) return
  pollingTimer = setInterval(fetchMatch, 3000)
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

onMounted(async () => {
  await fetchMatch()
  const s = match.value?.status
  if (s === MATCH_STATUS.PENDING || s === MATCH_STATUS.RUNNING) {
    startPolling()
  }
})

onBeforeUnmount(() => {
  stopPolling()
})

// ─── 状态相关 ─────────────────────────────────────────────────────────────────
const isRunning = computed(() =>
  match.value?.status === MATCH_STATUS.PENDING || match.value?.status === MATCH_STATUS.RUNNING
)

const isCompleted = computed(() => match.value?.status === MATCH_STATUS.FINISHED)

const isFailed = computed(() => match.value?.status === MATCH_STATUS.ERROR)

const failedSummary = computed(() => {
  if (!match.value?.result) return { title: '对局失败', reason: '未知错误', botName: '', suggestion: '' }
  try {
    const r = JSON.parse(match.value.result) as any
    const verdict = r.verdict || ''

    if (verdict === 'forfeit') {
      const forfeitedId = r.forfeitedBot
      const forfeitedLink = match.value?.links?.find((l: any) => String(l.index) === String(forfeitedId))
      const botName = forfeitedLink?.gamer?.title || `Bot 位置 #${forfeitedId}`
      return {
        title: 'Bot 无响应（弃权）',
        reason: `${botName} 在运行时崩溃或超时，未返回有效输出`,
        botName,
        suggestion: '检查 Bot 代码能否正确解析 JSON 输入；确认 stdin 读写逻辑；查看是否有运行时异常（如 KeyError、AttributeError 等）',
      }
    }

    if (verdict === 'CE' || String(verdict).includes('CE')) {
      return {
        title: '编译失败 (CE)',
        reason: r.message || '代码无法通过编译 / 语法检查',
        botName: r.botId ? `Bot #${r.botId}` : '',
        suggestion: '检查代码语法是否正确；确认使用了平台支持的语言特性和版本',
      }
    }

    if (verdict === 'error' || r.judgeError) {
      return {
        title: '裁判程序异常',
        reason: r.judgeError || r.message || '裁判输出了错误信号',
        botName: '',
        suggestion: '检查裁判代码逻辑；确认 verdict 字段只输出 "continue" 或 "finish"',
      }
    }

    if (verdict === 'TLE') {
      return {
        title: '超时 (TLE)',
        reason: '对局超过最大时间限制',
        botName: '',
        suggestion: '减少 Bot 计算量；检查是否有死循环',
      }
    }

    return {
      title: `对局失败 (${verdict || '未知'})`,
      reason: r.message || JSON.stringify(r).slice(0, 300),
      botName: '',
      suggestion: '',
    }
  } catch {
    return { title: '对局失败', reason: (match.value?.result || '').slice(0, 200), botName: '', suggestion: '' }
  }
})

const statusType = computed((): 'default' | 'info' | 'success' | 'error' => {
  const m: Record<number, 'default' | 'info' | 'success' | 'error'> = {
    0: 'default', 1: 'info', 2: 'success', 3: 'error',
  }
  return m[match.value?.status as number] ?? 'default'
})

const statusLabel = computed(() => {
  const m: Record<number, string> = {
    0: '等待中', 1: '运行中', 2: '已完成', 3: '失败',
  }
  return m[match.value?.status as number] ?? '-'
})

// ─── 结果解析 ─────────────────────────────────────────────────────────────────
const parsedResult = computed<{ verdict?: string, finalResult?: Record<string, number>, roundCount?: number } | null>(() => {
  if (!match.value?.result) return null
  try {
    if (typeof match.value.result === 'string') {
      return JSON.parse(match.value.result)
    }
    return match.value.result
  }
  catch {
    return null
  }
})

const gameLog = computed(() => normalizeGameLog(match.value?.result, match.value?.gameId ?? ''))

// 得分表格行数据：将 finalResult map 转为数组
const scoreRows = computed(() => {
  const fr = parsedResult.value?.finalResult
  if (!fr) return []
  // 尝试用 gamerList 名称匹配 Bot ID
  const gamerMap = Object.fromEntries(gamerList.value.map((g: any) => [String(g.id), g]))
  return Object.entries(fr).map(([key, score]) => {
    const gamer = gamerMap[key]
    return {
      key,
      name: gamer?.name || `Bot#${key}`,
      score,
    }
  })
})

// ELO delta: gamerId → delta (from elo_history or providerMeta)
const eloDeltas = computed<Record<string, number>>(() => {
  const meta = match.value?.providerMeta as any
  if (meta?.eloChanges) return meta.eloChanges
  return {}
})

// Winner info from finalResult
const winnerInfo = computed(() => {
  const fr = parsedResult.value?.finalResult
  if (!fr) return null
  const gamerMap = Object.fromEntries(gamerList.value.map((g: any) => [String(g.id), g]))
  const scores = Object.entries(fr) as [string, number][]
  const maxScore = Math.max(...scores.map(([, v]) => v))
  const minScore = Math.min(...scores.map(([, v]) => v))
  const isDraw = maxScore === minScore
  const winnerIds = isDraw ? [] : scores.filter(([, v]) => v === maxScore).map(([k]) => k)
  return {
    isDraw,
    names: winnerIds.map(id => gamerMap[id]?.name || `Bot#${id}`),
  }
})

const scoreColumns: DataTableColumns<any> = [
  {
    title: 'Bot 名称',
    key: 'name',
    render(row) {
      if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1) return h('span', row.name || '-')
      return h('a', { href: `/compete/gamer/${row.id}` }, row.name || `Bot#${row.id}`)
    },
  },
  {
    title: '得分',
    key: 'score',
    render(row) {
      return h('span', { style: 'font-weight: 600' }, String(row.score))
    },
  },
]

// ─── 参与 Bot 表格 ────────────────────────────────────────────────────────────
const gamerList = computed(() => {
  if (!match.value) return []
  // links: [{ index, gamerId, gamer: { id, title/name, language, elo, user } }]
  if (Array.isArray(match.value.links) && match.value.links.length > 0) {
    return [...match.value.links]
      .sort((a: any, b: any) => a.index - b.index)
      .map((link: any) => ({
        id: link.gamerId,
        name: link.gamer?.name || link.gamer?.title || `Bot#${link.index}`,
        language: link.gamer?.language,
        type: link.gamer?.type,
        elo: link.gamer?.elo ?? 1200,
        user: link.gamer?.user,
        userId: link.gamer?.userId ?? link.gamer?.user?.id,
        index: link.index,
      }))
  }
  // fallback for older matches without links
  const gamers = match.value.gamers || match.value.gamerIds || []
  return gamers.map((g: any, index: number) =>
    typeof g === 'object' ? g : { id: g, name: `Bot#${g}`, index },
  )
})

const gamerColumns: DataTableColumns<any> = [
  {
    title: 'Bot 名称',
    key: 'name',
    render(row) {
      if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1) return h('span', row.name || '-')
      return h('a', { href: `/compete/gamer/${row.id}` }, row.name || `Bot#${row.id}`)
    },
  },
  {
    title: '类型',
    key: 'language',
    render(row) {
      const TYPE_MAP: Record<string, string> = { webhook: 'Webhook', external: '外部轮询', human: '真人', code: '' }
      const label = TYPE_MAP[row.type] || row.language || '-'
      return h(NTag, { size: 'small', bordered: false }, { default: () => label })
    },
  },
  {
    title: 'ELO',
    key: 'elo',
    render(row) {
      const delta = eloDeltas.value[String(row.id)]
      const base = h('span', row.elo !== undefined ? String(row.elo) : '-')
      if (delta == null) return base
      const sign = delta > 0 ? '+' : ''
      const color = delta > 0 ? '#18a058' : delta < 0 ? '#d03050' : '#999'
      return h('span', [
        base,
        h('span', { style: `color:${color};font-size:12px;margin-left:4px` }, `${sign}${delta}`),
      ])
    },
  },
  {
    title: '创建者',
    key: 'user',
    render(row) {
      const uid = row.userId ?? row.user?.id
      const username = row.user?.username || (uid ? `User#${uid}` : '-')
      if (!Number.isSafeInteger(Number(uid)) || Number(uid) < 1) return h('span', username)
      return h('a', { href: `/users/${uid}` }, username)
    },
  },
]

// ─── Human Player (SSE + 提交移动) ────────────────────────────────────────────

const authStore = useAuthStore()
const myHumanGamer = computed(() => {
  if (!authStore.user) return null
  return gamerList.value.find((g: any) => g.type === 'human' && g.userId === authStore.user?.id) || null
})

// ── Human turn state (must be declared before iframe refs that use it) ───────
const humanTurn = ref<{ turnToken: string; gameState: any } | null>(null)
const humanMove = ref('')
const submittingMove = ref(false)

// ── Human turn renderer (iframe postMessage protocol) ────────────────────────
const humanRendererRef = ref<HTMLIFrameElement | null>(null)

// The renderer handles gameState/gameLog inside its isolated srcdoc frame.
function onHumanRendererLoad() {
  const turn = humanTurn.value
  if (turn) sendGameStateToRenderer(turn)
}

// Whether the current renderer iframe declared interactive support
const iframeInteractive = ref(false)

// Listen for messages from iframe renderer
function onIframeMessage(e: MessageEvent) {
  if (e.source !== humanRendererRef.value?.contentWindow || !e.data || typeof e.data !== 'object') return
  // Renderer declares interactive capability → hide text input
  if (e.data.type === 'capabilities') {
    if (typeof e.data.interactive === 'boolean') {
      iframeInteractive.value = e.data.interactive
    }
    return
  }
  // Renderer sends back a move → auto-submit
  if (humanTurn.value && e.data.type === 'humanMove' && typeof e.data.move === 'string' && e.data.move.trim() && !submittingMove.value) {
    humanMove.value = e.data.move
    submitHumanMove()
  }
}

// Handle game-over SSE: immediately refresh match data and stop polling
function handleGameOverSSE(finalResult: Record<string, number>) {
  console.log('[SSE] game-over received, finalResult=', finalResult)
  humanTurn.value = null
  stopCountdown()
  fetchMatch()
  stopPolling()
}

onMounted(() => { window.addEventListener('message', onIframeMessage) })
onUnmounted(() => { window.removeEventListener('message', onIframeMessage) })

// Watch humanTurn changes to push gameState to iframe
// Send gameState to iframe; retry until iframe window is ready (handles async load)
function sendGameStateToRenderer(turn: { turnToken: string; gameState: any }) {
  // Deep-clone via JSON to ensure structured-clone compatibility
  const gameState = JSON.parse(JSON.stringify(turn.gameState ?? null))
  const msg = { type: 'gameState', gameState, playerIndex: myHumanGamer.value?.index ?? 0 }
  let attempts = 0
  const tryPost = () => {
    const win = humanRendererRef.value?.contentWindow
    console.log(`[Renderer] tryPost attempt ${attempts}, contentWindow=`, !!win, 'humanTurn=', !!humanTurn.value)
    if (win) {
      console.log('[Renderer] sending gameState, playerIndex=', msg.playerIndex)
      win.postMessage(msg, '*')
    } else if (attempts < 20) {
      attempts++
      setTimeout(tryPost, 100)
    }
  }
  setTimeout(tryPost, 50) // slight delay for Vue to render iframe
}

watch(() => humanTurn.value, (turn) => {
  if (turn) sendGameStateToRenderer(turn)
})

// TicTacToe board helper — returns flat 9-cell array or null if not ttt
// Parse 9-cell board from any known format
function extractBoard(gs: any): number[] | null {
  if (!gs) return null
  // BotInput format: requests[last] = '{"board": [...], "turn": N}'
  if (gs?.requests && Array.isArray(gs.requests) && gs.requests.length > 0) {
    try {
      const req = JSON.parse(gs.requests[gs.requests.length - 1])
      if (req?.board && Array.isArray(req.board)) {
        const b = Array.isArray(req.board[0]) ? (req.board as number[][]).flat() : req.board as number[]
        if (b.length === 9) return b
      }
    } catch { /* ignore */ }
  }
  // Direct formats
  const board = gs?.board ?? gs?.display?.board
  if (!board || !Array.isArray(board)) return null
  if (Array.isArray(board[0])) return (board as number[][]).flat()
  if (board.length === 9) return board as number[]
  return null
}

const tttBoard = computed(() => extractBoard(humanTurn.value?.gameState))

function clickCell(i: number) {
  // The move key is the player's position index (0 or 1)
  const idx = myHumanGamer.value?.index ?? 0
  humanMove.value = JSON.stringify({ [String(idx)]: i })
  // Auto-submit on click
  nextTick(() => submitHumanMove())
}

// ── Countdown timer ──────────────────────────────────────────────────────────
const countdownSec = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null
const HUMAN_TURN_TIMEOUT_SEC = 180

function startCountdown() {
  countdownSec.value = HUMAN_TURN_TIMEOUT_SEC
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    if (countdownSec.value > 0) countdownSec.value--
    else { if (countdownTimer) clearInterval(countdownTimer) }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  countdownSec.value = 0
}

// Start/stop countdown when humanTurn changes; the mounted iframe's capability persists.
watch(() => humanTurn.value, (turn) => {
  if (turn) startCountdown()
  else stopCountdown()
})

// SSE connection
let sseSource: EventSource | null = null

function connectHumanSSE() {
  if (!myHumanGamer.value) return
  const token = authStore.accessToken
  if (!token) return

  const apiBase = useRuntimeConfig().public.apiBase
  const apiUrl = new URL(apiBase, window.location.origin)
  const url = new URL(`compete/matches/${matchId.value}/human-sse`, `${apiUrl.href.replace(/\/?$/, '/')}`)
  url.searchParams.set('token', token)
  // Nginx proxies this same-origin endpoint with streaming enabled.
  sseSource = new EventSource(url.toString())

  sseSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.type === 'your-turn') {
        humanTurn.value = { turnToken: data.turnToken, gameState: data.gameState }
      } else if (data.type === 'game-over') {
        handleGameOverSSE(data.finalResult ?? {})
      }
    } catch { /* ignore */ }
  }

  // Backend will replay any pending turn immediately on SSE connect
}

async function submitHumanMove() {
  if (!humanTurn.value || !humanMove.value.trim()) return
  submittingMove.value = true
  try {
    await useCompeteApi().botRespond(humanTurn.value.turnToken, humanMove.value.trim())
    humanTurn.value = null
    humanMove.value = ''
  } catch {
    // Avoid logging request details that may contain credentials or turn data.
  } finally {
    submittingMove.value = false
  }
}

// Connect SSE as soon as we know the user is a human player in this match.
// myHumanGamer depends on match.value, so we watch until it's non-null.
const stopWatchSSE = watch(myHumanGamer, (gamer) => {
  if (gamer && !sseSource) {
    connectHumanSSE()
    stopWatchSSE()
  }
}, { immediate: true })

onUnmounted(() => { sseSource?.close(); stopCountdown() })

useHead(computed(() => ({ title: `对战记录 #${matchId.value} — Leverage OJ` })))
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.match-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ttt-board {
  display: grid;
  grid-template-columns: repeat(3, 60px);
  gap: 4px;
  width: fit-content;
}

.ttt-cell {
  width: 60px;
  height: 60px;
  border: 2px solid #e0e0e6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  cursor: default;
  user-select: none;
}

.ttt-cell.can-click {
  cursor: pointer;
  background: #f5f5f5;
  transition: background 0.15s;
}

.ttt-cell.can-click:hover {
  background: #e6f4ea;
  border-color: #18a058;
}
</style>
