<template>
  <div class="compete-game-page">
    <CompeteAdminViewBanner :admin-path="`/admin/compete/game/${gameId}`" />
    <NAlert v-if="gameError" type="error" title="游戏加载失败">
      {{ gameError }} <NButton text type="primary" @click="fetchGame">重试</NButton>
      <NButton text @click="navigateTo('/compete')">返回游戏列表</NButton>
    </NAlert>
    <NSpin :show="loading">
      <!-- Header -->
      <div v-if="game" class="game-header">
        <NButton text type="primary" @click="navigateTo('/compete')">← 游戏列表</NButton>
        <div class="game-title-row">
          <NH2 style="margin:0">{{ game.title }}</NH2>
          <NTag size="small" :type="game.disabled ? 'error' : 'success'">
            {{ game.disabled ? '已禁用' : '进行中' }}
          </NTag>
        </div>
        <NText depth="3">{{ game.description || '暂无游戏描述' }}</NText>
        <NDivider style="margin:12px 0" />
        <NSpace align="center">
          <NText depth="3">⏱ 时限 {{ game.timeLimit }}ms</NText>
          <NText depth="3">💾 内存 {{ game.memoryLimit }}MB</NText>
          <NText depth="3">👥 {{ game.gamerQuantity }} 人对战</NText>
        </NSpace>
        <div class="game-actions">
          <NButton type="primary" :disabled="game.disabled" @click="activeTab = 'participate'">选择参赛者</NButton>
          <NButton secondary @click="activeTab = 'matches'">浏览对局与回放</NButton>
          <NButton secondary type="info" @click="navigateTo(`/compete/learn?track=bot&step=1&gameId=${gameId}`)">学习如何为此游戏编写 Bot</NButton>
        </div>
      </div>

      <NTabs v-if="game" v-model:value="activeTab" type="line" animated style="margin-top:16px">

        <!-- ── 排行榜 ─────────────────────────────────────────────────── -->
        <NTabPane name="leaderboard" tab="排行榜">
          <div style="margin-top:12px">
            <NSpace style="margin-bottom:12px" align="center">
              <NSwitch v-model:value="showNonBot">
                <template #checked>显示真人/外部</template>
                <template #unchecked>仅 Bot 竞争</template>
              </NSwitch>
              <NButton size="small" @click="fetchLeaderboard">刷新</NButton>
            </NSpace>
            <NAlert v-if="leaderboardError" type="error" title="排行榜加载失败" class="state-alert">{{ leaderboardError }} <NButton text type="primary" @click="fetchLeaderboard">重试</NButton></NAlert>
            <NEmpty v-if="!leaderboardLoading && !leaderboardError && !leaderboard.length" description="暂无排行数据" class="empty-state" />
            <div v-else-if="!leaderboardError" class="table-scroll"><NDataTable :columns="leaderboardColumns" :data="leaderboard" :loading="leaderboardLoading" :row-key="(r:any)=>r.gamerId" size="small" /></div>
          </div>
        </NTabPane>

        <!-- ── 参赛 ──────────────────────────────────────────────────── -->
        <NTabPane name="participate" tab="参赛">
          <div style="margin-top:12px">
            <NAlert v-if="game.disabled" type="warning" title="该游戏已禁用">目前无法发起新对局。</NAlert>
            <NAlert v-if="!authStore.isLoggedIn" type="info" title="登录后参赛" class="state-alert"><NButton type="primary" @click="navigateTo('/login')">登录</NButton></NAlert>

            <!-- 我的 Bot -->
            <NCard v-if="authStore.isLoggedIn && !game.disabled" size="small" class="section-card">
              <template #header>
                <div class="section-heading">
                  <span style="font-weight:600">我的 Bot</span>
                  <div class="section-actions">
                    <NButton
                      v-if="game?.allowHuman"
                      size="small"
                      secondary
                      :loading="joiningAsHuman !== null"
                      @click="myHumanGamer ? joinAsHuman(myHumanGamer) : quickJoinAsHuman()"
                    >
                      真人参赛
                    </NButton>
                    <NButton size="small" type="primary" @click="showSubmitModal = true">提交 Bot</NButton>
                  </div>
                </div>
              </template>
              <NSpin :show="myBotsLoading">
                <NAlert v-if="myBotsError" type="error" title="我的 Bot 加载失败" class="state-alert">{{ myBotsError }} <NButton text type="primary" @click="fetchMyBots">重试</NButton></NAlert>
                <NEmpty v-else-if="!myBotsLoading && !myBots.length" description="还没有 Bot，可提交代码 Bot 或以真人身份参赛" class="empty-state" />
                <NSpace v-else-if="!myBotsError" vertical :size="8">
                  <div
                    v-for="bot in myBots"
                    :key="bot.id"
                    class="bot-card"
                    :class="{ selected: selectedGamerIds.includes(bot.id), disabled: bot.disabled }"
                  >
                    <NSpace align="center" class="bot-details" style="flex:1;min-width:0">
                      <!-- checkbox for non-human, non-disabled -->
                      <NCheckbox
                        v-if="bot.type !== 'human' && !bot.disabled"
                        :checked="selectedGamerIds.includes(bot.id)"
                        :disabled="!selectedGamerIds.includes(bot.id) && selectedGamerIds.length >= (game?.gamerQuantity ?? 2)"
                        @update:checked="(v:boolean) => toggleGamer(bot.id, v)"
                      />
                      <div style="min-width:0;flex:1">
                        <NSpace align="center">
                          <NText strong :style="bot.disabled ? 'color:#aaa' : undefined">{{ bot.title || bot.name }}</NText>
                          <NTag v-if="bot.disabled" size="small" type="error">已禁用</NTag>
                          <NTag v-else size="small" :type="botTagType(bot.type)">{{ botTypeLabel(bot) }}</NTag>
                          <NTag v-if="!bot.disabled" size="small" type="info">⚡ {{ bot.elo ?? 1200 }}</NTag>
                        </NSpace>
                      </div>
                    </NSpace>
                    <NSpace align="center" class="bot-tools">
                      <!-- Human bot: show join button + creator info, no edit -->
                      <template v-if="bot.type === 'human'">
                        <NText depth="3" style="font-size:12px">真人席位</NText>
                        <NButton
                          v-if="!bot.disabled"
                          size="small"
                          type="primary"
                          :loading="joiningAsHuman === bot.id"
                          @click="joinAsHuman(bot)"
                        >
                          🎮 加入对局
                        </NButton>
                      </template>
                      <!-- Code/webhook/external: show edit button -->
                      <template v-else>
                        <NButton v-if="bot.type === 'code'" size="small" secondary :disabled="bot.disabled" @click="navigateTo({ path: '/compete/playground', query: { gameId: String(gameId), gamerId: String(bot.id), tab: 'bot' } })">测试</NButton>
                        <NButton size="small" text :disabled="bot.disabled" @click="navigateTo(`/compete/gamer/${bot.id}`)">编辑</NButton>
                      </template>
                    </NSpace>
                  </div>
                </NSpace>
              </NSpin>
            </NCard>

            <!-- 全部 Bot（选对手） -->
            <NCard v-if="authStore.isLoggedIn && !game.disabled" size="small">
              <template #header>
                <NSpace justify="space-between" align="center">
                  <span style="font-weight:600">所有参赛者 <NText depth="3" style="font-size:12px">（勾选加入当前对局）</NText></span>
                  <NButton size="small" @click="fetchAllGamers">刷新</NButton>
                </NSpace>
              </template>
              <NAlert v-if="allGamersError" type="error" title="参赛者加载失败" class="state-alert">{{ allGamersError }} <NButton text type="primary" @click="fetchAllGamers">重试</NButton></NAlert>
              <NEmpty v-if="!allGamersLoading && !allGamersError && !otherGamers.length" description="暂无其他可选的代码 Bot" class="empty-state" />
              <div v-else-if="!allGamersError" class="table-scroll"><NDataTable
                :columns="allGamerColumns"
                :data="otherGamers"
                :loading="allGamersLoading"
                :row-key="(r:any) => r.id"
                :checked-row-keys="otherGamerCheckedKeys"
                size="small"
                style="margin-top:4px"
                @update:checked-row-keys="onOtherGamerCheck"
              /></div>
            </NCard>

            <!-- 发起对局 banner（移到最下面） -->
            <NAlert
              v-if="authStore.isLoggedIn && !game.disabled"
              type="success"
              style="margin-top:12px"
              :show-icon="false"
            >
              <div class="launch-actions">
                <NText>
                  已选 <NText strong>{{ selectedGamerIds.length }}</NText> / {{ game?.gamerQuantity ?? 2 }} 个参赛者
                  <NText v-if="selectedGamerIds.length > 0" depth="3" style="margin-left:8px">({{ selectedGamerNames.join(' vs ') }})</NText>
                </NText>
                <NSpace>
                  <NButton size="small" :disabled="selectedGamerIds.length === 0" @click="selectedGamerIds = []">清空</NButton>
                  <NButton
                    type="primary"
                    size="small"
                    :disabled="selectedGamerIds.length !== (game?.gamerQuantity ?? 2)"
                    :loading="launching"
                    @click="handleLaunchMatch"
                  >
                    ⚔️ 发起对局
                  </NButton>
                </NSpace>
              </div>
            </NAlert>
          </div>
        </NTabPane>

        <!-- ── 对局记录 ────────────────────────────────────────────────── -->
        <NTabPane name="matches" tab="对局与回放">
          <div style="margin-top:12px">
            <NButton size="small" style="margin-bottom:12px" @click="fetchMatches">刷新</NButton>
            <NAlert v-if="matchesError" type="error" title="对局加载失败" class="state-alert">{{ matchesError }} <NButton text type="primary" @click="fetchMatches">重试</NButton></NAlert>
            <NEmpty v-if="!matchesLoading && !matchesError && !matches.length" description="暂无对局记录" class="empty-state" />
            <div v-else-if="!matchesError" class="table-scroll"><NDataTable :columns="matchColumns" :data="matches" :loading="matchesLoading" :row-key="(r:any)=>r.id" size="small" /></div>
            <NPagination v-if="matchTotal > matchPerPage" v-model:page="matchPage" :page-count="Math.ceil(matchTotal/matchPerPage)" style="margin-top:12px;justify-content:flex-end"  />
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>

    <!-- 人类加入对局：选对手弹窗 -->
    <NModal v-model:show="showJoinModal" preset="card" title="选择对手 Bot" style="width:min(480px, calc(100vw - 24px))"
      @update:show="(v) => { if (!v) joiningAsHuman = null }">
      <NText depth="3" style="display:block;margin-bottom:12px">
        选 {{ (game?.gamerQuantity ?? 2) - 1 }} 个代码 Bot 作为对手
      </NText>
      <div class="table-scroll"><NDataTable
        :columns="opponentColumns"
        :data="allGamers.filter((g:any) => g.id !== joiningHumanBotId && g.type === 'code' && !g.disabled)"
        :row-key="(r:any) => r.id"
        :checked-row-keys="selectedOpponents"
        size="small"
        @update:checked-row-keys="(keys:any) => selectedOpponents = keys"
      /></div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showJoinModal = false">取消</NButton>
          <NButton
            type="primary"
            :disabled="selectedOpponents.length !== (game?.gamerQuantity ?? 2) - 1"
            :loading="launching"
            @click="confirmJoinAsHuman"
          >
            发起对局并加入
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 提交 Bot 弹窗 -->
    <NModal v-model:show="showSubmitModal" title="提交 Bot" preset="card" style="width:min(640px, calc(100vw - 24px));max-height:90vh;overflow-y:auto">
      <NForm :model="submitForm" label-placement="left" label-width="110px">
        <NFormItem label="Bot 名称" required>
          <NInput v-model:value="submitForm.title" placeholder="给你的 Bot 起个名字" />
        </NFormItem>
        <NFormItem label="Bot 类型">
          <NRadioGroup v-model:value="submitForm.type">
            <NSpace vertical :size="6">
              <NRadio value="code">🖥️ 代码 Bot — 上传代码，在服务器沙箱运行</NRadio>
              <NRadio value="external">🔗 外部 Bot — 你的程序主动轮询服务器（无需公网 IP）</NRadio>
              <NRadio value="webhook">📡 Webhook Bot — 服务器主动调你的 URL（需公网 IP）</NRadio>
              <NRadio v-if="game?.allowHuman" value="human">🧑 真人 — 在浏览器网页上手动输入移动</NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>
        <NFormItem v-if="submitForm.type === 'code'" label="是否开源">
          <NSwitch v-model:value="submitForm.opensource" />
        </NFormItem>
        <template v-if="submitForm.type === 'code'">
          <NFormItem label="语言" required>
            <NSelect v-model:value="submitForm.language" :options="botLanguageOptions" style="width:180px" />
          </NFormItem>
          <NFormItem label="代码" required>
            <NInput v-model:value="submitForm.code" type="textarea" :rows="14" :placeholder="codePlaceholder" style="font-family:monospace;font-size:13px" />
          </NFormItem>
        </template>
        <template v-else-if="submitForm.type === 'external'">
          <NAlert type="success" :show-icon="false" style="font-size:13px">
            <b>无需公网 IP，你的程序主动轮询服务器获取回合：</b>
            <pre style="margin:8px 0;font-size:11px;white-space:pre-wrap">{{ externalBotDoc }}</pre>
          </NAlert>
        </template>
        <template v-else-if="submitForm.type === 'webhook'">
          <NFormItem label="Webhook URL" required>
            <NInput v-model:value="submitForm.webhookUrl" placeholder="https://your-server.com/bot" />
          </NFormItem>
          <NFormItem label="签名密钥">
            <NInput v-model:value="submitForm.webhookSecret" placeholder="可选" />
          </NFormItem>
          <NAlert type="warning" :show-icon="false" style="font-size:13px">
            ⚠️ 需要公网 IP 或域名。
          </NAlert>
        </template>

      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showSubmitModal = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSubmitBot">提交</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- API Key 弹窗 -->
    <NModal v-model:show="showApiKeyModal" preset="card" title="Bot API Key" style="width:min(580px, calc(100vw - 24px))">
      <NAlert type="success" style="margin-bottom:12px">Bot 创建成功！API Key <b>只显示一次</b>，请立即保存。</NAlert>
      <NFormItem label="Bot API Key">
        <NInputGroup>
          <NInput :value="createdApiKey" readonly style="font-family:monospace;font-size:13px" />
          <NButton @click="copyApiKey">{{ apiKeyCopied ? '✓ 已复制' : '复制' }}</NButton>
        </NInputGroup>
      </NFormItem>
      <NFormItem label="Gamer ID">
        <NInput :value="String(createdGamerId)" readonly style="font-family:monospace" />
      </NFormItem>
      <NAlert type="info" :show-icon="false" style="font-size:13px;margin-top:8px">
        <b>Python 示例代码：</b>
        <pre style="margin:8px 0;font-size:11px;white-space:pre-wrap">{{ generatedExternalCode }}</pre>
      </NAlert>
      <template #footer>
        <NSpace justify="end">
          <NButton type="primary" @click="showApiKeyModal = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { BOTZONE_LANGUAGE_OPTIONS } from '~/utils/botzone-language'
