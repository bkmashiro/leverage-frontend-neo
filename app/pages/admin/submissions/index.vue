<template>
  <div class="admin-submissions">
    <div class="page-header">
      <NH2 style="margin: 0">提交管理</NH2>
    </div>

    <!-- 筛选栏 -->
    <NCard size="small">
      <NSpace align="center" wrap>
        <NInputGroup style="width: 200px">
          <NInputGroupLabel>用户ID</NInputGroupLabel>
          <NInputNumber v-model:value="filterUserId" :min="1" placeholder="用户ID" clearable @update:value="onFilterChange" />
        </NInputGroup>
        <NInputGroup style="width: 220px">
          <NInputGroupLabel>题目ID</NInputGroupLabel>
          <NInputNumber v-model:value="filterProblemId" :min="1" placeholder="题目ID" clearable @update:value="onFilterChange" />
        </NInputGroup>
        <NSelect
          v-model:value="filterStatus"
          :options="statusOptions"
          placeholder="全部状态"
          clearable
          style="width: 160px"
          @update:value="onFilterChange"
        />
        <NButton @click="resetFilters">重置</NButton>
      </NSpace>
    </NCard>

    <NAlert v-if="loadError" type="error" title="提交记录加载失败">{{ loadError }} <NButton text @click="fetchSubmissions">重试</NButton></NAlert>
    <PaginatedTable
      v-else
      :columns="columns"
      :data="submissions"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :row-key="(row: any) => row.id"
      @page-change="onPageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { h, ref } from 'vue'
import { NButton, NSpace, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { Submission } from '~/types'
import { LANGUAGE_LABEL, LANGUAGE_OPTIONS, STATUS_LABEL } from '~/types'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const submissionsApi = useSubmissionsApi()
const message = useMessage()
const dialog = useDialog()
const route = useRoute()
const router = useRouter()
const queryPagePath = route.path

const submissions = ref<Submission[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const loadError = ref('')
let requestVersion = 0

const filterUserId = ref<number | null>(null)
const filterProblemId = ref<number | null>(null)
const filterStatus = ref<number | null>(null)

const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  label,
  value: Number(value),
}))

function positive(raw: unknown, fallback: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isSafeInteger(n) && n > 0 ? n : fallback
}

function syncFromRoute() {
  if (router.currentRoute.value.path !== queryPagePath) return
  const q = route.query
  page.value = positive(q.page, 1)
  const ps = positive(q.perPage, 20)
  pageSize.value = [10, 20, 50, 100].includes(ps) ? ps : 20
  const userId = positive(q.userId, 0)
  const problemId = positive(q.problemId, 0)
  filterUserId.value = userId || null
  filterProblemId.value = problemId || null
  const rawStatus = Array.isArray(q.status) ? q.status[0] : q.status
  const status = typeof rawStatus === 'string' && /^\d+$/.test(rawStatus) ? Number(rawStatus) : NaN
  filterStatus.value = Number.isInteger(status) && Object.hasOwn(STATUS_LABEL, String(status)) ? status : null
}

