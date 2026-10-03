<template>
  <div class="admin-game-detail">
    <NAlert v-if="isSystemGame" type="warning" :show-icon="false" style="margin-bottom:12px">
      🔒 <strong>系统内置游戏</strong> — 此游戏作为教程示例游戏受到保护，不可禁用。裁判程序和渲染器可以更新。
    </NAlert>
    <div class="page-header">
      <NSpace align="center" justify="space-between" style="width:100%">
        <NSpace align="center">
          <NButton text @click="navigateTo(props.returnPath)">
            ← 返回游戏列表
          </NButton>
          <NH2 style="margin: 0">
            {{ game?.title || (isNew ? '创建游戏' : '游戏详情') }}
          </NH2>
          <NTag v-if="game" :type="game.disabled ? 'error' : 'success'" size="small">
            {{ game.disabled ? '已禁用' : '已启用' }}
          </NTag>
        </NSpace>
        <NSpace v-if="game">
          <NButton type="warning" secondary @click="triggerAutoMatch">
            ⚡ 触发自动对战
          </NButton>
          <NText depth="3" style="font-size:12px">TopN=8，code类型bot参与</NText>
        </NSpace>
      </NSpace>
    </div>

    <p v-if="props.createOnly" class="create-note">此入口只创建游戏。后续编辑仍按后台角色权限执行。</p>
    <NButton v-if="isNew && !showEditModal" type="primary" @click="showEditModal = true">继续创建游戏</NButton>
    <NSpin :show="loading">
      <NTabs v-if="!isNew" v-model:value="activeTab" type="line" animated>
        <!-- ===== 基本信息 Tab ===== -->
        <NTabPane name="info" tab="基本信息">
          <NCard v-if="game" style="max-width: 640px; margin-top: 16px">
            <NDescriptions :column="1" label-placement="left" bordered style="margin-bottom: 16px">
              <NDescriptionsItem label="ID">{{ game.id }}</NDescriptionsItem>
              <NDescriptionsItem label="游戏名称">{{ game.title }}</NDescriptionsItem>
              <NDescriptionsItem label="玩家数量">{{ game.gamerQuantity ?? '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="时间限制">{{ game.timeLimit ? `${game.timeLimit} ms` : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="内存限制">{{ game.memoryLimit ? `${game.memoryLimit ?? 0} MB` : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="状态">
                <NTag :type="game.disabled ? 'error' : 'success'" size="small">
                  {{ game.disabled ? '已禁用' : '已启用' }}
                </NTag>
              </NDescriptionsItem>
            </NDescriptions>
            <NButton type="primary" @click="openEditModal">编辑游戏</NButton>
          </NCard>
        </NTabPane>

        <!-- ===== 排行榜 Tab ===== -->
        <NTabPane name="leaderboard" tab="排行榜">
          <div style="margin-top: 16px">
            <NSpace align="center" style="margin-bottom:12px">
              <NButton @click="fetchLeaderboard">刷新</NButton>
              <NRadioGroup v-model:value="leaderboardBoard" size="small">
                <NRadioButton value="inner">内榜（仅代码）</NRadioButton>
                <NRadioButton value="outer">外榜（全部）</NRadioButton>
              </NRadioGroup>
            </NSpace>
            <NDataTable
              :columns="leaderboardColumns"
              :data="leaderboard"
              :loading="leaderboardLoading"
              :row-key="(row: any) => row.gamerId ?? row.id"
              size="small"
            />
          </div>
        </NTabPane>

        <!-- ===== 对局列表 Tab ===== -->
        <NTabPane name="matches" tab="对局列表">
          <div style="margin-top: 16px">
            <NButton style="margin-bottom: 12px" @click="fetchMatches">刷新</NButton>
            <NDataTable
              :columns="matchColumns"
              :data="matches"
              :loading="matchesLoading"
              :row-key="(row: any) => row.id"
              size="small"
            />
            <NPagination
              v-model:page="matchPage"
              :page-count="matchPageCount"
              style="margin-top: 12px; justify-content: flex-end"
              @update:page="fetchMatches"
            />
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>

    <!-- 编辑弹窗 -->
    <NModal v-model:show="showEditModal" :title="isNew ? '创建游戏' : '编辑游戏'" preset="card" style="width: min(680px, calc(100vw - 32px)); max-height: 90vh; overflow-y: auto">
      <NForm :model="editForm" :label-placement="isMobile ? 'top' : 'left'" label-width="120px">
        <NFormItem label="游戏名称" required>
          <NInput v-model:value="editForm.title" placeholder="输入游戏名称" />
        </NFormItem>
        <NFormItem label="玩家数量">
          <NInputNumber v-model:value="editForm.gamerQuantity" :min="2" :max="100" style="width: 100%" />
        </NFormItem>
        <NFormItem label="时间限制 (ms)">
          <NInputNumber v-model:value="editForm.timeLimit" :min="100" :max="60000" style="width: 100%" />
        </NFormItem>
        <NFormItem label="内存限制 (MB)">
          <NInputNumber v-model:value="editFormMemoryMB" :min="8" :max="1024" style="width: 100%" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="editForm.description" type="textarea" :rows="4" placeholder="游戏描述" />
        </NFormItem>
        <NFormItem label="启用">
          <NSpace align="center">
            <NSwitch v-model:value="editFormEnabled" :disabled="isSystemGame" />
            <NTag v-if="isSystemGame" size="small" type="warning" :bordered="false">系统内置游戏，不可禁用</NTag>
          </NSpace>
        </NFormItem>
        <NFormItem label="允许真人参与">
          <NSpace align="center">
            <NSwitch v-model:value="editForm.allowHuman" />
            <NText depth="3" style="font-size:12px">开启后用户可以以真人身份参与对局</NText>
          </NSpace>
        </NFormItem>
        <NFormItem label="自动对战调度">
          <NSpace align="center">
            <NSwitch v-model:value="editForm.autoMatchEnabled" />
            <NText depth="3" style="font-size:12px;margin-left:8px">
              开启后系统自动触发bot对战，自适应退避
            </NText>
          </NSpace>
        </NFormItem>

        <!-- 自定义渲染器 HTML -->
        <NFormItem label="自定义渲染器 HTML">
          <div style="width: 100%">
            <!-- 开发指南折叠区 -->
            <NCollapse style="margin-bottom:8px;border:1px solid #e0e0e6;border-radius:6px;padding:0 8px">
              <NCollapseItem title="📖 渲染器开发指南 & 模板" name="guide">
                <div style="font-size:13px;line-height:1.7">
                  <p style="margin:0 0 8px"><strong>渲染器通过 postMessage 与平台通信，支持回放和人类出手两种模式。</strong></p>
                  <div style="background:#f5f5f5;border-radius:4px;padding:8px;margin-bottom:8px">
                    <strong>消息协议：</strong>
                    <ul style="margin:4px 0;padding-left:20px">
                      <li>启动时发送：<code>window.parent.postMessage({'{'} type: 'capabilities', interactive: true {'}'}, '*')</code></li>
                      <li>接收 <code>{'{'} type: 'gameLog', gameLog, round {'}'}</code> — 回放模式</li>
                      <li>接收 <code>{'{'} type: 'gameState', gameState, playerIndex {'}'}</code> — 人类出手</li>
                      <li>发送 <code>{'{'} type: 'humanMove', move: '{"0": 42}' {'}'}</code> — 提交移动（字符串！）</li>
                    </ul>
                    <strong>BotInput 格式：</strong>
                    <pre style="margin:4px 0;font-size:11px;overflow:auto">gameState.requests[last] // JSON 字符串，需 JSON.parse()
// 例如："{'{'\"stones\": 15, \"turn\": 0'}'"</pre>
                  </div>
                  <NButton
                    size="small" type="primary" secondary
                    @click="editForm.rendererHtml = minimalTemplate"
                  >
                    插入最小模板
                  </NButton>
                </div>
              </NCollapseItem>
            </NCollapse>

            <NInput
              v-model:value="editForm.rendererHtml"
              type="textarea"
              :rows="10"
              :placeholder="rendererHtmlPlaceholder"
              style="font-family: monospace; font-size: 12px"
            />
            <NSpace justify="space-between" align="center" style="margin-top: 6px">
              <NText :type="rendererHtmlOverLimit ? 'error' : 'default'" style="font-size: 12px">
                {{ rendererHtmlLen.toLocaleString() }} / 512,000 字符
              </NText>
              <NButton size="small" secondary @click="showRendererPreview = true">
                预览
              </NButton>
            </NSpace>
            <NAlert v-if="rendererHtmlOverLimit" type="error" :show-icon="false" style="margin-top: 4px; font-size: 12px">
              超出后端 512,000 字符长度限制，请精简代码
            </NAlert>
          </div>
        </NFormItem>
        <!-- 裁判程序 -->
        <NCollapse style="margin-top:8px;border:1px solid #e0e0e6;border-radius:6px">
          <NCollapseItem title="⚖️ 裁判程序" name="judger">
            <NFormItem label="裁判语言" label-width="120px">
              <NSelect
                v-model:value="editForm.judgerLanguage"
                :options="BOTZONE_LANGUAGE_OPTIONS"
                style="max-width:200px"
              />
            </NFormItem>
            <NFormItem label="裁判代码" label-width="120px">
              <div style="width:100%">
                <CodeEditor
                  v-model="editForm.judgerCode"
                  :language="judgerEditorLanguage"
                  height="320px"
                />
              </div>
            </NFormItem>
            <NAlert type="info" :show-icon="false" style="font-size:12px;margin-top:4px">
              新建游戏必须提供裁判代码，并使用该游戏约定的输入/输出协议。官方示例需显式安装，不会自动为新游戏补齐裁判。
            </NAlert>
          </NCollapseItem>
        </NCollapse>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" :disabled="rendererHtmlOverLimit" @click="handleSaveEdit">{{ isNew ? '创建' : '保存' }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 渲染器预览弹窗 -->
    <NModal v-model:show="showRendererPreview" title="渲染器预览" preset="card" style="width: min(760px, calc(100vw - 32px))">
      <NAlert type="info" :show-icon="false" style="margin-bottom: 12px; font-size: 12px">
        以下使用示例 gameLog 数据测试你的渲染器。iframe 仅允许执行脚本（sandbox=allow-scripts），无法访问父页面。
      </NAlert>
      <iframe
        v-if="editForm.rendererHtml && showRendererPreview"
        :srcdoc="editForm.rendererHtml"
        sandbox="allow-scripts"
        style="width:100%;height:420px;border:1px solid #e0e0e0;border-radius:4px;display:block"
        :ref="(el) => { previewIframeEl = el as HTMLIFrameElement | null }"
        @load="onPreviewIframeLoad"
      />
      <NEmpty v-else description="请先填写渲染器 HTML" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="sendPreviewMessage">重发 gameLog 消息</NButton>
          <NButton type="primary" @click="showRendererPreview = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import exampleRenderer from '~~/examples/botzone/closest-renderer.html?raw'
import previewFixture from '~~/examples/botzone/closest-log.json'
import { normalizeGameLog } from '~/utils/botzone-log'
import { h, computed } from 'vue'
import { NTag, NButton, NSpace, NCollapse, NCollapseItem, NRadioGroup, NRadioButton, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import type { GameInput } from '~/types/compete'
import { BOTZONE_LANGUAGE_OPTIONS, botzoneEditorLanguage, botzoneLanguage } from '~/utils/botzone-language'

const props = withDefaults(defineProps<{ createOnly?: boolean; returnPath?: string }>(), { createOnly: false, returnPath: '/admin/compete' })
const authStore = useAuthStore()
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 640)

const route = useRoute()
const rawId = props.createOnly ? 'new' : route.params.id as string
const isNew = rawId === 'new' || rawId === '0' || !rawId
const gameId = isNew ? 0 : Number(rawId)
// 系统内置游戏，不允许删除/禁用
const SYSTEM_GAME_IDS = [2, 3, 4]
const isSystemGame = SYSTEM_GAME_IDS.includes(gameId)
const competeApi = useCompeteApi()
const message = useMessage()

// ── 基本数据 ──
const game = ref<any | null>(null)
const loading = ref(false)
const activeTab = ref('info')

async function fetchGame() {
  if (isNew) {
    // 新建模式：直接展示编辑弹窗
    showEditModal.value = true
    return
  }
  loading.value = true
  try {
    const res = await competeApi.getGame(gameId)
    game.value = res.data
  }
  catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(fetchGame)

// ── 编辑弹窗 ──
const showEditModal = ref(false)
const saving = ref(false)
const editForm = ref({
  title: '',
  gamerQuantity: 2,
  timeLimit: 1000,
  memoryLimit: 256,
  description: '',
  disabled: true,
  rendererHtml: '',
  allowHuman: false,
  autoMatchEnabled: false,
  judgerCode: '',
  judgerLanguage: 'python',
})

// 内存以 MB 为单位进行交互
const editFormMemoryMB = computed({
  get: () => editForm.value.memoryLimit,
  set: (v: number) => { editForm.value.memoryLimit = v },
})

const editFormEnabled = computed({
  get: () => !editForm.value.disabled,
  set: (v: boolean) => { editForm.value.disabled = !v },
})

const rendererHtmlLen = computed(() => editForm.value.rendererHtml?.length ?? 0)
const rendererHtmlOverLimit = computed(() => rendererHtmlLen.value > 512000)

const judgerEditorLanguage = computed(() => botzoneEditorLanguage(editForm.value.judgerLanguage))

const minimalTemplate = exampleRenderer
const rendererHtmlPlaceholder = '粘贴自定义 HTML，或使用最小模板；协议见开发指南'

// ── 渲染器预览 ──
const showRendererPreview = ref(false)
const previewIframeEl = ref<HTMLIFrameElement | null>(null)

const previewGameLog = normalizeGameLog(previewFixture, 'preview')

function sendPreviewMessage() {
  previewIframeEl.value?.contentWindow?.postMessage(
    { type: 'gameLog', gameLog: previewGameLog, round: 0 },
    '*',
  )
}

function onPreviewIframeLoad() {
  sendPreviewMessage()
}

async function openEditModal() {
  if (!game.value) return
  editForm.value = {
    title: game.value.title || '',
    gamerQuantity: game.value.gamerQuantity ?? 2,
    timeLimit: game.value.timeLimit ?? 1000,
    memoryLimit: game.value.memoryLimit ?? 256,
    description: game.value.description || '',
    disabled: !!game.value.disabled,
    rendererHtml: game.value.rendererHtml || '',
    allowHuman: !!game.value.allowHuman,
    autoMatchEnabled: !!game.value.autoMatchEnabled,
    judgerCode: '',
    judgerLanguage: 'python',
  }
  // 加载裁判程序
  if (!isNew) {
    try {
      const jRes = await competeApi.getGameJudger(gameId)
      const judger = jRes.data
      if (judger) {
        editForm.value.judgerCode = judger.judgerCode || ''
        editForm.value.judgerLanguage = botzoneLanguage(judger.judgerLanguage)
      }
    }
    catch { /* 无裁判程序，忽略 */ }
  }
  showEditModal.value = true
}

async function handleSaveEdit() {
  if (!editForm.value.title) {
    message.warning('游戏名称不能为空')
    return
  }
  if (rendererHtmlOverLimit.value) {
    message.error('自定义渲染器 HTML 超出后端 512,000 字符长度限制')
    return
  }
  if (isNew && !editForm.value.judgerCode?.trim()) {
    message.error('新建游戏必须填写裁判程序代码（裁判程序定义游戏规则）')
    return
  }
  const owner = authStore.user?.id
  saving.value = true
  try {
    const { judgerCode, judgerLanguage, ...rest } = editForm.value
    const payload: GameInput = { ...rest }
    if (!payload.rendererHtml) payload.rendererHtml = null
    if (judgerCode) {
      payload.judgerCode = judgerCode
      payload.judgerLanguage = judgerLanguage
    } else if (isNew) {
      // 新建游戏时 judgerCode 必填（前面已校验），这里不会走到
      payload.judgerCode = ''
    }
    // 编辑现有游戏时 judgerCode 为空则不发送，保持原值不变
    if (isNew) {
      const res = await competeApi.createGame(payload)
      if (owner !== authStore.user?.id) return
      message.success('游戏创建成功')
      showEditModal.value = false
      // 跳转到新游戏的管理页
      navigateTo(props.createOnly ? `/compete/games/${res.data?.id ?? res.data}` : `/admin/compete/game/${res.data?.id ?? res.data}`)
    } else {
      await competeApi.updateGame(gameId, payload)
      if (owner !== authStore.user?.id) return
      message.success('游戏信息已更新')
      showEditModal.value = false
      fetchGame()
    }
  }
  catch (e: any) { message.error(e?.message || '操作失败') }
  finally { saving.value = false }
}

async function triggerAutoMatch() {
  try {
    const res = await competeApi.triggerAutoMatch(gameId)
    const { created } = res.data
    message.success(`已触发 ${created} 场对战`)
  }
  catch (e: any) {
    message.error(e?.message || '触发失败')
  }
}

// ── 排行榜 ──
const leaderboard = ref<any[]>([])
const leaderboardLoading = ref(false)
const leaderboardBoard = ref<'inner' | 'outer'>('inner')

async function fetchLeaderboard() {
  leaderboardLoading.value = true
  try {
    const res = await competeApi.getLeaderboard(isNew ? 0 : gameId, leaderboardBoard.value)
    leaderboard.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error(e) }
  finally { leaderboardLoading.value = false }
}

watch(leaderboardBoard, fetchLeaderboard)

const leaderboardColumns = computed((): DataTableColumns<any> => [
  { title: '排名', key: '_rank', width: 55, render: (_r, idx) => h('span', { style: 'font-weight:600;color:#888' }, `#${idx + 1}`) },
  {
    title: 'Bot',
    key: 'name',
    render: r => h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => navigateTo(`/compete/gamer/${r.gamerId}`) },
      () => r.name || `Bot#${r.gamerId}`),
  },
  { title: leaderboardBoard.value === 'inner' ? 'ELO (内榜)' : 'ELO (外榜)', key: 'elo', width: 100 },
  { title: '胜场', key: 'wins', width: 65 },
  { title: '总场', key: 'total', width: 65 },
  { title: '胜率', key: 'winRate', width: 70, render: r => r.winRate != null ? `${(r.winRate * 100).toFixed(1)}%` : '-' },
])

// ── 对局列表 ──
const matches = ref<any[]>([])
const matchesLoading = ref(false)
const matchPage = ref(1)
const matchPageCount = ref(1)
const matchPerPage = 20

async function fetchMatches() {
  matchesLoading.value = true
  try {
    const res = await competeApi.listMatches({
      gameId,
      page: matchPage.value,
      perPage: matchPerPage,
    })
    const data = res.data as any
    matches.value = data?.items || data || []
    if (data?.total) {
      matchPageCount.value = Math.ceil(data.total / matchPerPage)
    }
  }
  catch (e) { console.error(e) }
  finally { matchesLoading.value = false }
}

const statusNumMap: Record<number, { type: any; label: string }> = {
  0: { type: 'default', label: '等待中' },
  1: { type: 'info', label: '进行中' },
  2: { type: 'success', label: '已完成' },
  3: { type: 'error', label: '失败' },
}

function getWinnerNodes(r: any) {
  try {
    const fr = typeof r.result === 'string' ? JSON.parse(r.result).finalResult : r.result?.finalResult
    if (!fr) return [h('span', { style: 'color:#aaa' }, '-')]
    const maxScore = Math.max(...Object.values(fr) as number[])
    const winnerEntries = Object.entries(fr).filter(([, v]) => v === maxScore)
    if (winnerEntries.length === Object.keys(fr).length) return [h('span', { style: 'color:#f0a020' }, '平局')]
    const gMap = Object.fromEntries((r.links || []).map((l: any) => [String(l.gamerId), { name: l.gamer?.title || l.gamer?.name || `Bot#${l.gamerId}`, id: l.gamerId }]))
    return winnerEntries.map(([id]) => {
      const g = gMap[id]
      return g
        ? h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => navigateTo(`/compete/gamer/${g.id}`) }, () => g.name)
        : h('span', `Bot#${id}`)
    })
  }
  catch { return [h('span', { style: 'color:#aaa' }, '-')] }
}

