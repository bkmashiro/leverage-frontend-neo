<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="contest" class="contest-detail">
    <AdminViewBanner />
    <!-- 顶部信息 -->
    <div class="contest-header">
      <div class="contest-title-row">
        <NH2 style="margin: 0">{{ contest.name || contest.title }}</NH2>
        <NTag :type="statusType" size="medium" :bordered="false">{{ statusLabel }}</NTag>
      </div>
      <div class="contest-times">
        <NText depth="3">开始：{{ dayjs(contest.startTime).format('YYYY-MM-DD HH:mm') }}</NText>
        <NText depth="3" style="margin-left: 24px">结束：{{ dayjs(contest.endTime).format('YYYY-MM-DD HH:mm') }}</NText>
      </div>
      <!-- 倒计时 -->
      <div v-if="statusLabel !== '已结束'" class="contest-countdown">
        <NText v-if="statusLabel === '未开始'" type="info">
          距开始还有：{{ remainTime }}
        </NText>
        <NText v-else type="success">
          距结束还有：{{ remainTime }}
        </NText>
      </div>
    </div>

    <NDivider />

    <!-- Tab 切换 -->
    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- 题目 -->
      <NTabPane name="problems" tab="题目">
        <!-- 公告 -->
        <NAlert v-if="contest.notification || contest.description" type="info" title="公告" style="margin-bottom: 16px">
          <MarkdownView :content="contest.notification || contest.description || ''" />
        </NAlert>
        <div class="problems-list">
          <NDataTable
            :columns="problemColumns"
            :data="contest.problems || []"
            :row-key="(row: any) => row.id"
            :bordered="true"
          />
          <NEmpty v-if="!contest.problems || contest.problems.length === 0" description="暂无题目" />
        </div>
      </NTabPane>

      <!-- 提交记录 -->
      <NTabPane name="submissions" tab="提交记录">
        <NDataTable
          :columns="submissionColumns"
          :data="mySubmissions"
          :loading="submissionsLoading"
          :bordered="true"
          :row-key="(row: any) => row.id"
        />
        <div v-if="submissionsTotal > submissionsPageSize" style="display: flex; justify-content: center; margin-top: 16px">
          <NPagination
            v-model:page="submissionsPage"
            :page-count="Math.ceil(submissionsTotal / submissionsPageSize)"
          />
        </div>
      </NTabPane>

      <!-- 排行榜 -->
      <NTabPane name="ranking" tab="排行榜">
        <NSpin :show="rankLoading">
          <div v-if="rankData.length === 0 && !rankLoading" style="padding: 40px 0; text-align:center">
            <NEmpty description="暂无榜单数据" />
          </div>
          <div v-else class="icpc-table-wrapper">
            <table class="icpc-table">
              <thead>
                <tr>
                  <th class="col-rank">#</th>
                  <th class="col-user">选手</th>
                  <th class="col-solved">✓</th>
                  <th class="col-penalty">罚时</th>
                  <th v-for="cp in contest?.problems ?? []" :key="cp.problemId" class="col-problem" :style="cp.color ? `border-top: 3px solid ${cp.color}` : ''">
                    <a v-if="validContextId(cp.problemId)" :href="`/contests/${contestId}/problems/${cp.problemId}`" style="color: inherit; text-decoration: none">{{ cp.label || '?' }}</a>
                    <span v-else>{{ cp.label || '?' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rankData" :key="row.userId">
                  <td class="col-rank">{{ row.rank }}</td>
                  <td class="col-user">
                    <a v-if="Number.isInteger(row.userId) && row.userId > 0" :href="`/users/${row.userId}`" style="color:#2080f0">{{ row.username }}</a>
                    <span v-else>{{ row.username }}</span>
                    <div v-if="row.certifiedName" style="font-size:11px;color:#999">{{ row.certifiedName }}</div>
                  </td>
                  <td class="col-solved" style="font-weight:700;color:#18a058">{{ row.solved ?? row.accepts ?? 0 }}</td>
                  <td class="col-penalty" style="color:#666">{{ row.totalPenalty ?? row.penaltyMin ?? 0 }}</td>
                  <td v-for="cp in contest?.problems ?? []" :key="cp.problemId" class="col-problem-cell" :class="getCellClass(row, cp.problemId)">
                    <template v-if="row.problems?.[cp.problemId]">
                      <template v-if="row.problems[cp.problemId].frozen">
                        <span class="frozen-cell">?</span>
                        <div v-if="row.problems[cp.problemId].attempts > 0" class="attempt-count">+{{ row.problems[cp.problemId].attempts }}</div>
                      </template>
                      <template v-else-if="row.problems[cp.problemId].acTime !== null">
                        <span class="ac-time">{{ fmtMin(row.problems[cp.problemId].acTime) }}</span>
                        <div v-if="row.problems[cp.problemId].attempts > 0" class="attempt-count">+{{ row.problems[cp.problemId].attempts }}</div>
                      </template>
                      <template v-else-if="row.problems[cp.problemId].attempts > 0">
                        <span class="wa-count">{{ row.problems[cp.problemId].attempts }}</span>
                      </template>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </NSpin>
      </NTabPane>

      <!-- 注册 -->
      <NTabPane name="register" tab="注册">
        <div class="register-panel">
          <NAlert v-if="registrationClosed" type="warning" title="报名已截止" style="max-width: 400px">
            当前时间已超过报名截止时间，无法继续报名。
          </NAlert>
          <NCard v-else style="max-width: 400px">
            <div class="register-content">
              <NText>参加此竞赛可查看题目并参与排名。</NText>
              <NButton
                v-if="!registered"
                type="primary"
                size="large"
                :loading="registering"
                style="margin-top: 16px"
                @click="handleRegister"
              >
                参加竞赛
              </NButton>
              <NAlert v-else type="success" title="已参加" style="margin-top: 16px">
                您已成功参加此竞赛。
              </NAlert>
            </div>
          </NCard>
        </div>
      </NTabPane>
    </NTabs>
  </div>
  <div v-else>
    <NResult status="404" title="竞赛不存在" />
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { useMessage, useDialog } from 'naive-ui'
import dayjs from 'dayjs'
import type { Contest, Submission } from '~/types'
import { LANGUAGE_LABEL, memoryToKB } from '~/types'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const contestId = computed(() => Number(route.params.id))
const message = useMessage()
const dialog = useDialog()
const contestsApi = useContestsApi()

const contest = ref<Contest | null>(null)
const loading = ref(true)
const activeTab = ref('problems')
const nowTs = ref(Date.now())
const registrationClosed = computed(() => {
  const end = contest.value?.registrationEndTime
  if (!end) return false
  return nowTs.value > dayjs(end).valueOf()
})

// 竞赛状态
const statusLabel = computed(() => {
  if (!contest.value) return ''
  const now = dayjs()
  const start = dayjs(contest.value.startTime)
  const end = dayjs(contest.value.endTime)
  if (now.isBefore(start)) return '未开始'
  if (now.isAfter(end)) return '已结束'
  return '进行中'
})

const statusType = computed<'default' | 'info' | 'success' | 'warning' | 'error'>(() => {
  if (statusLabel.value === '进行中') return 'success'
  if (statusLabel.value === '已结束') return 'default'
  return 'info'
})

// 倒计时
const remainTime = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

function updateCountdown() {
  nowTs.value = Date.now()
  if (!contest.value) return
  const now = dayjs(nowTs.value)
  const start = dayjs(contest.value.startTime)
  const end = dayjs(contest.value.endTime)
  const target = now.isBefore(start) ? start : end
  const diff = target.diff(now, 'second')
  if (diff <= 0) {
    remainTime.value = '0秒'
    return
  }
  const hours = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60
  remainTime.value = `${hours}小时 ${minutes}分 ${seconds}秒`
}

// 题目列表列
const problemColumns: DataTableColumns = [
  {
    title: '题号',
    key: 'label',
    width: 100,
    render(row: any, index) {
      const label = String.fromCharCode(65 + index)
      const color = row.color ?? null
      const problemNum = row.logicId ? `${row.prefix ? row.prefix + '-' : ''}${row.logicId}` : ''
      const problemId = Number(row.problemId ?? row.problem?.id)
      const href = Number.isInteger(problemId) && problemId > 0
        ? `/contests/${contest.value!.id}/problems/${problemId}`
        : undefined
      return h(href ? 'a' : 'div', {
        ...(href ? { href } : {}),
        style: 'display: flex; align-items: center; gap: 6px; cursor: pointer; color: inherit; text-decoration: none;',
      }, [
        color
          ? h('span', {
              title: `气球颜色: ${color}`,
              style: `display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,.15);flex-shrink:0`,
            })
          : null,
        h('div', { style: 'line-height: 1.3' }, [
          h('span', { style: 'font-weight: 700; font-size: 15px; color: #2080f0' }, label),
          h('br'),
          h('span', { style: 'color: #999; font-size: 11px;' }, problemNum),
        ]),
      ])
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row: any, index: number) {
      const label = String.fromCharCode(65 + index)
      const problemId = Number(row.problemId ?? row.problem?.id)
      const href = Number.isInteger(problemId) && problemId > 0
        ? `/contests/${contest.value!.id}/problems/${problemId}`
        : undefined
      return h(href ? 'a' : 'span', {
        ...(href ? { href } : {}),
        style: 'color: #2080f0; text-decoration: none;',
      }, `${label}. ${(row.name || row.title) ?? ''}`)
    },
  },
  {
    title: '分值',
    key: 'weight',
    width: 60,
    render(row: any) {
      return row.weight && row.weight !== 1
        ? h('span', { style: 'font-weight: 600; color: #f0a020' }, String(row.weight))
        : h('span', { style: 'color: #aaa' }, '-')
    },
  },
  {
    title: '通过',
    key: 'accepts',
    width: 70,
    render(row: any) { return h('span', row.accepts ?? 0) },
  },
  {
    title: '提交',
    key: 'submits',
    width: 80,
    render(row: any) { return h('span', row.submits ?? 0) },
  },
]

// 排行榜
const rankData = ref<any[]>([])
const rankLoading = ref(false)

function fmtMin(min: number | null): string {
  if (min === null) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`
  return String(m)
}

function getCellClass(row: any, problemId: number): string {
  const p = row.problems?.[problemId]
  if (!p) return 'cell-empty'
  if (p.frozen) return 'cell-frozen'
  if (p.acTime !== null) return 'cell-ac'
  if (p.attempts > 0) return 'cell-wa'
  return 'cell-empty'
}

async function fetchRanking() {
  if (!contest.value) return
  rankLoading.value = true
  try {
    const res = await contestsApi.icpcRanking(contestId.value)
    rankData.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) {
    console.error(e)
  }
  finally {
    rankLoading.value = false
  }
}

// 我的提交记录
const mySubmissions = ref<Submission[]>([])
const submissionsLoading = ref(false)
const submissionsPage = ref(1)
const submissionsPageSize = ref(20)
const submissionsTotal = ref(0)
const validContextId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const router = useRouter()
const queryPagePath = route.path
const contestTabs = ['problems', 'submissions', 'ranking', 'register']
let applyingRouteState = false
function readContestRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingRouteState = true
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  const validTab = contestTabs.includes(tab)
  const page = Number(route.query.page)
  const validPage = Number.isInteger(page) && page > 0
  if ((route.query.tab !== undefined && !validTab) || (route.query.page !== undefined && !validPage)) {
    const query = { ...route.query }
    if (!validTab) delete query.tab
    if (!validPage) delete query.page
    void router.replace({ query })
  }
  activeTab.value = validTab ? tab : 'problems'
  submissionsPage.value = validPage ? page : 1
  queueMicrotask(() => { applyingRouteState = false })
}
function writeContestRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  if (applyingRouteState) return
  const query = { ...route.query }
  if (activeTab.value === 'problems') delete query.tab
  else query.tab = activeTab.value
  if (activeTab.value === 'submissions' && submissionsPage.value > 1) query.page = String(submissionsPage.value)
  else delete query.page
  void router.push({ query })
}
readContestRouteState()
watch(() => route.query, readContestRouteState)
watch([activeTab, submissionsPage], writeContestRouteState)
watch(submissionsPage, () => { if (activeTab.value === 'submissions') fetchSubmissions() })

async function fetchSubmissions() {
  submissionsLoading.value = true
  try {
    const res = await contestsApi.getContestSubmissions(contestId.value, {
      page: submissionsPage.value,
      perPage: submissionsPageSize.value,
    })
    const data = res.data ?? res
    mySubmissions.value = (data as any).items ?? (Array.isArray(data) ? data : [])
    submissionsTotal.value = (data as any).total ?? mySubmissions.value.length
  }
  catch (e) {
    console.error(e)
  }
  finally {
    submissionsLoading.value = false
  }
}

const submissionColumns: DataTableColumns<Submission> = [
  {
    title: 'ID',
    key: 'id',
    width: 80,
    render(row) {
      return validContextId(row.id) ? h('a', { href: `/submissions/${row.id}`, style: 'color: var(--lv-color-accent);' }, `#${row.id}`) : h('span', '-')
    },
  },
  {
    title: '题目',
    key: 'problem',
    render(row) {
      const label = row.problem ? `${row.problem.prefix || ''}${row.problem.logicId || ''} ${row.problem.title}` : '-'
      return validContextId(row.problemId)
        ? h('a', { href: `/contests/${contestId.value}/problems/${row.problemId}`, style: 'color: #2080f0;' }, label)
        : h('span', label)
    },
  },
  {
    title: '语言',
    key: 'language',
    width: 100,
    render(row) { return LANGUAGE_LABEL[row.language] ?? String(row.language) },
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render(row) {
      return h(resolveComponent('StatusTag') as any, { status: row.status })
    },
  },
  {
    title: '时间',
    key: 'time',
    width: 100,
    render(row) { return row.time != null ? `${row.time}ms` : '-' },
  },
  {
    title: '内存',
    key: 'memory',
    width: 100,
    render(row) { return memoryToKB(row.memory) },
  },
]

