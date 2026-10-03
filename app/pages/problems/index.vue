<template>
  <div class="problems-page">
    <div class="page-header">
      <NH2>题目列表</NH2>
      <NInput
        v-model:value="searchText"
        placeholder="搜索题目..."
        aria-label="搜索题目"
        clearable
        class="list-search"
      >
        <template #prefix>
          <NIcon><SearchOutline /></NIcon>
        </template>
      </NInput>
    </div>

    <NAlert v-if="loadError" type="error" title="题目加载失败">
      {{ loadError }} <NButton text @click="fetchProblems">重试</NButton>
    </NAlert>
    <PaginatedTable
      v-else
      :columns="columns"
      :data="(problems as any)"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :row-key="(row: any) => row.id"
      @page-change="onPageChange"
    >
      <template v-if="isMobile" #content>
        <NSpin :show="loading">
          <p v-if="loading && !problems.length" role="status">正在加载题目…</p>
          <ul v-else-if="problems.length" class="mobile-problem-list" aria-label="题目列表">
            <li v-for="problem in problems" :key="problem.id" class="mobile-problem-item">
              <div class="mobile-item-heading">
                <span class="mobile-meta">{{ problem.prefix }}{{ problem.logicId }}</span>
                <NTag size="small" :type="getStatusInfo(problem._userStatus).type" :bordered="false">{{ getStatusInfo(problem._userStatus).text }}</NTag>
              </div>
              <NuxtLink v-if="validId(problem.id)" :to="`/problems/${problem.id}`" class="mobile-title">{{ problem.title }}</NuxtLink>
              <span v-else class="mobile-title">{{ problem.title }}</span>
              <p class="mobile-meta">通过率 {{ passRate(problem) }}% · {{ problem.accepts }}/{{ problem.submits }}</p>
              <div v-if="problem.tags?.length" class="mobile-tags" aria-label="题目标签">
                <button v-for="tag in problem.tags" :key="tag.id" type="button" @click="filterByTag(tag)">{{ tag.name }}</button>
              </div>
            </li>
          </ul>
          <NEmpty v-else :description="searchText || selectedTagId ? '没有符合筛选条件的题目' : '暂无题目'" />
        </NSpin>
      </template>
    </PaginatedTable>
  </div>
</template>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { h } from 'vue'
import { NButton, NTag, NSpace, NProgress } from 'naive-ui'
import type { DataTableColumns, ProgressProps } from 'naive-ui'
import { SearchOutline } from '@vicons/ionicons5'
import type { Problem, Tag } from '~/types'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const problemsApi = useProblemsApi()
const submissionsApi = useSubmissionsApi()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const queryPagePath = route.path

const searchText = ref('')
const page = ref(1)
const pageSize = ref(20)
let requestVersion = 0
let syncingFromRoute = false
const selectedTagId = ref<number | null>(null)
type ProblemListItem = Problem & { _userStatus?: number }
const problems = ref<ProblemListItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

function validId(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0
}

function positive(raw: unknown, fallback: number) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isSafeInteger(n) && n > 0 ? n : fallback
}

function syncFromRoute() {
  if (router.currentRoute.value.path !== queryPagePath) return
  syncingFromRoute = true
  const q = route.query
  page.value = positive(q.page, 1)
  const ps = positive(q.perPage, 20)
  pageSize.value = [10, 20, 50, 100].includes(ps) ? ps : 20
  const tag = positive(q.tagId, 0)
  selectedTagId.value = tag || null
  searchText.value = typeof q.search === 'string' ? q.search : ''
  syncingFromRoute = false
}