import { botTemplate } from '~/utils/bot-templates'
import { h, computed } from 'vue'
import { NButton, NTag, NSpace, NInputGroup, NEmpty, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const queryPagePath = route.path
const gameId = computed(() => Number(route.params.id))
const competeApi = useCompeteApi()
const queryText = (value: unknown) => typeof value === 'string' ? value : ''
const positiveQueryInt = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(queryText(value))
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}
let applyingQuery = false
const authStore = useAuthStore()
const message = useMessage()

// ── Game ──
const loading = ref(true)
const game = ref<any>(null)
const gameError = ref('')
const activeTab = ref(['leaderboard', 'participate', 'matches'].includes(queryText(route.query.tab)) ? queryText(route.query.tab) : 'participate')

async function fetchGame() {
  loading.value = true
  gameError.value = ''
  try {
    const res = await competeApi.getGame(gameId.value)
    game.value = res.data || null
    if (!game.value) gameError.value = '游戏不存在。'
  } catch (e) { console.error(e); game.value = null; gameError.value = '请检查连接后重试。' }
  finally { loading.value = false }
}

onMounted(async () => {
  await fetchGame()
  if (game.value) {
    if (authStore.isLoggedIn && activeTab.value === 'participate') { fetchMyBots(); fetchAllGamers() }
    else if (activeTab.value === 'matches') fetchMatches()
    else if (activeTab.value === 'leaderboard') fetchLeaderboard()
  }
})

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn && game.value && activeTab.value === 'participate') { fetchMyBots(); fetchAllGamers() }
})

