<template>
  <div class="compete-page">
    <div class="page-header">
      <div>
        <NH2>Bot 对战</NH2>
        <NText depth="3">选择游戏、参赛或查看已完成的对局。</NText>
      </div>
      <div class="header-actions">
        <NButton secondary @click="navigateTo('/compete/leaderboard')">全局排行榜</NButton>
        <NButton secondary @click="navigateTo('/compete/playground')">Bot 测试</NButton>
        <NButton secondary type="info" @click="navigateTo('/compete/learn')">Bot 学习中心</NButton>
        <NButton
          v-if="canCreateGame"
          secondary
          type="info"
          @click="navigateTo('/compete/games/new')"
        >
          创建游戏
        </NButton>
        <NButton secondary @click="showCreateRoom = true">创建房间</NButton>
      </div>
    </div>

    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- 游戏列表 -->
      <NTabPane name="games" tab="游戏列表">
        <NSpin :show="gamesLoading">
          <NAlert v-if="gamesError" type="error" title="游戏加载失败" class="state-alert">
            {{ gamesError }} <NButton text type="primary" @click="fetchGames">重试</NButton>
          </NAlert>
          <div v-else-if="games.length" class="game-grid">
            <NCard
              v-for="g in games"
              :key="g.id"
              class="game-card"
            >
              <template #header>
                <NSpace align="center" justify="space-between">
                  <a v-if="Number.isSafeInteger(Number(g.id)) && Number(g.id) > 0" :href="`/compete/games/${g.id}`"><NText strong>{{ g.title }}</NText></a>
                  <NText v-else strong>{{ g.title }}</NText>
                  <NTag size="small" :type="g.disabled ? 'error' : 'success'" :bordered="false">
                    {{ g.disabled ? '已禁用' : '进行中' }}
                  </NTag>
                </NSpace>
              </template>
              <NText depth="3" style="font-size:13px;display:block;min-height:36px">{{ g.description || '暂无描述' }}</NText>
              <NDivider style="margin:10px 0" />
              <NSpace size="small" style="margin-bottom:10px">
                <NTag size="small" :bordered="false">⏱ {{ g.timeLimit }}ms</NTag>
                <NTag size="small" :bordered="false">💾 {{ g.memoryLimit }}MB</NTag>
                <NTag size="small" :bordered="false">👥 {{ g.gamerQuantity }}人</NTag>
                <NTag v-if="g.activeBotCount != null" size="small" :bordered="false" type="success">🤖 {{ g.activeBotCount }} 活跃</NTag>
              </NSpace>
              <NButton
                type="primary"
                size="small"
                block
                @click.stop="navigateTo(`/compete/games/${g.id}`)"
              >
                查看游戏与参赛
              </NButton>
            </NCard>
          </div>
          <NEmpty v-else-if="!gamesLoading" description="暂无可浏览的游戏" class="empty-state" />
        </NSpin>
        <NPagination
          v-if="gamesTotal > gamesPageSize"
          v-model:page="gamesPage"
          :page-size="gamesPageSize"
          :item-count="gamesTotal"
          style="margin-top: 16px; justify-content: flex-end"
        />
      </NTabPane>

      <!-- 活跃房间 -->
      <NTabPane name="rooms" tab="活跃房间">
        <NSpin :show="roomsLoading">
          <NAlert v-if="roomsError" type="error" title="房间加载失败" class="state-alert">{{ roomsError }} <NButton text type="primary" @click="fetchRooms">重试</NButton></NAlert>
          <NEmpty v-else-if="!roomsLoading && rooms.length === 0" description="暂无活跃房间" class="empty-state" />
          <div v-else class="table-scroll"><NDataTable
            :columns="roomColumns"
            :data="rooms"
            :bordered="false"
            :row-key="(row: any) => row.id"
          /></div>
        </NSpin>
      </NTabPane>

      <!-- 历史对局 -->
      <NTabPane name="history" tab="历史对局">
        <!-- 过滤控件 -->
        <NSpace align="center" wrap style="margin-bottom:12px">
          <NSelect
            v-model:value="filterGameId"
            :options="[{ label: '全部游戏', value: null }, ...gameFilterOptions]"
            placeholder="全部游戏"
            clearable
            style="min-width:140px"
            @update:value="onFilterChange"
          />
          <NSelect
            v-model:value="filterStatus"
            :options="statusFilterOptions"
            placeholder="全部状态"
            clearable
            style="min-width:120px"
            @update:value="onFilterChange"
          />
          <NCheckbox v-model:checked="filterIsTest" @update:checked="onFilterChange">
            显示测试对局
          </NCheckbox>
        </NSpace>
        <NSpin :show="matchesLoading">
          <NAlert v-if="matchesError" type="error" title="对局加载失败" class="state-alert">{{ matchesError }} <NButton text type="primary" @click="fetchMatches">重试</NButton></NAlert>
          <NEmpty v-else-if="!matchesLoading && matches.length === 0" description="暂无对局记录" class="empty-state" />
          <div v-else class="table-scroll"><NDataTable
            :columns="matchColumns"
            :data="matches"
            :bordered="false"
            :row-key="(row: any) => row.id"
          /></div>
        </NSpin>
        <NPagination
          v-if="matchesTotal > matchesPageSize"
          v-model:page="matchesPage"
          :page-size="matchesPageSize"
          :item-count="matchesTotal"
          style="margin-top: 16px; justify-content: flex-end"
        />
      </NTabPane>
    </NTabs>

    <!-- 创建房间弹窗 -->
    <NModal
      v-model:show="showCreateRoom"
      title="创建房间"
      preset="card"
      style="width: min(420px, calc(100vw - 24px))"
    >
      <NForm label-placement="left" label-width="80">
        <NFormItem label="选择游戏">
          <NSelect
            v-model:value="newRoomGameId"
            :options="gameOptions"
            placeholder="请选择游戏"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreateRoom = false">取消</NButton>
          <NButton
            type="primary"
            :loading="creating"
            :disabled="!newRoomGameId"
            @click="handleCreateRoom"
          >
            创建
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NCheckbox, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const competeApi = useCompeteApi()
const message = useMessage()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const queryPagePath = route.path
const queryString = (value: unknown) => typeof value === 'string' ? value : ''
const positiveQueryInt = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(queryString(value))
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}
const safeTab = (value: unknown) => ['games', 'rooms', 'history'].includes(queryString(value)) ? queryString(value) : 'games'
const safeGameId = (value: unknown) => positiveQueryInt(value, 0) || null
const safeStatus = (value: unknown) => ['0', '1', '2', '3'].includes(queryString(value)) ? Number(value) : null
const safeBoolean = (value: unknown) => queryString(value) === 'true'
let applyingQuery = false

