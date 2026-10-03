<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="course" class="course-detail">
    <AdminViewBanner />
    <div class="course-header">
      <NH2 style="margin: 0">{{ course.name || course.title }}</NH2>
      <NText v-if="course.description" depth="3" style="font-size: 15px; margin-top: 8px">
        {{ course.description }}
      </NText>
      <div v-if="course.teacher" style="margin-top: 4px">
        <NText depth="3">教师：{{ course.teacher }}</NText>
      </div>
      <!-- 课程状态 -->
      <NTag v-if="courseStatus" :type="courseStatus.type" size="small" :bordered="false" style="margin-top: 8px">
        {{ courseStatus.label }}
      </NTag>
    </div>

    <NDivider />

    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- 课程信息 -->
      <NTabPane name="info" tab="课程信息">
        <NDescriptions bordered :column="1" label-placement="left" style="margin-bottom: 16px">
          <NDescriptionsItem label="课程名称">{{ course.name || course.title }}</NDescriptionsItem>
          <NDescriptionsItem label="题目数量">{{ course.problemCount ?? course.problems?.length ?? 0 }}</NDescriptionsItem>
          <NDescriptionsItem v-if="course.teacher" label="教师">{{ course.teacher }}</NDescriptionsItem>
          <NDescriptionsItem v-if="course.startTime" label="开始时间">{{ dayjs(course.startTime).format('YYYY-MM-DD HH:mm') }}</NDescriptionsItem>
          <NDescriptionsItem v-if="course.endTime" label="结束时间">{{ dayjs(course.endTime).format('YYYY-MM-DD HH:mm') }}</NDescriptionsItem>
        </NDescriptions>
        <NDivider v-if="course.notification" title-placement="left">公告</NDivider>
        <div v-if="course.notification">
          <MarkdownView :content="course.notification" />
        </div>
        <NEmpty v-else description="暂无公告" />
      </NTabPane>

      <!-- 题目列表 -->
      <NTabPane name="problems" tab="题目">
        <div v-if="problemsLoading" class="loading-center">
          <NSpin />
        </div>
        <div v-else-if="problems.length === 0">
          <NEmpty description="课程暂无题目" />
        </div>
        <NList v-else bordered>
          <NListItem
            v-for="(problem, index) in problems"
            :key="problem.id"
            class="problem-item"
          >
            <div class="problem-row">
              <span class="problem-index">{{ index + 1 }}</span>
              <NuxtLink v-if="validContextId(problem.id)" :to="`/course/${courseId}/problems/${problem.id}`" class="problem-link">
                {{ problem.prefix }}{{ problem.logicId }}. {{ problem.title }}
              </NuxtLink>
              <span v-else>{{ problem.prefix }}{{ problem.logicId }}. {{ problem.title }}</span>
              <NSpace size="small">
                <NTag
                  v-for="tag in problem.tags"
                  :key="tag.id"
                  size="tiny"
                  type="info"
                  :bordered="false"
                >
                  {{ tag.name }}
                </NTag>
              </NSpace>
            </div>
          </NListItem>
        </NList>
      </NTabPane>

      <!-- 提交记录 -->
      <NTabPane name="submissions" tab="提交记录">
        <PaginatedTable
          :columns="submissionColumns"
          :data="(submissions as any)"
          :loading="submissionsLoading"
          :total="submissionsTotal"
          :page="submissionsPage"
          :page-size="submissionsPageSize"
          :row-key="(row: any) => row.id"
          @page-change="onSubmissionsPageChange"
        />
      </NTabPane>

      <!-- 排名 -->
      <NTabPane name="ranking" tab="排名">
        <NDataTable
          :columns="rankColumns"
          :data="rankData"
          :loading="rankLoading"
          :bordered="true"
          :row-key="(row: any) => row.userId"
        />
      </NTabPane>
    </NTabs>
  </div>
  <div v-else>
    <NResult status="404" title="课程不存在" />
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import dayjs from 'dayjs'
import type { Problem, Submission } from '~/types'
import { LANGUAGE_LABEL, memoryToKB } from '~/types'
import type { Course, CourseRankItem } from '~/composables/api/courses'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const courseId = computed(() => Number(route.params.id))