// ── Leaderboard ──
const leaderboard = ref<any[]>([])
const leaderboardLoading = ref(false)
const leaderboardError = ref('')
const showNonBot = ref(queryText(route.query.board) === 'outer')
const leaderboardBoard = computed(() => showNonBot.value ? 'outer' : 'inner')

const TYPE_LABEL: Record<string, string> = { code: '', human: '🧑 真人', external: '🔗 外部', webhook: '🔗 Webhook' }

async function fetchLeaderboard() {
  leaderboardLoading.value = true
  leaderboardError.value = ''
  try {
    const res = await competeApi.getLeaderboard(gameId.value, leaderboardBoard.value as 'inner'|'outer')
    leaderboard.value = Array.isArray(res.data) ? res.data : []
  } catch (e) { console.error(e); leaderboardError.value = '请检查连接后重试。' }
  finally { leaderboardLoading.value = false }
}

const leaderboardColumns = computed<DataTableColumns<any>>(() => [
  { title: '#', key: '_rank', width: 50, render: (_r:any, i:number) => i + 1 },
  { title: 'Bot 名称', key: 'name', render: (r:any) => h('span', [
    gamerLink(r.gamerId, r.name || `Bot#${r.gamerId}`),
    (TYPE_LABEL[r.type] || '') ? h('span', { style: 'margin-left:6px;font-size:12px;color:#999' }, TYPE_LABEL[r.type]) : null,
  ]) },
  { title: showNonBot.value ? 'ELO（外榜）' : 'ELO（内榜）', key: 'elo', width: 100 },
  { title: '胜场', key: 'wins', width: 70 },
  { title: '总场', key: 'total', width: 70 },
  { title: '胜率', key: 'winRate', width: 80, render: (r:any) => r.winRate != null ? `${(r.winRate*100).toFixed(1)}%` : '-' },
])