const matchColumns: DataTableColumns<any> = [
  {
    title: 'ID', key: 'id', width: 65,
    render: r => h(NButton, { text: true, type: 'default', size: 'small', onClick: () => navigateTo(`/compete/matches/${r.id}`) }, () => `#${r.id}`),
  },
  {
    title: '状态', key: 'status', width: 90,
    render: r => {
      const s = statusNumMap[r.status] || { type: 'default', label: String(r.status) }
      return h(NTag, { type: s.type, size: 'small' }, () => s.label)
    },
  },
  {
    title: '参与者', key: 'links',
    render: r => {
      const links = r.links?.slice().sort((a: any, b: any) => a.index - b.index) || []
      if (!links.length) return h('span', { style: 'color:#aaa' }, '-')
      const parts: any[] = []
      links.forEach((l: any, i: number) => {
        if (i > 0) parts.push(h('span', { style: 'color:#bbb;margin:0 4px' }, 'vs'))
        parts.push(h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => navigateTo(`/compete/gamer/${l.gamerId}`) }, () => l.gamer?.title || l.gamer?.name || `Bot#${l.gamerId}`))
      })
      return h('span', parts)
    },
  },
  {
    title: '胜者', key: 'winner', width: 140,
    render: r => r.status === 2 ? h('span', { style: 'color:#18a058;font-weight:600' }, getWinnerNodes(r)) : h('span', { style: 'color:#aaa' }, '-'),
  },
  {
    title: '时间', key: 'createdAt', width: 140,
    render: r => h(NButton, { text: true, type: 'default', size: 'small', onClick: () => navigateTo(`/compete/matches/${r.id}`) }, () => r.createdAt ? dayjs(r.createdAt).format('MM-DD HH:mm') : '-'),
  },
]

// ── Tab 切换时懒加载 ──
watch(activeTab, (tab) => {
  if (tab === 'leaderboard' && !leaderboard.value.length) fetchLeaderboard()
  if (tab === 'matches' && !matches.value.length) fetchMatches()
})

useHead(computed(() => ({ title: game.value?.name ? `${game.value.name}` : '游戏管理' })))
</script>

<style scoped>
.create-note { color: var(--lv-color-text-secondary); font-size: 14px; line-height: 1.7; }
.admin-game-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