const canCreateGame = computed(() =>
  ['supervisor', 'admin', 'sa'].includes(authStore.user?.role ?? ''),
)

const activeTab = ref(safeTab(route.query.tab))

// ─── 游戏列表 ──────────────────────────────────────────────────────────────────
const gamesPage = ref(positiveQueryInt(route.query.page, 1))
const gamesPageSize = ref(positiveQueryInt(route.query.perPage, 20, 100))
const games = ref<any[]>([])
const gamesTotal = ref(0)
const gamesLoading = ref(false)
const gamesError = ref('')

async function fetchGames() {
  gamesLoading.value = true
  gamesError.value = ''
  try {
    const res = await competeApi.listGames({ page: gamesPage.value, perPage: gamesPageSize.value })
    games.value = res.data.items
    gamesTotal.value = res.data.total
  }
  catch (e) {
    console.error(e)
    gamesError.value = '请检查连接后重试。'
  }
  finally {
    gamesLoading.value = false
  }
}


// ─── 活跃房间 ──────────────────────────────────────────────────────────────────
const rooms = ref<any[]>([])
const roomsLoading = ref(false)
const roomsError = ref('')

async function fetchRooms() {
  roomsLoading.value = true
  roomsError.value = ''
  try {
    const res = await competeApi.listRooms()
    rooms.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) {
    console.error(e)
    roomsError.value = '请检查连接后重试。'
  }
  finally {
    roomsLoading.value = false
  }
}

const roomColumns: DataTableColumns<any> = [
  {
    title: '房间 ID',
    key: 'id',
    width: 100,
    render(row) {
      if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1) return h('span', `#${row.id ?? '-'}`)
      return h('a', { href: `/compete/room/${row.id}` }, `#${row.id}`)
    },
  },
  {
    title: '游戏',
    key: 'game',
    render(row) {
      const name = row.game?.name || '-'
      if (row.game?.id) {
        return h('a', { href: `/compete/games/${row.game.id}` }, name)
      }
      return h('span', name)
    },
  },
  {
    title: '房主',
    key: 'owner',
    render(row) {
      const username = row.owner?.username || '-'
      const ownerId = row.owner?.id
      return Number.isSafeInteger(Number(ownerId)) && Number(ownerId) > 0 ? h('a', { href: `/users/${ownerId}` }, username) : h('span', username)
    },
  },
  {
    title: '状态',
    key: 'open',
    width: 100,
    render(row) {
      return h(
        NTag,
        { type: row.open ? 'success' : 'default', size: 'small', bordered: false },
        { default: () => row.open ? '开放中' : '等待中' },
      )
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      if (!row.createdAt) return h('span', '-')
      return h('span', new Date(row.createdAt).toLocaleString('zh-CN'))
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => navigateTo(`/compete/room/${row.id}`) },
        { default: () => '进入' },
      )
    },
  },
]