// ── My Bots ──
const myBots = ref<any[]>([])
const myBotsLoading = ref(false)
const myBotsError = ref('')
const myHumanGamer = computed(() => myBots.value.find((b: any) => b.type === 'human') ?? null)

async function fetchMyBots() {
  if (!authStore.user) return
  myBotsLoading.value = true
  myBotsError.value = ''
  try {
    const res = await competeApi.listGamers({ gameId: gameId.value, userId: authStore.user?.id, page: 1, perPage: 100 })
    const all: any[] = (res.data as any)?.items || []
    myBots.value = all.filter((g:any) => g.userId === authStore.user?.id)
  } catch (e) { console.error(e); myBotsError.value = '请检查连接后重试。' }
  finally { myBotsLoading.value = false }
}

// ── All Gamers ──
const allGamers = ref<any[]>([])
const allGamersLoading = ref(false)
const allGamersError = ref('')
const otherGamers = computed(() => allGamers.value.filter((g:any) => !myBots.value.some((mb:any) => mb.id === g.id) && g.type === 'code' && !g.disabled))

// IDs of other-gamers currently selected (subset of selectedGamerIds)
const otherGamerCheckedKeys = computed(() =>
  selectedGamerIds.value.filter(id => otherGamers.value.some((g:any) => g.id === id))
)