const coursesApi = useCoursesApi()
const problemsApi = useProblemsApi()

const course = ref<Course | null>(null)
const loading = ref(true)
const activeTab = ref('info')

// 课程状态
const courseStatus = computed(() => {
  if (!course.value) return null
  const now = dayjs()
  const start = course.value.startTime ? dayjs(course.value.startTime) : null
  const end = course.value.endTime ? dayjs(course.value.endTime) : null
  if (!start || !end) return null
  if (now.isBefore(start)) return { label: '未开始', type: 'info' as const }
  if (now.isAfter(end)) return { label: '已结束', type: 'default' as const }
  return { label: '进行中', type: 'success' as const }
})

// 课程题目
const problems = ref<Problem[]>([])
const problemsLoading = ref(false)

async function fetchProblems() {
  if (!course.value?.problems?.length) return
  problemsLoading.value = true
  try {
    const items = await Promise.all(
      (course.value.problems as unknown as Array<number | Record<string, unknown>>).map(async (entry) => {
        const problemId = typeof entry === 'number' ? entry : Number(entry.problemId ?? entry.id)
        if (!Number.isInteger(problemId) || problemId <= 0) {
          return typeof entry === 'object' ? { ...entry, id: 0 } as unknown as Problem : null
        }
        const relation = typeof entry === 'object' ? entry : null
        if (relation && (relation.title || relation.logicId || relation.prefix)) {
          return { ...relation, id: problemId } as unknown as Problem
        }
        const res = await problemsApi.get(problemId)
        return (res as any).data ?? res
      }),
    )
    problems.value = items.filter((problem): problem is Problem => problem !== null)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    problemsLoading.value = false
  }
}

// 提交记录
const submissions = ref<Submission[]>([])
const submissionsLoading = ref(false)
const submissionsPage = ref(1)
const submissionsPageSize = ref(20)
const submissionsTotal = ref(0)
const validContextId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const router = useRouter()
const queryPagePath = route.path
const courseTabs = ['info', 'problems', 'submissions', 'ranking']
let applyingRouteState = false
function readCourseRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingRouteState = true
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  const validTab = courseTabs.includes(tab)
  const page = Number(route.query.page)
  const validPage = Number.isInteger(page) && page > 0
  const perPage = Number(route.query.perPage)
  submissionsPageSize.value = [10, 20, 50, 100].includes(perPage) ? perPage : 20
  if ((route.query.tab !== undefined && !validTab) || (route.query.page !== undefined && !validPage)) {
    const query = { ...route.query }
    if (!validTab) delete query.tab
    if (!validPage) delete query.page
    void router.replace({ query })
  }
  activeTab.value = validTab ? tab : 'info'
  submissionsPage.value = validPage ? page : 1
  queueMicrotask(() => { applyingRouteState = false })
}
function writeCourseRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  if (applyingRouteState) return
  const query = { ...route.query }
  if (activeTab.value === 'info') delete query.tab
  else query.tab = activeTab.value
  if (submissionsPageSize.value !== 20) query.perPage = String(submissionsPageSize.value)
  else delete query.perPage
  if (activeTab.value === 'submissions' && submissionsPage.value > 1) query.page = String(submissionsPage.value)
  else delete query.page
  void router.push({ query })
}
readCourseRouteState()
watch(() => route.query, readCourseRouteState)
watch([activeTab, submissionsPage, submissionsPageSize], writeCourseRouteState)
watch([submissionsPage, submissionsPageSize], () => { if (activeTab.value === 'submissions') fetchSubmissions() })