function syncUrl() {
  if (router.currentRoute.value.path !== queryPagePath) return
  const query: Record<string, any> = { ...route.query }
  for (const key of ['page', 'perPage', 'userId', 'problemId', 'status']) Reflect.deleteProperty(query, key)
  if (page.value > 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.perPage = String(pageSize.value)
  if (filterUserId.value) query.userId = String(filterUserId.value)
  if (filterProblemId.value) query.problemId = String(filterProblemId.value)
  if (filterStatus.value !== null) query.status = String(filterStatus.value)
  router.push({ query })
}

async function fetchSubmissions() {
  const version = ++requestVersion
  loadError.value = ''
  loading.value = true
  try {
    const params: any = { page: page.value, perPage: pageSize.value }
    if (filterUserId.value) params.userId = filterUserId.value
    if (filterProblemId.value) params.problemId = filterProblemId.value
    if (filterStatus.value !== null) params.status = filterStatus.value
    const res = await submissionsApi.list(params)
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

function onFilterChange() {
  page.value = 1
  syncUrl()
}

function resetFilters() {
  filterUserId.value = null
  filterProblemId.value = null
  filterStatus.value = null
  page.value = 1
  syncUrl()
}

function onPageChange({ page: p, pageSize: ps }: { page: number; pageSize: number }) {
  page.value = p
  pageSize.value = ps
  syncUrl()
}

async function handleRejudge(row: Submission) {
  if (!LANGUAGE_OPTIONS.some(option => option.value === row.language)) return
  dialog.warning({
    title: '确认重判',
    content: `确定要重判提交 #${row.id} 吗？`,
    positiveText: '重判',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await submissionsApi.rejudge(row.id)
        message.success('重判已提交')
        await fetchSubmissions()
      }
      catch (e: any) {
        message.error(e?.response?.data?.message || '重判失败')
      }
    },
  })
}

const columns: DataTableColumns<Submission> = [
  {
    title: '#',
    key: 'id',
    width: 80,
    render(row) {
      return Number.isSafeInteger(row.id) && row.id > 0 ? h(resolveComponent('NuxtLink'), { to: `/submissions/${row.id}`, class: 'table-link' }, () => `#${row.id}`) : h('span', { style: 'color:#999' }, '-')
    },
  },
  {
    title: '用户',
    key: 'user',
    render(row) {
      const id = Number.isSafeInteger(row.user?.id) && row.user.id > 0 ? row.user.id : row.userId
      if (!Number.isSafeInteger(id) || id <= 0) return h('span', { style: 'color:#999' }, '-')
      return h(resolveComponent('UserLink'), { userId: id, username: row.user?.username ?? `用户 #${id}` })
    },
  },
  {
    title: '题目',
    key: 'problem',
    render(row) {
      const problem = row.problem as (Submission['problem'] & { id?: number }) | undefined
      const problemId = Number.isSafeInteger(problem?.id) && (problem?.id ?? 0) > 0 ? problem!.id! : row.problemId
      if (!Number.isSafeInteger(problemId) || problemId <= 0) return h('span', { style: 'color:#999' }, '-')
      const scoped = row as Submission & { contestId?: number | null; courseId?: number | null }
      const href = Number.isSafeInteger(scoped.contestId) && (scoped.contestId ?? 0) > 0 ? `/contests/${scoped.contestId}/problems/${problemId}` : Number.isSafeInteger(scoped.courseId) && (scoped.courseId ?? 0) > 0 ? `/course/${scoped.courseId}/problems/${problemId}` : `/problems/${problemId}`
      const label = problem ? `${problem.prefix}${problem.logicId} - ${problem.title}` : `#${problemId}`
      return h(resolveComponent('NuxtLink'), { to: href, class: 'table-link' }, () => label)
    },
  },
  {
    title: '语言',
    key: 'language',
    width: 100,
    render(row) {
      return LANGUAGE_LABEL[row.language] ?? row.language
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render(row) {
      return h(resolveComponent('StatusTag'), { status: row.status })
    },
  },
  {
    title: '时间(ms)',
    key: 'time',
    width: 100,
    render(row) {
      return row.time !== undefined ? String(row.time) : '-'
    },
  },
  {
    title: '内存(KB)',
    key: 'memory',
    width: 100,
    render(row) {
      return row.memory !== undefined ? String(row.memory) : '-'
    },
  },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 160,
    render(row) {
      return new Date(row.createdAt).toLocaleString('zh-CN')
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NButton,
        {
          size: 'small',
          type: 'warning',
          ghost: true,
          disabled: !LANGUAGE_OPTIONS.some(option => option.value === row.language),
          onClick: () => handleRejudge(row),
        },
        { default: () => '重判' },
      )
    },
  },
]

useHead({ title: '提交记录' })
</script>

<style scoped>
.admin-submissions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.table-link) { color: var(--lv-color-accent, #426b96); text-decoration: none; }
:deep(.table-link:hover) { text-decoration: underline; }
:deep(.table-link:focus-visible) { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