// ─── 历史对局 ──────────────────────────────────────────────────────────────────
const matches = ref<any[]>([])
const matchesLoading = ref(false)
const matchesError = ref('')
const matchesPage = ref(positiveQueryInt(route.query.page, 1))
const matchesPageSize = ref(positiveQueryInt(route.query.perPage, 20, 100))
const matchesTotal = ref(0)

// 过滤状态
const filterGameId = ref<number | null>(safeGameId(route.query.gameId))
const filterStatus = ref<number | null>(safeStatus(route.query.status))
const filterIsTest = ref(safeBoolean(route.query.isTest))

const gameFilterOptions = computed(() =>
  games.value.map(g => ({ label: g.title || g.name, value: g.id })),
)

const statusFilterOptions = [
  { label: '全部状态', value: null },
  { label: '等待中', value: 0 },
  { label: '运行中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '失败', value: 3 },
]

function onFilterChange() { matchesPage.value = 1 }

async function fetchMatches() {
  matchesLoading.value = true
  matchesError.value = ''
  try {
    const params: { gameId?: number; page?: number; perPage?: number; status?: number; isTest?: boolean } = {
      page: matchesPage.value,
      perPage: matchesPageSize.value,
    }
    if (filterGameId.value != null) params.gameId = filterGameId.value
    if (filterStatus.value != null) params.status = filterStatus.value
    if (filterIsTest.value) params.isTest = true
    const res = await competeApi.listMatches(params)
    matches.value = res.data.items
    matchesTotal.value = res.data.total
  }
  catch (e) {
    console.error(e)
    matchesError.value = '请检查连接后重试。'
  }
  finally {
    matchesLoading.value = false
  }
}

const matchColumns: DataTableColumns<any> = [
  {
    title: '对局 ID',
    key: 'id',
    width: 80,
    render(row) {
      if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1) return h('span', '-')
      return h('a', { href: `/compete/matches/${row.id}` }, `#${row.id}`)
    },
  },
  {
    title: '游戏',
    key: 'game',
    render(row) {
      if (!Number.isSafeInteger(Number(row.game?.id)) || Number(row.game.id) < 1) return h('span', row.game?.name || row.game?.title || '-')
      return h('a', { href: `/compete/games/${row.game.id}` }, row.game.name || row.game.title || '-')
    },
  },
  {
    title: '参与 Bot',
    key: 'gamers',
    render(row) {
      const links = row.links?.slice().sort((a:any,b:any) => a.index - b.index)
      if (links?.length) {
        const parts: any[] = []
        links.forEach((l: any, i: number) => {
          if (i > 0) parts.push(h('span', { style: 'color:#999;margin:0 3px' }, 'vs'))
          const gamerId = l.gamerId ?? l.gamer?.id
          const gamerName = l.gamer?.title || l.gamer?.name || (gamerId ? `Bot#${gamerId}` : '-')
          parts.push(Number.isSafeInteger(Number(gamerId)) && Number(gamerId) > 0 ? h('a', { href: `/compete/gamer/${gamerId}` }, gamerName) : h('span', gamerName))
          const userId = l.userId ?? l.gamer?.userId ?? l.gamer?.user?.id
          const username = l.gamer?.user?.username || l.user?.username
          if (Number.isSafeInteger(Number(userId)) && Number(userId) > 0 && username) parts.push(h('a', { href: `/users/${userId}`, style: 'margin-left:4px' }, username))
        })
        return h('span', parts)
      }
      const names = (row.gamers || []).map((g: any) => typeof g === 'object' ? g.name : `Bot#${g}`).join(' vs ')
      return h('span', names || '-')
    },
  },
  {
    title: '胜者',
    key: 'winner',
    render(row) {
      if (row.status !== 2) return h('span', { style: 'color:#aaa' }, '-')
      try {
        const fr = typeof row.result === 'string' ? JSON.parse(row.result).finalResult : row.result?.finalResult
        if (!fr) return h('span', { style: 'color:#aaa' }, '-')
        const maxScore = Math.max(...Object.values(fr) as number[])
        const winnerEntries = Object.entries(fr).filter(([,v]) => v === maxScore)
        if (winnerEntries.length === Object.keys(fr).length) return h('span', { style: 'color:#f0a020' }, '平局')
        const gMap = Object.fromEntries((row.links||[]).map((l:any) => [String(l.gamerId), { name: l.gamer?.title||l.gamer?.name||`Bot#${l.gamerId}`, id: l.gamerId }]))
        const parts: any[] = []
        winnerEntries.forEach(([id], i) => {
          if (i > 0) parts.push(h('span', ', '))
          const g = gMap[id]
          parts.push(g ? h('span', g.name) : h('span', `Bot#${id}`))
        })
        return h('span', { style: 'color:#18a058;font-weight:600' }, parts)
      } catch { return h('span', { style: 'color:#aaa' }, '-') }
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      // status is a number: 0=PENDING, 1=RUNNING, 2=FINISHED, 3=ERROR
      const statusNumMap: Record<number, { type: 'default' | 'info' | 'success' | 'error'; label: string }> = {
        0: { type: 'default', label: '待评测' },
        1: { type: 'info', label: '评测中' },
        2: { type: 'success', label: '已完成' },
        3: { type: 'error', label: '失败' },
      }
      const info = statusNumMap[row.status as number] ?? { type: 'default' as const, label: String(row.status ?? '-') }
      return h(NTag, { type: info.type, size: 'small', bordered: false }, { default: () => info.label })
    },
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      if (!row.createdAt) return h('span', '-')
      return h('span', new Date(row.createdAt).toLocaleString('zh-CN'))
    },
  },
]

