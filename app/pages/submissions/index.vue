<template>
  <div class="submissions-page">
    <div class="page-header">
      <NH2>提交记录</NH2>
    </div>

    <div class="filter-bar">
      <NInput
        v-model:value="filterProblemId"
        placeholder="题目 ID"
        aria-label="按题目 ID 筛选"
        clearable
        style="width: 160px"
        @update:value="onFilterChange"
      />
      <NSelect
        v-model:value="filterStatus"
        placeholder="状态"
        aria-label="按评测状态筛选"
        clearable
        :options="statusOptions"
        style="width: 160px"
        @update:value="onFilterChange"
      />
      <NButton v-if="authStore.isAdmin" @click="exportCsv">
        <NIcon size="16" :component="DownloadOutline" aria-hidden="true" /> 导出 CSV
      </NButton>
    </div>

    <NAlert v-if="loadError" type="error" title="提交记录加载失败">
      {{ loadError }} <NButton text @click="fetchSubmissions">重试</NButton>
    </NAlert>
    <PaginatedTable
      v-else
      :columns="columns"
      :data="(submissions as any)"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :row-key="(row: any) => row.id"
      :row-class-name="() => 'submission-row'"
      @page-change="onPageChange"
    >
      <template v-if="isMobile" #content>
        <NSpin :show="loading">
          <p v-if="loading && !submissions.length" role="status">正在加载提交记录…</p>
          <ul v-else-if="submissions.length" class="mobile-submission-list" aria-label="提交记录">
            <li v-for="submission in submissions" :key="submission.id" class="mobile-submission-item">
              <div class="mobile-item-heading">
                <NuxtLink v-if="validId(submission.id)" :to="`/submissions/${submission.id}`" class="submission-link">#{{ submission.id }}</NuxtLink>
                <span v-else class="submission-link">#-</span>
                <StatusTag :status="submission.status" />
              </div>
              <NuxtLink v-if="submission.problem && problemHref(submission)" :to="problemHref(submission)!" class="mobile-title">{{ submission.problem.prefix }}{{ submission.problem.logicId }} {{ submission.problem.title }}</NuxtLink>
              <NuxtLink v-else-if="validId(submission.problemId)" :to="problemHref(submission)!" class="mobile-meta">题目 #{{ submission.problemId }}</NuxtLink>
              <p v-else class="mobile-meta">-</p>
              <div class="mobile-details">
                <span>{{ LANGUAGE_LABEL[submission.language] ?? submission.language }}</span>
                <span>{{ submission.time != null ? `${submission.time}ms` : '时间未记录' }}</span>
                <span>{{ submission.memory != null ? `${memoryToKB(submission.memory)} KiB` : '内存未记录' }}</span>
              </div>
              <div class="mobile-meta">
                <UserLink v-if="validId(submission.user?.id)" :user-id="submission.user!.id" :username="submission.user!.username" />
                <UserLink v-else-if="validId(submission.userId)" :user-id="submission.userId" :username="`用户 #${submission.userId}`" />
                <span v-else>-</span>
                <time :datetime="submission.createdAt">{{ dayjs(submission.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</time>
              </div>
            </li>
          </ul>
          <NEmpty v-else :description="filterProblemId || filterStatus != null ? '没有符合筛选条件的提交' : '暂无提交记录'" />
        </NSpin>
      </template>
    </PaginatedTable>
  </div>
</template>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { STATUS_LABEL, LANGUAGE_LABEL, memoryToKB, type Submission } from '~/types'
import dayjs from 'dayjs'
import { DownloadOutline } from '@vicons/ionicons5'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const submissionsApi = useSubmissionsApi()
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const queryPagePath = route.path

async function exportCsv() {
  const token = authStore.accessToken
  const params = new URLSearchParams()
  if (filterProblemId.value) params.set('problemId', filterProblemId.value)
  if (filterStatus.value !== null && filterStatus.value !== undefined) params.set('status', String(filterStatus.value))
  const res = await fetch(`${runtimeConfig.public.apiBase}/submissions/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'submissions.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const filterProblemId = ref('')
const filterStatus = ref<number | null>(null)
const page = ref(1)
const pageSize = ref(20)
let requestVersion = 0
const submissions = ref<Submission[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  label,
  value: Number(value),
}))

function validId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function problemHref(row: Submission) {
  const problem = row.problem as (Submission['problem'] & { id?: number }) | undefined
  const id = validId(problem?.id) ? problem.id : row.problemId
  if (!validId(id)) return null
  const scoped = row as Submission & { contestId?: number | null; courseId?: number | null }
  if (validId(scoped.contestId)) return `/contests/${scoped.contestId}/problems/${id}`
  if (validId(scoped.courseId)) return `/course/${scoped.courseId}/problems/${id}`
  return `/problems/${id}`
}

function parsePositive(raw: unknown, fallback: number) {
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function syncFromRoute() {
  if (router.currentRoute.value.path !== queryPagePath) return
  const q = route.query
  page.value = parsePositive(q.page, 1)
  pageSize.value = [10, 20, 50, 100].includes(parsePositive(q.perPage, 20)) ? parsePositive(q.perPage, 20) : 20
  const problemId = parsePositive(q.problemId, 0)
  filterProblemId.value = problemId ? String(problemId) : ''
  const rawStatus = Array.isArray(q.status) ? q.status[0] : q.status
  const status = typeof rawStatus === 'string' && /^\d+$/.test(rawStatus) ? Number(rawStatus) : NaN
  filterStatus.value = Number.isInteger(status) && Object.hasOwn(STATUS_LABEL, String(status)) ? status : null
}

function syncUrl() {
  if (router.currentRoute.value.path !== queryPagePath) return
  const query: Record<string, any> = { ...route.query }
  for (const key of ['page', 'perPage', 'problemId', 'status']) Reflect.deleteProperty(query, key)
  if (page.value > 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.perPage = String(pageSize.value)
  if (filterProblemId.value && Number.isSafeInteger(Number(filterProblemId.value)) && Number(filterProblemId.value) > 0) query.problemId = filterProblemId.value
  if (filterStatus.value !== null) query.status = String(filterStatus.value)
  router.push({ query })
}

async function fetchSubmissions() {
  const version = ++requestVersion
  loading.value = true
  loadError.value = ''
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      perPage: pageSize.value,
    }
    if (filterProblemId.value) params.problemId = Number(filterProblemId.value)
    if (filterStatus.value !== null && filterStatus.value !== undefined) params.status = filterStatus.value
    const res = await submissionsApi.list(params as any)
    if (version !== requestVersion) return
    submissions.value = res.data.items
    total.value = res.data.total
  }
  catch (e) {
    if (version === requestVersion) {
      console.error(e)
      loadError.value = '请检查网络后重试，当前未展示不完整的结果。'
    }
  }
  finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => route.fullPath, () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  syncFromRoute()
  fetchSubmissions()
}, { immediate: true })

let filterTimer: ReturnType<typeof setTimeout> | null = null
function clearFilterTimer() { if (filterTimer) clearTimeout(filterTimer); filterTimer = null }
function debouncedFilterSync() {
  clearFilterTimer()
  filterTimer = setTimeout(() => { filterTimer = null; if (router.currentRoute.value.path === queryPagePath) { page.value = 1; syncUrl() } }, 300)
}
onBeforeRouteLeave(clearFilterTimer)
onUnmounted(() => { clearFilterTimer(); requestVersion++ })

function onFilterChange() {
  page.value = 1
  debouncedFilterSync()
}

function onPageChange({ page: p, pageSize: ps }: { page: number; pageSize: number }) {
  page.value = p
  pageSize.value = ps
  syncUrl()
}

const columns: DataTableColumns<Submission> = [
  {
    title: 'ID',
    key: 'id',
    width: 80,
    render(row) {
      if (!validId(row.id)) return h('span', { style: 'color:#999' }, '-')
      return h(resolveComponent('NuxtLink') as any, { to: `/submissions/${row.id}`, class: 'table-link' }, { default: () => `#${row.id}` })
    },
  },
  {
    title: '题目',
    key: 'problem',
    render(row) {
      const href = problemHref(row)
      if (!href) return h('span', { style: 'color:#999' }, '-')
      const text = row.problem ? `${row.problem.prefix}${row.problem.logicId} ${row.problem.title}` : `#${row.problemId}`
      return h(resolveComponent('NuxtLink') as any, { to: href, class: 'table-link' }, { default: () => text })
    },
  },
  {
    title: '用户',
    key: 'user',
    render(row) {
      const id = validId(row.user?.id) ? row.user.id : row.userId
      if (!validId(id)) return h('span', { style: 'color:#999' }, '-')
      return h(resolveComponent('UserLink') as any, { userId: id, username: row.user?.username ?? `用户 #${id}` })
    },
  },
  {
    title: '语言',
    key: 'language',
    width: 100,
    render(row) {
      return h('span', {}, LANGUAGE_LABEL[row.language] ?? row.language)
    },
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
    width: 110,
    align: 'right',
    render(row) {
      return h('span', { class: 'metric-value' }, row.time != null ? `${row.time}ms` : '-')
    },
  },
  {
    title: '内存',
    key: 'memory',
    width: 110,
    align: 'right',
    render(row) {
      return h('span', { class: 'metric-value' }, row.memory != null ? `${memoryToKB(row.memory)} KiB` : '未记录')
    },
  },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 160,
    render(row) {
      return h('span', { style: 'color:#666; font-size:13px' }, dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss'))
    },
  },
]

useHead({ title: '评测记录 — Leverage OJ' })
</script>

<style scoped>
.submissions-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
}

.page-header :deep(.n-h2) {
  margin: 0;
}

.filter-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.mobile-submission-list { list-style: none; margin: 0; padding: 0; min-width: 0; border: 1px solid var(--lv-color-border, #dfe5ea); border-radius: var(--lv-radius-md, 8px); background: var(--lv-color-surface, #fff); }
.mobile-submission-item { padding: var(--lv-space-4, 16px); border-bottom: 1px solid var(--lv-color-border, #dfe5ea); }
.mobile-submission-item:last-child { border-bottom: 0; }
.mobile-item-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.submission-link { color: var(--lv-color-accent, #426b96); font-weight: 600; font-variant-numeric: tabular-nums; text-decoration: none; }
.mobile-title { display: block; margin-top: 8px; color: var(--lv-color-text, #202a35); font-size: 16px; font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; text-decoration: none; }
.mobile-details, .mobile-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; color: var(--lv-color-text-secondary, #596875); font-size: 13px; font-variant-numeric: tabular-nums; }
.mobile-meta time { display: block; }
.submission-link:focus-visible, .mobile-title:focus-visible, :deep(.table-link:focus-visible) { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }
@media (max-width: 767px) {
  .filter-bar :deep(.n-input), .filter-bar :deep(.n-select) { flex: 1; min-width: 140px; }
}

:deep(.table-link) { color: var(--lv-color-accent, #426b96); text-decoration: none; }
:deep(.table-link:hover) { text-decoration: underline; }
:deep(.submission-row td) {
  transition: background-color 0.18s ease;
}

:deep(.submission-row:hover td) {
  background: #f7fbff;
}

:deep(.metric-value) {
  color: #334155;
  font-variant-numeric: tabular-nums;
}
</style>
