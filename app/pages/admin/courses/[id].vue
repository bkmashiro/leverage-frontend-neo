<template>
  <div class="admin-course-detail">
    <div class="page-header">
      <NSpace align="center">
        <NButton text @click="navigateTo('/admin/courses')">
          ← 返回课程列表
        </NButton>
        <NH2 style="margin: 0">
          {{ course?.name || '课程详情' }}
        </NH2>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="info" tab="基本信息">
          <NCard v-if="course" style="max-width: 600px; margin-top: 16px">
            <NDescriptions :column="1" label-placement="left" bordered>
              <NDescriptionsItem label="ID">{{ course.id }}</NDescriptionsItem>
              <NDescriptionsItem label="课程名">{{ course.name }}</NDescriptionsItem>
              <NDescriptionsItem label="公告">{{ course.notification || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="创建时间">{{ fmtTime(course.createdAt) }}</NDescriptionsItem>
              <NDescriptionsItem label="题目数">{{ course.problems?.length || 0 }}</NDescriptionsItem>
              <NDescriptionsItem label="成员数">{{ course.members?.length || 0 }}</NDescriptionsItem>
            </NDescriptions>
            <div style="margin-top: 16px">
              <NButton type="primary" @click="openEditModal">编辑课程</NButton>
            </div>
          </NCard>
        </NTabPane>

        <NTabPane name="problems" tab="题目管理">
          <div style="margin-top: 16px">
            <NSpace style="margin-bottom: 12px">
              <NSelect
                v-model:value="addProblemId"
                style="width: 360px"
                filterable
                remote
                clearable
                :loading="problemSearchLoading"
                :options="problemOptions"
                placeholder="搜索题目（输入关键词）"
                @search="handleProblemSearch"
              />
              <NButton type="primary" :loading="addingProblem" @click="handleAddProblem">添加题目</NButton>
            </NSpace>
            <NDataTable
              :columns="problemColumns"
              :data="courseProblems"
              :loading="loading"
              :row-key="(row: any) => row.problemId || row.userId || row.id || row"
              size="small"
            />
          </div>
        </NTabPane>

        <NTabPane name="members" tab="成员管理">
          <div style="margin-top: 16px">
            <NSpace style="margin-bottom: 12px">
              <NSelect
                v-model:value="addUserId"
                style="width: 360px"
                filterable
                remote
                clearable
                :loading="userSearchLoading"
                :options="userOptions"
                placeholder="搜索用户名"
                @search="handleUserSearch"
              />
              <NButton type="primary" :loading="addingMember" @click="handleAddMember">添加成员</NButton>
              <NUpload
                :custom-request="handleImportMembers"
                accept=".csv,.txt"
                :show-file-list="false"
              >
                <NButton>导入成员 (CSV)</NButton>
              </NUpload>
            </NSpace>
            <NDataTable
              :columns="memberColumns"
              :data="courseMembers"
              :loading="membersLoading"
              :row-key="(row: any) => row.problemId || row.userId || row.id || row"
              size="small"
            />
          </div>
        </NTabPane>

        <NTabPane name="import-user" tab="导入用户">
          <div style="margin-top: 16px; max-width: 600px">
            <NInput
              v-model:value="importUserText"
              type="textarea"
              :rows="8"
              placeholder="每行一个用户名，或用逗号分隔"
            />
            <NSpace style="margin-top: 12px">
              <NButton type="primary" :loading="importingUsers" @click="handleBatchImportUsers">
                批量导入
              </NButton>
            </NSpace>
            <div v-if="importResult" style="margin-top: 12px">
              <NTag :type="importResult.type" size="small">{{ importResult.text }}</NTag>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="rate" tab="通过率">
          <div style="margin-top: 16px">
            <template v-if="hasRateData">
              <NDataTable
                :columns="rateColumns"
                :data="courseProblems"
                :row-key="(row: any) => row.problemId || row.id"
                size="small"
              />
            </template>
            <NEmpty v-else description="题目暂无提交/通过统计数据" />
          </div>
        </NTabPane>

        <NTabPane name="sus" tab="查重入口">
          <div style="margin-top: 16px">
            <NButton type="primary" @click="navigateTo(`/admin/submissions/sus?courseId=${courseId}`)">
              查看本课程查重数据
            </NButton>
            <div style="margin-top: 16px">
              <NH4 style="margin: 0 0 8px">最近查重记录</NH4>
              <NDataTable
                :columns="susColumns"
                :data="susPreview"
                :loading="susLoading"
                :row-key="(row: any) => row.id"
                size="small"
              />
            </div>
          </div>
        </NTabPane>

        <NTabPane name="submissions" tab="提交记录">
          <div style="margin-top: 16px">
            <NSpace style="margin-bottom: 12px">
              <NButton @click="exportSubmissionsCsv">⬇ 导出提交记录 CSV</NButton>
            </NSpace>
            <NDataTable
              :columns="submissionColumns"
              :data="submissions"
              :loading="submissionsLoading"
              :row-key="(row: any) => row.id"
              size="small"
            />
            <NPagination
              v-model:page="submissionPage"
              :page-count="submissionPageCount"
              style="margin-top: 12px; justify-content: flex-end"
            />
          </div>
        </NTabPane>

        <NTabPane name="ranking" tab="排行榜">
          <div style="margin-top: 16px">
            <NButton style="margin-bottom: 12px" @click="fetchRanking">刷新</NButton>
            <NDataTable
              :columns="rankingColumns"
              :data="ranking"
              :loading="rankingLoading"
              :row-key="(row: any) => row.userId"
              size="small"
            />
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>

    <NModal v-model:show="showEditModal" title="编辑课程" preset="dialog" style="width: 560px">
      <NForm :model="editForm" label-placement="left" label-width="90px" style="margin-top: 12px">
        <NFormItem label="课程名" required>
          <NInput v-model:value="editForm.name" placeholder="输入课程名" />
        </NFormItem>
        <NFormItem label="公告">
          <NInput v-model:value="editForm.notification" type="textarea" placeholder="输入课程公告" :rows="4" />
        </NFormItem>
        <NFormItem label="允许语言">
          <NSelect v-model:value="editEnabledLanguages" :options="LANGUAGE_OPTIONS" multiple clearable />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSaveEdit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns, SelectOption, UploadCustomRequestOptions } from 'naive-ui'
import dayjs from 'dayjs'
import { STATUS_LABEL, STATUS_COLOR, LANGUAGE_OPTIONS, parseEnabledLanguages } from '~/types'
import type { Course, CourseRankItem } from '~/composables/api/courses'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const courseId = Number(route.params.id)
const coursesApi = useCoursesApi()
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()

const exportSubmissionsCsv = async () => {
  const token = authStore.accessToken
  const res = await fetch(`${runtimeConfig.public.apiBase}/submissions/export?courseId=${courseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `course-${courseId}-submissions.csv`
  a.click()
  URL.revokeObjectURL(url)
}
const problemsApi = useProblemsApi()
const usersApi = useUsersApi()
const message = useMessage()
const dialog = useDialog()

const course = ref<Course | null>(null)
const loading = ref(false)
const activeTab = ref('info')

function fmtTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'
}

async function fetchCourse() {
  loading.value = true
  try {
    const res = await coursesApi.get(courseId)
    course.value = res.data
  }
  catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(async () => {
  await fetchCourse()
  if (activeTab.value === 'submissions' && !submissionsLoading.value) await fetchSubmissions()
  else if (activeTab.value === 'members') await fetchMembers()
  else if (activeTab.value === 'ranking') await fetchRanking()
  else if (activeTab.value === 'sus') await fetchSusPreview()
})

const showEditModal = ref(false)
const saving = ref(false)
const editEnabledLanguages = ref<string[]>([])
const editForm = ref({ name: '', notification: '', enabledLanguageJSON: null as string | null })

function openEditModal() {
  if (!course.value) return
  editEnabledLanguages.value = parseEnabledLanguages(course.value.enabledLanguageJSON)
  editForm.value = {
    name: course.value.name || '',
    notification: course.value.notification || '',
    enabledLanguageJSON: course.value.enabledLanguageJSON ?? null,
  }
  showEditModal.value = true
}

async function handleSaveEdit() {
  saving.value = true
  try {
    const updateData = {
      ...editForm.value,
      enabledLanguageJSON: editEnabledLanguages.value.length > 0 ? JSON.stringify(editEnabledLanguages.value) : null,
    }
    await coursesApi.update(courseId, updateData)
    message.success('更新成功')
    showEditModal.value = false
    fetchCourse()
  }
  catch (e: any) { message.error(e?.message || '更新失败') }
  finally { saving.value = false }
}

const addProblemId = ref<number | null>(null)
const addingProblem = ref(false)
const problemSearchLoading = ref(false)
const problemOptions = ref<SelectOption[]>([])

async function handleProblemSearch(keyword: string) {
  const search = keyword.trim()
  if (!search) {
    problemOptions.value = []
    return
  }
  problemSearchLoading.value = true
  try {
    const res = await problemsApi.list({ search, page: 1, perPage: 20 })
    problemOptions.value = (res.data.items || []).map(problem => ({
      label: `[${problem.logicId}] ${problem.title}`,
      value: problem.id,
    }))
  }
  catch {
    problemOptions.value = []
  }
  finally {
    problemSearchLoading.value = false
  }
}

const courseProblems = computed(() => {
  const probs = course.value?.problems || []
  return probs.map((p: any) => typeof p === 'object' ? p : { id: p })
})

async function handleAddProblem() {
  if (!addProblemId.value) return
  addingProblem.value = true
  try {
    await coursesApi.addProblem(courseId, addProblemId.value)
    message.success('添加成功')
    addProblemId.value = null
    fetchCourse()
  }
  catch (e: any) { message.error(e?.message || '添加失败') }
  finally { addingProblem.value = false }
}

async function handleRemoveProblem(problemId: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定要从课程中移除该题目吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await coursesApi.removeProblem(courseId, problemId)
        message.success('删除成功')
        fetchCourse()
      }
      catch (e: any) { message.error(e?.message || '删除失败') }
    },
  })
}

const problemColumns: DataTableColumns<any> = [
  {
    title: '题号',
    key: 'problemId',
    width: 90,
    render(row) {
      const num = row.logicId ? `${row.prefix ? row.prefix + '-' : ''}${row.logicId}` : String(row.problemId)
      return h('div', { style: 'line-height:1.3' }, [
        h('span', { style: 'font-weight:700' }, num),
      ])
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row) {
      return validContextId(row.problemId)
        ? h('a', { href: `/course/${courseId}/problems/${row.problemId}`, style: 'color:#2080f0' }, row.title ?? '-')
        : h('span', row.title ?? '-')
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(NButton, {
        size: 'small', type: 'error', ghost: true,
        onClick: () => handleRemoveProblem(row.problemId),
      }, { default: () => '移除' })
    },
  },
]

const courseMembers = ref<any[]>([])
const membersLoading = ref(false)
const addUserId = ref<number | null>(null)
const addingMember = ref(false)
const userSearchLoading = ref(false)
const userOptions = ref<SelectOption[]>([])

async function handleUserSearch(keyword: string) {
  const search = keyword.trim()
  if (!search) {
    userOptions.value = []
    return
  }
  userSearchLoading.value = true
  try {
    const res = await usersApi.list({ search, page: 1, perPage: 20 })
    userOptions.value = (res.data.items || []).map((user: any) => ({
      label: `${user.username} (${user.certifiedName || ''})`,
      value: user.id,
    }))
  }
  catch {
    userOptions.value = []
  }
  finally {
    userSearchLoading.value = false
  }
}

async function fetchMembers() {
  membersLoading.value = true
  try {
    const res = await coursesApi.getStudents(courseId)
    const raw = Array.isArray(res.data) ? res.data : []
    courseMembers.value = raw.map((cu: any) => cu.user ?? cu)
  }
  catch (e) { console.error(e) }
  finally { membersLoading.value = false }
}

async function handleAddMember() {
  if (!addUserId.value) return
  addingMember.value = true
  try {
    await coursesApi.addStudents(courseId, [addUserId.value])
    message.success('添加成功')
    addUserId.value = null
    fetchMembers()
  }
  catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '添加失败'
    message.error(msg)
  }
  finally { addingMember.value = false }
}

async function handleRemoveMember(userId: number) {
  dialog.warning({
    title: '确认移除',
    content: '确定要移除该成员吗？',
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await coursesApi.removeStudent(courseId, userId)
        message.success('移除成功')
        fetchMembers()
      }
      catch (e: any) { message.error(e?.message || '移除失败') }
    },
  })
}

async function handleImportMembers(options: UploadCustomRequestOptions) {
  const file = options.file.file
  if (!file) return
  try {
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const userIds = lines.map(l => Number(l.split(',')[0].trim())).filter(id => !isNaN(id) && id > 0)
    await coursesApi.addStudents(courseId, userIds)
    message.success(`导入 ${userIds.length} 个成员成功`)
    fetchMembers()
  }
  catch (e: any) { message.error(e?.message || '导入失败') }
  options.onFinish()
}

const memberColumns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '用户名', key: 'username', render: r => Number.isInteger(r.id) && r.id > 0 && r.username ? h('a', { href: `/users/${r.id}` }, r.username) : (r.username || '-') },
  { title: '学号', key: 'studentId', render: r => r.studentId || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(NButton, {
        size: 'small', type: 'error', ghost: true,
        onClick: () => handleRemoveMember(row.id),
      }, { default: () => '移除' })
    },
  },
]

// 批量导入用户
const importUserText = ref('')
const importingUsers = ref(false)
const importResult = ref<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

async function handleBatchImportUsers() {
  const raw = importUserText.value.trim()
  if (!raw) { message.warning('请输入用户名'); return }
  const usernames = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
  if (!usernames.length) { message.warning('未解析到有效用户名'); return }
  importingUsers.value = true
  importResult.value = null
  try {
    const failed: string[] = []
    const userIds: number[] = []
    for (const username of usernames) {
      try {
        const res = await usersApi.getByUsername(username)
        if (res.data?.id) userIds.push(res.data.id)
        else failed.push(username)
      }
      catch { failed.push(username) }
    }
    if (userIds.length) {
      await coursesApi.addStudents(courseId, userIds)
    }
    const parts: string[] = []
    if (userIds.length) parts.push(`成功导入 ${userIds.length} 个用户`)
    if (failed.length) parts.push(`${failed.length} 个未找到: ${failed.join(', ')}`)
    importResult.value = {
      type: failed.length ? (userIds.length ? 'warning' : 'error') : 'success',
      text: parts.join('；'),
    }
    if (userIds.length) {
      importUserText.value = ''
      fetchMembers()
    }
  }
  catch (e: any) {
    importResult.value = { type: 'error', text: e?.response?.data?.message || e?.message || '导入失败' }
  }
  finally { importingUsers.value = false }
}

const submissions = ref<any[]>([])
const submissionsLoading = ref(false)
const submissionPage = ref(1)
const submissionPageCount = ref(1)
const submissionPerPage = 20
const validContextId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const router = useRouter()
const queryPagePath = route.path
const adminCourseTabs = ['info', 'problems', 'members', 'import-user', 'rate', 'sus', 'submissions', 'ranking']
let applyingRouteState = false
function readAdminCourseRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingRouteState = true
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  const validTab = adminCourseTabs.includes(tab)
  const page = Number(route.query.page)
  const validPage = Number.isInteger(page) && page > 0
  if ((route.query.tab !== undefined && !validTab) || (route.query.page !== undefined && !validPage)) {
    const query = { ...route.query }
    if (!validTab) delete query.tab
    if (!validPage) delete query.page
    void router.replace({ query })
  }
  activeTab.value = validTab ? tab : 'info'
  submissionPage.value = validPage ? page : 1
  queueMicrotask(() => { applyingRouteState = false })
}
function writeAdminCourseRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  if (applyingRouteState) return
  const query = { ...route.query }
  if (activeTab.value === 'info') delete query.tab
  else query.tab = activeTab.value
  if (activeTab.value === 'submissions' && submissionPage.value > 1) query.page = String(submissionPage.value)
  else delete query.page
  void router.push({ query })
}
readAdminCourseRouteState()
watch(() => route.query, readAdminCourseRouteState)
watch([activeTab, submissionPage], writeAdminCourseRouteState)
watch(submissionPage, () => { if (activeTab.value === 'submissions') fetchSubmissions() })

async function fetchSubmissions() {
  submissionsLoading.value = true
  try {
    const res = await coursesApi.getSubmissions(courseId, {
      page: submissionPage.value,
      perPage: submissionPerPage,
    })
    const data = res.data as any
    submissions.value = data?.items || data || []
    if (data?.total) {
      submissionPageCount.value = Math.ceil(data.total / submissionPerPage)
    }
  }
  catch (e) { console.error(e) }
  finally { submissionsLoading.value = false }
}

const submissionColumns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 70, render: r => validContextId(r.id) ? h('a', { href: `/submissions/${r.id}`, style: 'color:var(--lv-color-accent)' }, `#${r.id}`) : h('span', '-') },
  { title: '用户', key: 'user', render: r => r.user?.username && validContextId(r.userId) ? h('a', { href: `/users/${r.userId}` }, r.user.username) : (r.user?.username || r.userId) },
  { title: '题目', key: 'problem', render: r => r.problem?.title ? (validContextId(r.problemId) ? h('a', { href: `/course/${courseId}/problems/${r.problemId}` }, r.problem.title) : r.problem.title) : r.problemId },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: r => h(NTag, { type: STATUS_COLOR[r.status] as any || 'default', size: 'small' },
      { default: () => STATUS_LABEL[r.status] || r.status }),
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 160,
    render: r => dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
  },
]

const ranking = ref<CourseRankItem[]>([])
const rankingLoading = ref(false)

async function fetchRanking() {
  rankingLoading.value = true
  try {
    const res = await coursesApi.getRanking(courseId)
    ranking.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error(e) }
  finally { rankingLoading.value = false }
}

// 通过率 tab
const hasRateData = computed(() =>
  courseProblems.value.some((p: any) => p.submits != null || p.accepts != null),
)

const rateColumns: DataTableColumns<any> = [
  { title: '序号', key: 'idx', width: 70, render: (_row, idx) => idx + 1 },
  { title: '题目', key: 'title', render: row => row.title || '-' },
  { title: '提交数', key: 'submits', width: 90, render: row => row.submits ?? '-' },
  { title: '通过数', key: 'accepts', width: 90, render: row => row.accepts ?? '-' },
  {
    title: '通过率',
    key: 'rate',
    width: 120,
    render(row) {
      const s = row.submits ?? 0
      const a = row.accepts ?? 0
      if (!s) return h('span', '-')
      const pct = Math.round(a / s * 10000) / 100
      return h('span', `${pct}%`)
    },
  },
]

// 查重入口 tab
const suspicionsApi = useSuspicionsApi()
const susPreview = ref<any[]>([])
const susLoading = ref(false)

async function fetchSusPreview() {
  susLoading.value = true
  try {
    const res = await suspicionsApi.list({ courseId, perPage: 5 })
    susPreview.value = res.data?.items || []
  }
  catch (e) { console.error(e) }
  finally { susLoading.value = false }
}

const susColumns: DataTableColumns<any> = [
  { title: '提交ID', key: 'submissionId', width: 90, render: row => row.submissionId || row.id },
  { title: '用户', key: 'user', render: row => row.user?.username || row.username || row.userId || '-' },
  { title: '哈希', key: 'hashsum', render: row => row.hashsum ? row.hashsum.slice(0, 12) + '...' : '-' },
]

const rankingColumns: DataTableColumns<CourseRankItem> = [
  { title: '排名', key: 'rank', width: 80 },
  {
    title: '用户',
    key: 'username',
    render: (r: any) => {
      const userText = `${r.user?.username || r.username || 'unknown'}(#${r.userId})`
      const certifiedName = r.user?.certifiedName || r.certifiedName
      return certifiedName ? `${certifiedName} · ${userText}` : userText
    },
  },
  { title: '分数', key: 'score', width: 100 },
]

watch(activeTab, (tab) => {
  if (tab === 'members' && !courseMembers.value.length) fetchMembers()
  if (tab === 'submissions' && !submissions.value.length) fetchSubmissions()
  if (tab === 'ranking' && !ranking.value.length) fetchRanking()
  if (tab === 'sus' && !susPreview.value.length) fetchSusPreview()
})

useHead({ title: '课程编辑' })
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.admin-course-detail {
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