function onOtherGamerCheck(keys: (string | number)[]) {
  // Remove all other-gamer IDs from selection, then add newly checked ones
  const myIds = selectedGamerIds.value.filter(id => myBots.value.some((b:any) => b.id === id))
  const newOtherIds = (keys as number[]).slice(0, Math.max(0, (game.value?.gamerQuantity ?? 2) - myIds.length))
  selectedGamerIds.value = [...myIds, ...newOtherIds]
}

async function fetchAllGamers() {
  allGamersLoading.value = true
  allGamersError.value = ''
  try {
    const res = await competeApi.listGamers({ gameId: gameId.value, page: 1, perPage: 100 })
    allGamers.value = (res.data as any)?.items || []
  } catch (e) { console.error(e); allGamersError.value = '请检查连接后重试。' }
  finally { allGamersLoading.value = false }
}

// ── Launch Match ──
const selectedGamerIds = ref<number[]>([])
const launching = ref(false)

const selectedGamerNames = computed(() =>
  selectedGamerIds.value.map(id => {
    const b = [...myBots.value, ...allGamers.value].find((g:any) => g.id === id)
    return b?.title || b?.name || `Bot#${id}`
  })
)

function toggleGamer(id: number, checked: boolean) {
  if (checked) {
    if (selectedGamerIds.value.length < (game.value?.gamerQuantity ?? 2)) {
      selectedGamerIds.value = [...selectedGamerIds.value, id]
    }
  } else {
    selectedGamerIds.value = selectedGamerIds.value.filter(x => x !== id)
  }
}

async function handleLaunchMatch() {
  launching.value = true
  try {
    const res = await competeApi.launchMatch(gameId.value, selectedGamerIds.value)
    message.success('对局已发起！')
    selectedGamerIds.value = []
    navigateTo(`/compete/matches/${(res.data as any)?.id || ''}`)
  } catch (e: any) {
    message.error(e?.response?.data?.message || '发起失败')
  } finally {
    launching.value = false
  }
}

function botTypeLabel(bot: any) {
  const m: Record<string, string> = { code: bot.language || 'code', webhook: 'Webhook', external: '外部轮询', human: '真人' }
  return m[bot.type] || bot.type
}
function botTagType(type: string): 'default'|'info'|'success'|'warning'|'error' {
  const m: Record<string, any> = { code: 'info', webhook: 'warning', external: 'success', human: 'error' }
  return m[type] || 'default'
}

const allGamerColumns: DataTableColumns<any> = [
  { type: 'selection', disabled: (row) => selectedGamerIds.value.length >= (game.value?.gamerQuantity ?? 2) && !selectedGamerIds.value.includes(row.id) },
  { title: 'Bot 名称', key: 'name', render: (r:any) => gamerLink(r.id, r.title || r.name || `Bot#${r.id}`) },
  { title: 'ELO', key: 'elo', width: 80 },
  { title: '用户', key: 'user', width: 100, render: (r:any) => {
    const userId = r.userId ?? r.user?.id
    const username = r.user?.username || '-'
    return Number.isSafeInteger(Number(userId)) && Number(userId) > 0 ? h('a', { href: `/users/${userId}` }, username) : h('span', username)
  } },
]

