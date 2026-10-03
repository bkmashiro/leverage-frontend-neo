<template>
  <div class="leaderboard-page">
    <!-- 面包屑 -->
    <NBreadcrumb style="margin-bottom:12px">
      <NBreadcrumbItem @click="navigateTo('/compete')">竞技场</NBreadcrumbItem>
      <NBreadcrumbItem>全局排行榜</NBreadcrumbItem>
    </NBreadcrumb>

    <div class="page-header">
      <NH2>🏆 全局排行榜</NH2>
    </div>

    <!-- 过滤栏 -->
    <NCard size="small" style="margin-bottom:16px">
      <NSpace align="center" wrap>
        <NSpace align="center">
          <NText depth="3">游戏：</NText>
          <NSelect
            v-model:value="selectedGameId"
            :options="gameOptions"
            style="width:180px"
            placeholder="全部游戏"
            clearable
          />
        </NSpace>
        <NSpace align="center">
          <NText depth="3">榜单：</NText>
          <NRadioGroup v-model:value="selectedBoard">
            <NRadioButton value="outer">外榜</NRadioButton>
            <NRadioButton value="inner">内榜</NRadioButton>
          </NRadioGroup>
        </NSpace>
        <NSpace align="center">
          <NText depth="3">显示数量：</NText>
          <NSelect
            v-model:value="selectedLimit"
            :options="limitOptions"
            style="width:100px"
          />
        </NSpace>
        <NButton secondary @click="fetchLeaderboard">刷新</NButton>
      </NSpace>
    </NCard>

    <!-- 排行榜表格 -->
    <NCard>
      <NSpin :show="loading">
        <NEmpty v-if="!loading && rows.length === 0" description="暂无数据" style="padding:48px 0" />
        <NDataTable
          v-else
          :columns="columns"
          :data="rows"
          :bordered="false"
          :row-key="(row: any) => row.id"
          size="small"
        />
      </NSpin>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NProgress, NText } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const queryPagePath = route.path
const competeApi = useCompeteApi()

function queryText(value: unknown) { return typeof value === 'string' ? value : '' }
function positiveQueryInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(queryText(value))
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}
let applyingQuery = false

// ─── 过滤条件 ──────────────────────────────────────────────────────────────────
const selectedGameId = ref<number | null>(positiveQueryInt(route.query.gameId, 0) || null)
const selectedBoard = ref(queryText(route.query.board) === 'inner' ? 'inner' : 'outer')
const selectedLimit = ref([10, 20, 50, 100].includes(Number(queryText(route.query.limit))) ? Number(route.query.limit) : 20)

const limitOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

// ─── 游戏列表 ──────────────────────────────────────────────────────────────────
const games = ref<any[]>([])

const gameOptions = computed(() => [
  { label: '全部游戏', value: null },
  ...games.value.map(g => ({ label: g.title || g.name, value: g.id })),
])

async function fetchGames() {
  try {
    const res = await competeApi.listGames({ page: 1, perPage: 100 })
    games.value = res.data.items || []
  }
  catch (e) {
    console.error('fetchGames', e)
  }
}

// ─── 排行榜数据 ────────────────────────────────────────────────────────────────
const rows = ref<any[]>([])
const loading = ref(false)

async function fetchLeaderboard() {
  loading.value = true
  try {
    const params: { gameId?: number; limit?: number; board?: string } = {
      limit: selectedLimit.value,
      board: selectedBoard.value,
    }
    if (selectedGameId.value != null) {
      params.gameId = selectedGameId.value
    }
    const res = await competeApi.getGlobalLeaderboard(params)
    rows.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) {
    console.error('fetchLeaderboard', e)
  }
  finally {
    loading.value = false
  }
}