// ─── 创建房间 ──────────────────────────────────────────────────────────────────
const showCreateRoom = ref(false)
const newRoomGameId = ref<number | null>(null)
const creating = ref(false)

const gameOptions = computed(() =>
  games.value.map(g => ({ label: g.name, value: g.id })),
)

async function handleCreateRoom() {
  if (!newRoomGameId.value) return
  creating.value = true
  try {
    const res = await competeApi.createRoom({ gameId: newRoomGameId.value })
    message.success('房间创建成功')
    showCreateRoom.value = false
    navigateTo(`/compete/room/${res.data.id}`)
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '创建房间失败')
  }
  finally {
    creating.value = false
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────────
onMounted(() => {
  fetchGames()
  fetchRooms()
  fetchMatches()
})

watch([activeTab, gamesPage, gamesPageSize, matchesPage, matchesPageSize, filterGameId, filterStatus, filterIsTest], () => {
  if (applyingQuery || router.currentRoute.value.path !== queryPagePath) return
  const query: Record<string, any> = { ...route.query }
  for (const key of ['tab', 'page', 'perPage', 'gameId', 'status', 'isTest']) Reflect.deleteProperty(query, key)
  if (activeTab.value !== 'games') query.tab = activeTab.value
  if (activeTab.value === 'history') {
    if (matchesPage.value > 1) query.page = String(matchesPage.value)
    if (matchesPageSize.value !== 20) query.perPage = String(matchesPageSize.value)
    if (filterGameId.value != null) query.gameId = String(filterGameId.value)
    if (filterStatus.value != null) query.status = String(filterStatus.value)
    if (filterIsTest.value) query.isTest = 'true'
  } else if (activeTab.value === 'games') {
    if (gamesPage.value > 1) query.page = String(gamesPage.value)
    if (gamesPageSize.value !== 20) query.perPage = String(gamesPageSize.value)
  }
  void router.push({ query })
})

watch(() => route.query, async () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingQuery = true
  activeTab.value = safeTab(route.query.tab)
  gamesPage.value = positiveQueryInt(route.query.page, 1)
  gamesPageSize.value = positiveQueryInt(route.query.perPage, 20, 100)
  matchesPage.value = positiveQueryInt(route.query.page, 1)
  matchesPageSize.value = positiveQueryInt(route.query.perPage, 20, 100)
  filterGameId.value = safeGameId(route.query.gameId)
  filterStatus.value = safeStatus(route.query.status)
  filterIsTest.value = safeBoolean(route.query.isTest)
  await nextTick()
  applyingQuery = false
  if (activeTab.value === 'history') fetchMatches()
  if (activeTab.value === 'games') fetchGames()
}, { deep: true })

useHead({ title: '对战竞技 — Leverage OJ' })
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.compete-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.header-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.state-alert { margin: 12px 0; }
.empty-state { padding: 40px 0; }
.table-scroll { width: 100%; overflow-x: auto; }

.page-header :deep(.n-h2) {
  margin: 0;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 4px;
}

.game-card {
  min-width: 0;
}
@media (max-width: 767px) {
  .page-header { flex-direction: column; }
  .header-actions { justify-content: flex-start; width: 100%; }
  .game-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