// ── Human bot join flow ──
const joiningAsHuman = ref<number | null>(null)
const joiningHumanBotId = ref<number | null>(null)
const showJoinModal = ref(false)
const selectedOpponents = ref<number[]>([])

const opponentColumns: DataTableColumns<any> = [
  { type: 'selection', disabled: (row) => selectedOpponents.value.length >= (game.value?.gamerQuantity ?? 2) - 1 && !selectedOpponents.value.includes(row.id) },
  { title: 'Bot 名称', key: 'name', render: (r:any) => r.title || r.name || `Bot#${r.id}` },
  { title: 'ELO', key: 'elo', width: 80 },
]

function joinAsHuman(bot: any) {
  joiningHumanBotId.value = bot.id
  selectedOpponents.value = []
  showJoinModal.value = true
  if (!allGamers.value.length) fetchAllGamers()
}

// 一键参赛：自动找/创建 human bot，然后弹选对手窗
async function quickJoinAsHuman() {
  joiningAsHuman.value = -1 // loading state
  try {
    // Check if already has a human bot for this game
    await fetchMyBots()
    const existing = myBots.value.find((b: any) => b.type === 'human')
    if (existing) {
      joinAsHuman(existing)
    } else {
      // Auto-create human bot silently
      const username = authStore.user?.username || authStore.user?.email || '玩家'
      const res = await competeApi.createGamer({
        gameId: gameId.value,
        title: `${username} 的参赛席位`,
        type: 'human' as any,
        language: 'webhook',
        code: '',
        opensource: false,
      })
      await fetchMyBots()
      const created = res.data as any
      joinAsHuman({ id: created.id })
    }
  } catch (e: any) {
    message.error(e?.response?.data?.message || '操作失败')
    joiningAsHuman.value = null
  } finally {
    // Always clear loading unless the join modal is actively open (modal handles its own state)
    if (!showJoinModal.value) joiningAsHuman.value = null
  }
}

async function confirmJoinAsHuman() {
  if (!joiningHumanBotId.value) return
  launching.value = true
  try {
    const ids = [joiningHumanBotId.value, ...selectedOpponents.value]
    const res = await competeApi.launchMatch(gameId.value, ids)
    showJoinModal.value = false
    message.success('对局已发起，请在详情页等待你的回合')
    navigateTo(`/compete/matches/${(res.data as any)?.id || ''}`)
  } catch (e: any) {
    message.error(e?.response?.data?.message || '发起失败')
  } finally {
    launching.value = false
  }
}

// ── Matches ──
const matches = ref<any[]>([])
const matchesLoading = ref(false)
const matchesError = ref('')
const matchPage = ref(positiveQueryInt(route.query.page, 1))
const matchPerPage = ref(positiveQueryInt(route.query.perPage, 10, 100))
const matchTotal = ref(0)

watch([activeTab, showNonBot, matchPage, matchPerPage], () => {
  if (applyingQuery || router.currentRoute.value.path !== queryPagePath) return
  const query: Record<string, any> = { ...route.query }
  for (const key of ['tab', 'board', 'page', 'perPage']) Reflect.deleteProperty(query, key)
  if (activeTab.value !== 'participate') query.tab = activeTab.value
  if (activeTab.value === 'leaderboard' && showNonBot.value) query.board = 'outer'
  if (activeTab.value === 'matches') {
    if (matchPage.value > 1) query.page = String(matchPage.value)
    if (matchPerPage.value !== 10) query.perPage = String(matchPerPage.value)
  }
  void router.push({ query })
})
watch(() => route.query, async () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingQuery = true
  const tab = queryText(route.query.tab)
  activeTab.value = ['leaderboard', 'participate', 'matches'].includes(tab) ? tab : 'participate'
  showNonBot.value = queryText(route.query.board) === 'outer'
  matchPage.value = positiveQueryInt(route.query.page, 1)
  matchPerPage.value = positiveQueryInt(route.query.perPage, 10, 100)
  await nextTick()
  applyingQuery = false
  if (activeTab.value === 'matches') fetchMatches()
  else if (activeTab.value === 'leaderboard') fetchLeaderboard()
  else if (activeTab.value === 'participate' && authStore.isLoggedIn && game.value) { fetchMyBots(); fetchAllGamers() }
}, { deep: true })