watch(() => route.query, async () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingQuery = true
  selectedGameId.value = positiveQueryInt(route.query.gameId, 0) || null
  selectedBoard.value = queryText(route.query.board) === 'inner' ? 'inner' : 'outer'
  const limit = Number(queryText(route.query.limit))
  selectedLimit.value = [10, 20, 50, 100].includes(limit) ? limit : 20
  await nextTick()
  applyingQuery = false
  fetchLeaderboard()
})

watch([selectedGameId, selectedBoard, selectedLimit], () => {
  if (applyingQuery || router.currentRoute.value.path !== queryPagePath) return
  const query = { ...route.query }
  delete query.gameId
  delete query.board
  delete query.limit
  if (selectedGameId.value != null) query.gameId = String(selectedGameId.value)
  if (selectedBoard.value !== 'outer') query.board = selectedBoard.value
  if (selectedLimit.value !== 20) query.limit = String(selectedLimit.value)
  void router.push({ query })
})

// ─── 表格列 ────────────────────────────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉']

const columns: DataTableColumns<any> = [
  {
    title: '排名',
    key: 'rank',
    width: 70,
    render(_row, index) {
      const rank = index + 1
      const medal = MEDALS[index] ?? ''
      return h('span', { style: 'font-weight:600' }, medal ? `${medal} ${rank}` : `#${rank}`)
    },
  },
  {
    title: 'Bot',
    key: 'title',
    render(row) {
      if (Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0) return h('a', { href: `/compete/gamer/${row.id}` }, row.title || `Bot#${row.id}`)
      return h('span', row.title || '-')
    },
  },
  {
    title: '游戏',
    key: 'game',
    render(row) {
      const title = row.game?.title || row.game?.name || '-'
      if (!Number.isSafeInteger(Number(row.game?.id)) || Number(row.game.id) < 1) return h('span', title)
      return h('a', { href: `/compete/games/${row.game.id}` }, title)
    },
  },
  {
    title: '创建者',
    key: 'user',
    render(row) {
      const userId = row.userId ?? row.user?.id
      const username = row.user?.username || '-'
      return Number.isSafeInteger(Number(userId)) && Number(userId) > 0 ? h('a', { href: `/users/${userId}` }, username) : h('span', username)
    },
  },
  {
    title: 'ELO',
    key: 'elo',
    width: 100,
    render(row) {
      const elo = row.elo ?? row.eloExternal ?? 1200
      const high = elo > 1300
      return h(
        NText,
        { strong: true, type: high ? 'warning' : 'default', style: high ? 'font-size:15px' : '' },
        { default: () => String(elo) },
      )
    },
  },
  {
    title: '胜率',
    key: 'winRate',
    width: 150,
    render(row) {
      const pct = row.winRate != null
        ? Math.round(row.winRate * 100)
        : (row.totalMatches ? Math.round((row.wins / row.totalMatches) * 100) : 0)
      return h(
        'div',
        { style: 'display:flex;align-items:center;gap:6px' },
        [
          h(NProgress, {
            type: 'line',
            percentage: pct,
            showIndicator: false,
            style: 'width:80px',
            railStyle: 'background:#e0e0e0',
            color: pct >= 60 ? '#18a058' : pct >= 40 ? '#f0a020' : '#e03030',
          } as any),
          h('span', { style: 'font-size:12px;color:#888' }, `${pct}%`),
        ],
      )
    },
  },
  {
    title: '胜/负/总',
    key: 'record',
    width: 100,
    render(row) {
      const wins = row.wins ?? 0
      const losses = (row.totalMatches ?? 0) - (row.wins ?? 0) - (row.draws ?? 0)
      const total = row.totalMatches ?? 0
      return h('span', { style: 'font-size:13px' }, `${wins}/${Math.max(losses, 0)}/${total}`)
    },
  },
]

// ─── 自动刷新（30s） ──────────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchGames()
  await fetchLeaderboard()
  refreshTimer = setInterval(fetchLeaderboard, 30_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

useHead({ title: '全局排行榜 — Leverage OJ' })
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.leaderboard-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header :deep(.n-h2) {
  margin: 0;
}
</style>