async function fetchSubmissions() {
  submissionsLoading.value = true
  try {
    const res = await coursesApi.getSubmissions(courseId.value, {
      page: submissionsPage.value,
      perPage: submissionsPageSize.value,
    })
    const data = (res as any).data ?? res
    submissions.value = (data as any).items ?? (Array.isArray(data) ? data : [])
    submissionsTotal.value = (data as any).total ?? submissions.value.length
  }
  catch (e) {
    console.error(e)
  }
  finally {
    submissionsLoading.value = false
  }
}

function onSubmissionsPageChange({ page: p, pageSize: ps }: { page: number; pageSize: number }) {
  submissionsPage.value = p
  submissionsPageSize.value = ps
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
      const label = row.problem ? `${row.problem.prefix || ''}${row.problem.logicId || ''}. ${row.problem.title}` : '-'
      return validContextId(row.problemId)
        ? h('a', { href: `/course/${courseId.value}/problems/${row.problemId}`, style: 'color: #2080f0;' }, label)
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
      return h(resolveComponent('StatusTag'), { status: row.status })
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
  {
    title: '提交时间',
    key: 'createdAt',
    width: 180,
    render(row) {
      return h('span', dayjs(row.createdAt).format('YYYY-MM-DD HH:mm'))
    },
  },
]

// 排名
const rankData = ref<CourseRankItem[]>([])
const rankLoading = ref(false)

async function fetchRanking() {
  rankLoading.value = true
  try {
    const res = await coursesApi.getRanking(courseId.value)
    const data = (res as any).data ?? res
    rankData.value = Array.isArray(data) ? data : (data as any).items ?? []
  }
  catch (e) {
    console.error(e)
  }
  finally {
    rankLoading.value = false
  }
}

const rankColumns: DataTableColumns<CourseRankItem> = [
  {
    title: '排名',
    key: 'rank',
    width: 80,
    render(row) { return h('span', { style: 'font-weight: 600;' }, `#${row.rank}`) },
  },
  {
    title: '用户名',
    key: 'username',
    render(row) {
      return Number.isInteger(row.userId) && row.userId > 0
        ? h('a', { href: `/users/${row.userId}`, style: 'color: #2080f0;' }, row.username)
        : h('span', row.username)
    },
  },
  {
    title: '通过数',
    key: 'accepts',
    width: 90,
    render(row) { return h('span', { style: 'font-weight: 600; color: #18a058;' }, String(row.accepts ?? 0)) },
  },
  {
    title: '提交数',
    key: 'submits',
    width: 90,
    render(row) { return h('span', String(row.submits ?? 0)) },
  },
  {
    title: '得分',
    key: 'score',
    width: 100,
    render(row) { return h('span', { style: 'font-weight: 600; color: #18a058;' }, String(row.score)) },
  },
]

// Watch tab change to load data lazily
watch(activeTab, (tab) => {
  if (tab === 'submissions' && submissions.value.length === 0) {
    fetchSubmissions()
  }
  if (tab === 'ranking' && rankData.value.length === 0) {
    fetchRanking()
  }
  if (tab === 'problems' && problems.value.length === 0) {
    fetchProblems()
  }
})

onMounted(async () => {
  try {
    const res = await coursesApi.get(courseId.value)
    course.value = (res as any).data ?? res
    await fetchProblems()
    if (activeTab.value === 'submissions' && !submissionsLoading.value) await fetchSubmissions()
    else if (activeTab.value === 'ranking' && !rankLoading.value) await fetchRanking()
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
})

useHead(computed(() => ({ title: (course.value?.name || course.value?.title) ? `${course.value?.name || course.value?.title} — Leverage OJ` : '课程 — Leverage OJ' })))
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.course-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.course-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.problem-item {
  cursor: pointer;
}

.problem-item:hover {
  background: #f5f5f5;
}

.problem-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.problem-index {
  font-weight: 600;
  color: #999;
  min-width: 24px;
  font-size: 13px;
}
</style>