async function fetchMatches() {
  matchesLoading.value = true
  matchesError.value = ''
  try {
    const res = await competeApi.listMatches({ gameId: gameId.value, page: matchPage.value, perPage: matchPerPage.value })
    const data = res.data as any
    matches.value = data?.items || []
    matchTotal.value = data?.total || 0
  } catch (e) { console.error(e); matchesError.value = '请检查连接后重试。' }
  finally { matchesLoading.value = false }
}

const statusLabel: Record<number,string> = { 0:'等待中', 1:'进行中', 2:'已完成', 3:'错误' }
const statusType: Record<number,any> = { 0:'default', 1:'info', 2:'success', 3:'error' }


function gamerLink(gamerId: number | string, name: string) {
  if (!Number.isSafeInteger(Number(gamerId)) || Number(gamerId) < 1) return h('span', name)
  return h('a', { href: `/compete/gamer/${gamerId}` }, name)
}

function matchLink(matchId: number, content: any) {
  if (!Number.isSafeInteger(Number(matchId)) || Number(matchId) < 1) return h('span', content)
  return h('a', { href: `/compete/matches/${matchId}` }, content)
}

const matchColumns: DataTableColumns<any> = [
  { title: '查看', key: 'replay', width: 96, render: r => matchLink(r.id, r.status === 2 ? '浏览回放' : '查看对局') },
  { title: 'ID', key: 'id', width: 55, render: r => matchLink(r.id, `#${r.id}`) },
  { title: '状态', key: 'status', width: 80, render: r => h(NTag, { size:'small', type:statusType[r.status] }, () => statusLabel[r.status]??r.status) },
  { title: '参与者', key: 'links', render: r => {
    const links = r.links?.slice().sort((a:any,b:any) => a.index - b.index) || []
    if (!links.length) return h('span', { style: 'color:#aaa' }, '-')
    const parts: any[] = []
    links.forEach((l: any, i: number) => {
      if (i > 0) parts.push(h('span', { style: 'color:#999;margin:0 4px' }, 'vs'))
      parts.push(gamerLink(l.gamerId, l.gamer?.title || l.gamer?.name || `Bot#${l.gamerId}`))
    })
    return h('span', parts)
  }},
  { title: '胜者', key: 'winner', width: 150, render: r => {
    if (r.status !== 2) return h('span', { style: 'color:#aaa' }, '-')
    try {
      const fr = typeof r.result === 'string' ? JSON.parse(r.result).finalResult : r.result?.finalResult
      if (!fr) return h('span', { style: 'color:#aaa' }, '-')
      const maxScore = Math.max(...Object.values(fr) as number[])
      const winnerEntries = Object.entries(fr).filter(([,v]) => v === maxScore)
      if (winnerEntries.length === Object.keys(fr).length) return h('span', { style: 'color:#f0a020' }, '平局')
      const gamerMap = Object.fromEntries((r.links||[]).map((l:any) => [String(l.gamerId), { name: l.gamer?.title||l.gamer?.name||`Bot#${l.gamerId}`, id: l.gamerId }]))
      const parts: any[] = []
      winnerEntries.forEach(([id], i) => {
        if (i > 0) parts.push(h('span', ', '))
        const g = gamerMap[id]
        if (g) parts.push(h('span', g.name))
        else parts.push(h('span', `Bot#${id}`))
      })
      return h('span', { style: 'color:#18a058;font-weight:600' }, parts)
    } catch { return h('span', { style: 'color:#aaa' }, '-') }
  }},
  { title: '时间', key: 'createdAt', width: 120, render: r => matchLink(r.id, r.createdAt ? dayjs(r.createdAt).format('MM-DD HH:mm') : '-') },
]

// ── Submit Bot ──
const showSubmitModal = ref(false)
const showApiKeyModal = ref(false)
const createdApiKey = ref('')
const createdGamerId = ref(0)

const apiKeyCopied = ref(false)
function copyApiKey() {
  navigator.clipboard?.writeText(createdApiKey.value)
  apiKeyCopied.value = true
  setTimeout(() => { apiKeyCopied.value = false }, 2000)
}
const submitting = ref(false)
const submitForm = ref({
  title: '', type: 'code' as string,
  language: 'python', code: '', opensource: true, webhookUrl: '', webhookSecret: '',
})

const botLanguageOptions = BOTZONE_LANGUAGE_OPTIONS
const codePlaceholder = computed(() => botTemplate(submitForm.value.language) ?? "")