function syncUrl() {
  if (router.currentRoute.value.path !== queryPagePath) return
  const query: Record<string, any> = { ...route.query }
  for (const key of ['page', 'perPage', 'tagId', 'search']) Reflect.deleteProperty(query, key)
  if (page.value > 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.perPage = String(pageSize.value)
  if (selectedTagId.value) query.tagId = String(selectedTagId.value)
  if (searchText.value.trim()) query.search = searchText.value.trim()
  router.push({ path: '/problems', query })
}

async function fetchProblems() {
  const version = ++requestVersion
  loading.value = true
  loadError.value = ''
  try {
    const res = await problemsApi.list({
      page: page.value,
      perPage: pageSize.value,
      search: searchText.value || undefined,
      tagId: selectedTagId.value || undefined,
    })
    const items = res.data.items
    if (version !== requestVersion) return
    total.value = res.data.total

    // UserProblemStatus: 0=未做，1=尝试过，2=已通过。
    if (authStore.isLoggedIn && authStore.user?.id && items.length > 0) {
      try {
        const ids = items.map((p: any) => p.id)
        const statusRes = await submissionsApi.userProblemStatusBatch(authStore.user.id, ids)
        const statusMap: Record<string, number> = statusRes.data ?? {}
        if (version === requestVersion) problems.value = items.map((p: any) => ({ ...p, _userStatus: statusMap[String(p.id)] ?? 0 }))
      }
      catch {
        if (version === requestVersion) problems.value = items
      }
    }
    else if (version === requestVersion) {
      problems.value = items
    }
  }
  catch (e) {
    console.error(e)
    if (version === requestVersion) loadError.value = '请检查网络后重试，当前未展示不完整的结果。'
  }
  finally {
    if (version === requestVersion) loading.value = false
  }
}

let filterTimer: ReturnType<typeof setTimeout> | null = null
function clearFilterTimer() { if (filterTimer) clearTimeout(filterTimer); filterTimer = null }
function debouncedSearchSync() {
  clearFilterTimer()
  filterTimer = setTimeout(() => { filterTimer = null; if (router.currentRoute.value.path === queryPagePath) { page.value = 1; syncUrl() } }, 300)
}
onBeforeRouteLeave(clearFilterTimer)
onUnmounted(() => { clearFilterTimer(); requestVersion++ })

watch(searchText, () => {
  if (!syncingFromRoute) debouncedSearchSync()
}, { flush: 'sync' })

watch(() => route.fullPath, () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  syncFromRoute()
  fetchProblems()
}, { immediate: true })

function onPageChange({ page: p, pageSize: ps }: { page: number; pageSize: number }) {
  page.value = p
  pageSize.value = ps
  syncUrl()
}

function getStatusInfo(status: unknown) {
  // backend UserProblemStatus enum: 0=TODO, 1=ATTEMPTED, 2=ACCEPTED
  if (status === 2) return { text: '已 AC', color: '#18a058', type: 'success' as const }
  if (status === 1) return { text: '尝试过', color: '#f0a020', type: 'warning' as const }
  return { text: '未做', color: '#b0b8c2', type: 'default' as const }
}

function passRate(problem: Problem) {
  return problem.submits > 0 ? Number((problem.accepts / problem.submits * 100).toFixed(1)) : 0
}