// 注册
const registered = ref(false)
const registering = ref(false)

function handleRegister() {
  dialog.warning({
    title: '确认报名',
    content: `确定要报名参加竞赛「${contest.value?.name || contest.value?.title}」吗？`,
    positiveText: '确认报名',
    negativeText: '取消',
    onPositiveClick: async () => {
      registering.value = true
      try {
        await contestsApi.register(contestId.value)
        registered.value = true
        message.success('成功参加竞赛！')
      }
      catch (e: any) {
        message.error(e?.response?.data?.message || e?.message || '参加竞赛失败')
      }
      finally {
        registering.value = false
      }
    },
  })
}

// Watch tab change to load data lazily
watch(activeTab, (tab) => {
  if (tab === 'ranking' && rankData.value.length === 0) {
    fetchRanking()
  }
  if (tab === 'submissions' && mySubmissions.value.length === 0) {
    fetchSubmissions()
  }
})

onMounted(async () => {
  try {
    const [res, meRes] = await Promise.all([
      contestsApi.get(contestId.value),
      contestsApi.getMyStatus(contestId.value).catch(() => null),
    ])
    contest.value = (res as any).data ?? res
    if (meRes) {
      const meData = (meRes as any).data ?? meRes
      registered.value = meData?.registered === true
    }
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
  if (activeTab.value === 'submissions' && !submissionsLoading.value) await fetchSubmissions()
  else if (activeTab.value === 'ranking' && !rankLoading.value) await fetchRanking()
  // 启动倒计时
  updateCountdown()
  countdownTimer = setInterval(updateCountdown, 1000)
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

useHead(computed(() => ({ title: contest.value?.name || contest.value?.title ? `${contest.value.name || contest.value.title} — Leverage OJ` : '竞赛 — Leverage OJ' })))
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.contest-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.contest-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contest-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.contest-times {
  display: flex;
  flex-wrap: wrap;
}

.contest-countdown {
  font-size: 15px;
  font-weight: 500;
}

.problems-list {
  margin-top: 8px;
}

.register-panel {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.register-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* ICPC 榜单样式 */
.icpc-table-wrapper {
  overflow-x: auto;
}

.icpc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.icpc-table th, .icpc-table td {
  padding: 6px 10px;
  border: 1px solid #e8e8e8;
  text-align: center;
  white-space: nowrap;
}

.icpc-table thead th {
  background: #fafafa;
  font-weight: 600;
}

.col-user { text-align: left !important; min-width: 120px; }
.col-rank { width: 40px; }
.col-solved { width: 40px; }
.col-penalty { width: 60px; }
.col-problem { min-width: 60px; }

.col-problem-cell { min-width: 60px; min-height: 40px; }

.cell-ac { background: #e8f5e9; }
.cell-wa { background: #fce4e4; }
.cell-frozen { background: #e3f2fd; }
.cell-empty { }

.ac-time { font-weight: 600; color: #18a058; font-size: 12px; }
.wa-count { color: #d03050; font-size: 12px; }
.frozen-cell { color: #2080f0; font-weight: 700; }
.attempt-count { font-size: 10px; color: #999; }
</style>