const externalBotDoc = computed(() => {
  const server = new URL(useRuntimeConfig().public.apiBase, window.location.origin).href.replace(/\/$/, '')
  return `import requests, time, json
SERVER = "${server}"
GAMER_ID = <你的GamerId>
BOT_KEY = "<你的BotApiKey>"
HEADERS = {"X-Bot-Key": BOT_KEY}

while True:
    r = requests.get(f"{SERVER}/compete/bot-turn",
                     params={"gamerId": GAMER_ID},
                     headers=HEADERS, timeout=35)
    if r.status_code == 200:
        data = r.json()
        if not data.get("waiting"):
            move = json.dumps({"0": 4})  # 你的决策
            requests.post(f"{SERVER}/compete/bot-respond",
                          json={"turnToken": data["turnToken"], "response": move},
                          headers=HEADERS, timeout=10)
    time.sleep(0.1)`
})

const generatedExternalCode = computed(() => {
  const server = new URL(useRuntimeConfig().public.apiBase, window.location.origin).href.replace(/\/$/, '')
  return `import requests, time, json
SERVER = "${server}"
GAMER_ID = ${createdGamerId.value}
BOT_KEY = "${createdApiKey.value}"
HEADERS = {"X-Bot-Key": BOT_KEY}

while True:
    r = requests.get(f"{SERVER}/compete/bot-turn",
                     params={"gamerId": GAMER_ID},
                     headers=HEADERS, timeout=35)
    if r.status_code == 200:
        data = r.json()
        if not data.get("waiting"):
            move = json.dumps({"0": 4})  # TODO: 实现你的决策
            requests.post(f"{SERVER}/compete/bot-respond",
                          json={"turnToken": data["turnToken"], "response": move},
                          headers=HEADERS, timeout=10)
    time.sleep(0.1)`
})

async function handleSubmitBot() {
  if (!submitForm.value.title.trim()) { message.warning('请填写 Bot 名称'); return }
  const t = submitForm.value.type
  if (t === 'code' && !submitForm.value.code.trim()) { message.warning('请填写代码'); return }
  if (t === 'webhook' && !submitForm.value.webhookUrl.trim()) { message.warning('请填写 Webhook URL'); return }

  submitting.value = true
  const isExternal = t === 'webhook' || t === 'external' || t === 'human'
  try {
    const res = await competeApi.createGamer({
      gameId: gameId.value,
      title: submitForm.value.title,
      type: t as any,
      language: isExternal ? 'webhook' : submitForm.value.language,
      code: isExternal ? '' : submitForm.value.code,
      opensource: submitForm.value.opensource,
      webhookUrl: t === 'webhook' ? submitForm.value.webhookUrl : undefined,
      webhookSecret: t === 'webhook' && submitForm.value.webhookSecret ? submitForm.value.webhookSecret : undefined,
    })
    const created = res.data as any
    showSubmitModal.value = false
    submitForm.value = { title: '', type: 'code', language: 'python', code: '', opensource: true, webhookUrl: '', webhookSecret: '' }
    fetchMyBots()

    if (t === 'external' && created?.botApiKey) {
      createdGamerId.value = created.id
      createdApiKey.value = created.botApiKey
      showApiKeyModal.value = true
    } else if (t === 'human') {
      message.success('真人 Bot 创建成功！在参赛页面点击 🎮 加入对局')
    } else {
      message.success('Bot 提交成功！')
    }
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

useHead(computed(() => ({ title: `${game.value?.title || '游戏'} — Leverage OJ` })))
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.compete-game-page { display: flex; flex-direction: column; gap: 16px; }
.game-header { min-width: 0; }
.game-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 8px 0; }
.game-actions, .section-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.game-actions { margin-top: 18px; }
.section-card { margin-bottom: 16px; }
.section-heading, .launch-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.state-alert { margin: 12px 0; }
.empty-state { padding: 28px 0; }
.table-scroll { max-width: 100%; overflow-x: auto; }

.bot-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid var(--n-border-color, #e0e0e6);
  border-radius: 8px;
  gap: 12px;
  transition: border-color 0.2s;
}
.bot-card.selected {
  border-color: #18a058;
  background: #f0faf4;
}

.bot-card.disabled {
  opacity: 0.5;
  background: #fafafa;
  cursor: not-allowed;
}
@media (max-width: 767px) {
  .game-actions > :deep(.n-button) { flex: 1; }
  .bot-card { flex-wrap: wrap; padding: 10px; }
  .bot-details { flex-basis: 100% !important; }
  .bot-details :deep(.n-text) { overflow-wrap: anywhere; }
  .bot-tools { margin-left: auto; }
  .launch-actions > :deep(.n-space) { width: 100%; justify-content: flex-end; }
}
</style>