function tagColor(tag: Tag) {
  if (tag.color) return tag.color
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']
  const hash = [...tag.name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function filterByTag(tag: Tag) {
  selectedTagId.value = tag.id
  page.value = 1
  syncUrl()
}

const columns: DataTableColumns<Problem> = [
  {
    title: '状态',
    key: 'status',
    width: 110,
    render(row) {
      const info = getStatusInfo((row as any)._userStatus)
      return h('div', { class: 'status-cell' }, [
        h('span', { class: 'status-dot', style: `background:${info.color}` }),
        h('span', { class: 'status-text' }, info.text),
      ])
    },
  },
  {
    title: '题号',
    key: 'logicId',
    width: 100,
    render(row) {
      if (!validId(row.id)) return h('span', { style: 'color:#999' }, `${row.prefix}${row.logicId}`)
      return h(resolveComponent('NuxtLink'), { to: `/problems/${row.id}`, class: 'table-link' }, () => `${row.prefix}${row.logicId}`)
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row) {
      return validId(row.id) ? h(resolveComponent('NuxtLink'), { to: `/problems/${row.id}`, class: 'problem-link' }, () => row.title) : h('span', {}, row.title)
    },
  },
  {
    title: '通过率',
    key: 'accepts',
    width: 220,
    render(row) {
      const rate = row.submits > 0 ? Number(((row.accepts / row.submits) * 100).toFixed(1)) : 0
      const progressStatus: ProgressProps['status'] = rate >= 60 ? 'success' : rate >= 30 ? 'warning' : 'error'
      return h('div', { class: 'rate-cell' }, [
        h(NProgress, {
          type: 'line',
          percentage: rate,
          height: 8,
          showIndicator: false,
          processing: false,
          status: progressStatus,
          borderRadius: 6,
        }),
        h('span', { class: 'rate-meta' }, `${rate}% (${row.accepts}/${row.submits})`),
      ])
    },
  },
  {
    title: '标签',
    key: 'tags',
    render(row) {
      if (!row.tags || row.tags.length === 0) return h('span', { style: 'color: #94a3b8;' }, '-')
      return h(
        NSpace,
        { size: 6 },
        {
          default: () =>
            row.tags.map(tag =>
              h(
                NTag,
                {
                  key: tag.id,
                  size: 'small',
                  bordered: false,
                  round: true,
                  style: {
                    color: '#fff',
                    background: tagColor(tag),
                    cursor: 'pointer',
                  },
                  onClick: () => filterByTag(tag),
                },
                { default: () => tag.name },
              ),
            ),
        },
      )
    },
  },
]

useHead({ title: '题库 — Leverage OJ' })
</script>

<style scoped>
.problems-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--lv-space-4, 16px);
}
.list-search { width: min(100%, 320px); }
.mobile-problem-list { list-style: none; margin: 0; padding: 0; min-width: 0; border: 1px solid var(--lv-color-border, #dfe5ea); border-radius: var(--lv-radius-md, 8px); background: var(--lv-color-surface, #fff); }
.mobile-problem-item { padding: var(--lv-space-4, 16px); border-bottom: 1px solid var(--lv-color-border, #dfe5ea); }
.mobile-problem-item:last-child { border-bottom: 0; }
.mobile-item-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.mobile-title { display: block; margin-top: 8px; color: var(--lv-color-accent, #426b96); font-size: 16px; font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; text-decoration: none; }
.mobile-meta { margin: 8px 0 0; color: var(--lv-color-text-secondary, #596875); font-size: 13px; font-variant-numeric: tabular-nums; }
.mobile-item-heading .mobile-meta { margin: 0; }
.mobile-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.mobile-tags button { padding: 4px 8px; border: 1px solid var(--lv-color-border, #dfe5ea); border-radius: 4px; background: var(--lv-color-canvas, #f3f5f7); color: var(--lv-color-text-secondary, #596875); font: inherit; font-size: 12px; cursor: pointer; }
.mobile-tags button:focus-visible, .mobile-title:focus-visible { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }

:deep(.table-link), :deep(.problem-link) { color: var(--lv-color-accent, #426b96); text-decoration: none; font-weight: 600; }
:deep(.table-link:hover), :deep(.problem-link:hover) { text-decoration: underline; }
:deep(.table-link:focus-visible), :deep(.problem-link:focus-visible) { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }

.page-header :deep(.n-h2) {
  margin: 0;
}

:deep(.status-cell) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

:deep(.status-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

:deep(.status-text) {
  font-size: 13px;
  color: #475569;
}

:deep(.problem-link .n-button__content) {
  color: #334155;
  transition: color 0.2s ease;
}

:deep(.problem-link:hover .n-button__content) {
  color: #2563eb;
}

:deep(.rate-cell) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.rate-meta) {
  color: #64748b;
  font-size: 12px;
}
</style>
