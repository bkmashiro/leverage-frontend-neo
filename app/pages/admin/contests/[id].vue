<template>
  <div class="admin-contest-detail">
    <div class="page-header">
      <NSpace align="center">
        <NButton text @click="navigateTo('/admin/contests')">
          ← 返回列表
        </NButton>
        <NH2 style="margin: 0">
          {{ contest?.name || contest?.title || (isExam ? '考试详情' : '竞赛详情') }}
        </NH2>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="info" :tab="isExam ? '考试信息' : '基本信息'">
          <NCard v-if="contest" style="max-width: 600px; margin-top: 16px">
            <NDescriptions :column="1" label-placement="left" bordered>
              <NDescriptionsItem label="ID">{{ contest.id }}</NDescriptionsItem>
              <NDescriptionsItem :label="isExam ? '考试名称' : '标题'">{{ contest.name || contest.title }}</NDescriptionsItem>
              <NDescriptionsItem label="类型">
                <NTag :type="typeColorMap[contest.type?.toLowerCase()] || 'default'" size="small">
                  {{ typeLabel[contest.type?.toLowerCase()] || contest.type?.toUpperCase() || '-' }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="开始时间">{{ fmtTime(contest.startTime) }}</NDescriptionsItem>
              <NDescriptionsItem label="结束时间">{{ fmtTime(contest.endTime) }}</NDescriptionsItem>
              <NDescriptionsItem label="题目数">{{ contest.problems?.length || 0 }}</NDescriptionsItem>
            </NDescriptions>
            <div style="margin-top: 16px">
              <NButton type="primary" @click="openEditModal">{{ isExam ? '编辑考试' : '编辑竞赛' }}</NButton>
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
              :data="contest?.problems || []"
              :row-key="(row: any) => row.id"
              size="small"
            />
          </div>
        </NTabPane>

        <NTabPane name="users" tab="用户管理">
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
              <NButton type="primary" :loading="addingUser" @click="handleAddUser">添加用户</NButton>
              <NButton @click="fetchContestUsers">刷新</NButton>
              <NUpload
                :custom-request="handleImportUsers"
                accept=".csv,.txt"
                :show-file-list="false"
              >
                <NButton>导入用户 (CSV)</NButton>
              </NUpload>
              <NButton @click="exportUsersCsv">导出用户名单 CSV</NButton>
            </NSpace>
            <NDataTable
              :columns="userColumns"
              :data="contestUsers"
              :loading="usersLoading"
              :row-key="(row: any) => row.id"
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

        <NTabPane name="balloons" tab="气球">
          <div style="margin-top: 16px">
            <NButton style="margin-bottom: 12px" @click="fetchBalloons">刷新</NButton>
            <NDataTable
              :columns="balloonColumns"
              :data="balloons"
              :loading="balloonsLoading"
              :row-key="(row: any) => row.id"
              size="small"
            />
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

        <NTabPane name="rate" tab="通过率">
          <div style="margin-top: 16px">
            <NDataTable
              :columns="rateColumns"
              :data="contest?.problems || []"
              :row-key="(row: any) => row.problemId || row.id"
              size="small"
            />
          </div>
        </NTabPane>

        <NTabPane name="event" tab="事件日志">
          <div style="margin-top: 16px">
            <template v-if="contestEvents.length">
              <NDataTable
                :columns="eventColumns"
                :data="contestEvents"
                :row-key="(_row: any, idx: number) => idx"
                size="small"
              />
            </template>
            <NEmpty v-else description="暂无事件日志" />
          </div>
        </NTabPane>

        <NTabPane name="scoreboard" tab="排行榜">
          <div style="margin-top: 16px">
            <NSpace style="margin-bottom: 12px">
              <NButton @click="fetchRanking">刷新</NButton>
              <NButton @click="exportCsv">导出 CSV</NButton>
            </NSpace>
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

    <NModal v-model:show="showEditModal" :title="isExam ? '编辑考试' : '编辑竞赛'" preset="dialog" style="width: 560px">
      <NForm :model="editForm" label-placement="left" label-width="90px" style="margin-top: 12px">
        <NFormItem label="标题" required>
          <NInput v-model:value="editForm.name" placeholder="输入竞赛标题" />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect v-model:value="editForm.type" :options="typeOptions" />
        </NFormItem>
        <NFormItem label="开始时间" required>
          <NDatePicker
            v-model:value="editStartMs"
            type="datetime"
            clearable
            style="width: 100%"
            @update:value="v => editForm.startTime = v ? dayjs(v).toISOString() : ''"
          />
        </NFormItem>
        <NFormItem label="结束时间" required>
          <NDatePicker
            v-model:value="editEndMs"
            type="datetime"
            clearable
            style="width: 100%"
            @update:value="v => editForm.endTime = v ? dayjs(v).toISOString() : ''"
          />
        </NFormItem>
        <NFormItem label="罚时分钟">
          <NInputNumber v-model:value="editForm.penalty" :min="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="封榜分钟">
          <NInputNumber v-model:value="editForm.freezeTime" :min="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="结束后封榜">
          <NInputNumber v-model:value="editForm.freezeTimeAfterEnd" :min="0" style="width: 100%" />
        </NFormItem>
        <NFormItem label="允许语言">
          <NSelect v-model:value="editEnabledLanguages" :options="LANGUAGE_OPTIONS" multiple clearable />
        </NFormItem>
        <NFormItem label="竞赛公告">
          <NInput v-model:value="editForm.notification" type="textarea" :rows="4" placeholder="输入竞赛公告" />
        </NFormItem>
        <NFormItem label="按分计分">
          <NSwitch v-model:value="editForm.scoreByPoint" />
        </NFormItem>
        <NFormItem label="开放注册">
          <NSwitch v-model:value="editForm.openForRegistration" />
        </NFormItem>
        <NFormItem label="完全封榜">
          <NSwitch v-model:value="editForm.fullyFreeze" />
        </NFormItem>
        <NFormItem label="允许直登">
          <NSwitch v-model:value="editForm.allowDirectLogin" />
        </NFormItem>
        <NFormItem label="公开">
          <NSwitch v-model:value="editForm.public" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSaveEdit">保存</NButton>
        </NSpace>
      </template>
    </NModal>

  <!-- 题目属性编辑弹窗 -->
  <NModal v-model:show="showProblemEditModal" title="编辑题目属性" preset="dialog" style="width: 380px">
    <NForm :model="problemEditForm" label-placement="left" label-width="70px" style="margin-top: 12px">
      <NFormItem label="标签">
        <NInput v-model:value="problemEditForm.label" placeholder="如 A" style="width: 60px" />
      </NFormItem>
      <NFormItem label="分值">
        <NInputNumber v-model:value="problemEditForm.weight" :min="0" :step="1" style="width: 120px" />
      </NFormItem>
      <NFormItem label="气球颜色">
        <NSpace align="center">
          <span
            :style="`display:inline-block;width:28px;height:28px;border-radius:4px;border:1px solid #ddd;background:${problemEditForm.color || '#fff'};flex-shrink:0`"
          />
          <input
            type="color"
            :value="problemEditForm.color || '#ffffff'"
            style="width:36px;height:28px;padding:1px;border:1px solid #ddd;border-radius:4px;cursor:pointer"
            @input="(e: any) => problemEditForm.color = e.target.value"
          />
          <NInput v-model:value="problemEditForm.color" placeholder="#e63946" style="width:110px" />
          <NButton text size="small" type="error" @click="problemEditForm.color = null">清除</NButton>
        </NSpace>
      </NFormItem>
    </NForm>
    <template #action>
      <NButton @click="showProblemEditModal = false">取消</NButton>
      <NButton type="primary" :loading="savingProblem" @click="saveProblemEdit">保存</NButton>
    </template>
  </NModal>
  </div>
</template>

<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns, SelectOption, UploadCustomRequestOptions } from 'naive-ui'
import dayjs from 'dayjs'
import type { Contest, RankItem } from '~/types'
import { STATUS_LABEL, STATUS_COLOR, LANGUAGE_OPTIONS, parseEnabledLanguages } from '~/types'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const contestId = Number(route.params.id)
const contestsApi = useContestsApi()
const problemsApi = useProblemsApi()
const usersApi = useUsersApi()
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const message = useMessage()
const dialog = useDialog()

const contest = ref<Contest | null>(null)
const loading = ref(false)
const activeTab = ref('info')

const typeColorMap: Record<string, any> = {
  contest: 'info',
  exam: 'warning',
  icpc: 'info',
  ioi: 'success',
  oi: 'primary',
  cf: 'error',
}

const typeLabel: Record<string, string> = {
  contest: '竞赛',
  exam: '考试',
  icpc: 'ICPC',
  ioi: 'IOI',
  oi: 'OI',
  cf: 'CF',
}

const typeOptions = [
  { label: '竞赛 (Contest)', value: 'contest' },
  { label: '考试 (Exam)', value: 'exam' },
  { label: 'ICPC', value: 'icpc' },
  { label: 'IOI', value: 'ioi' },
  { label: 'OI', value: 'oi' },
  { label: 'Codeforces', value: 'cf' },
]

const isExam = computed(() => contest.value?.type === 'exam')

function fmtTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'
}

async function fetchContest() {
  loading.value = true
  try {
    const res = await contestsApi.get(contestId)
    contest.value = res.data
  }
  catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(async () => {
  await fetchContest()
  if (activeTab.value === 'submissions' && !submissionsLoading.value) await fetchSubmissions()
  else if (activeTab.value === 'users') await fetchContestUsers()
  else if (activeTab.value === 'balloons') await fetchBalloons()
  else if (activeTab.value === 'scoreboard') await fetchRanking()
})

const showEditModal = ref(false)
const saving = ref(false)

// 题目属性编辑
const showProblemEditModal = ref(false)
const editingProblem = ref<any>(null)
const problemEditForm = ref({ color: '' as string | null, weight: 1, label: '' })
const savingProblem = ref(false)

function openProblemEdit(row: any) {
  editingProblem.value = row
  problemEditForm.value = { color: row.color ?? '', weight: row.weight ?? 1, label: row.label ?? '' }
  showProblemEditModal.value = true
}

async function saveProblemEdit() {
  if (!editingProblem.value) return
  savingProblem.value = true
  try {
    await contestsApi.updateProblem(contestId, editingProblem.value.problemId, {
      color: problemEditForm.value.color || null,
      weight: problemEditForm.value.weight,
      label: problemEditForm.value.label,
    })
    message.success('保存成功')
    showProblemEditModal.value = false
    fetchContest()
  }
  catch { message.error('保存失败') }
  finally { savingProblem.value = false }
}
const editStartMs = ref<number | null>(null)
const editEndMs = ref<number | null>(null)
const editEnabledLanguages = ref<string[]>([])
const editForm = ref({
  name: '',
  type: 'icpc',
  startTime: '',
  endTime: '',
  penalty: 0,
  scoreByPoint: false,
  openForRegistration: false,
  fullyFreeze: false,
  freezeTime: 0,
  freezeTimeAfterEnd: 0,
  enabledLanguageJSON: null as string | null,
  notification: '',
  allowDirectLogin: false,
  public: false,
})

function openEditModal() {
  if (!contest.value) return
  editEnabledLanguages.value = parseEnabledLanguages(contest.value.enabledLanguageJSON)
  editForm.value = {
    name: contest.value.name || contest.value.title,
    type: contest.value.type || 'icpc',
    startTime: contest.value.startTime,
    endTime: contest.value.endTime,
    penalty: contest.value.penalty ?? 0,
    scoreByPoint: !!contest.value.scoreByPoint,
    openForRegistration: !!contest.value.openForRegistration,
    fullyFreeze: !!contest.value.fullyFreeze,
    freezeTime: contest.value.freezeTime ?? 0,
    freezeTimeAfterEnd: contest.value.freezeTimeAfterEnd ?? 0,
    enabledLanguageJSON: contest.value.enabledLanguageJSON ?? null,
    notification: contest.value.notification || '',
    allowDirectLogin: !!contest.value.allowDirectLogin,
    public: !!contest.value.public,
  }
  editStartMs.value = dayjs(contest.value.startTime).valueOf()
  editEndMs.value = dayjs(contest.value.endTime).valueOf()
  showEditModal.value = true
}

async function handleSaveEdit() {
  saving.value = true
  try {
    const updateData = {
      ...editForm.value,
      enabledLanguageJSON: editEnabledLanguages.value.length > 0 ? JSON.stringify(editEnabledLanguages.value) : null,
    }
    await contestsApi.update(contestId, updateData)
    message.success('更新成功')
    showEditModal.value = false
    fetchContest()
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

async function handleAddProblem() {
  if (!addProblemId.value) return
  addingProblem.value = true
  try {
    await contestsApi.addProblem(contestId, addProblemId.value)
    message.success('添加成功')
    addProblemId.value = null
    fetchContest()
  }
  catch (e: any) { message.error(e?.message || '添加失败') }
  finally { addingProblem.value = false }
}

async function handleRemoveProblem(problemId: number) {
  dialog.warning({
    title: '确认删除',
    content: '确定要从竞赛中移除该题目吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await contestsApi.removeProblem(contestId, problemId)
        message.success('删除成功')
        fetchContest()
      }
      catch (e: any) { message.error(e?.message || '删除失败') }
    },
  })
}

const problemColumns: DataTableColumns<any> = [
  {
    title: '题号',
    key: 'label',
    width: 90,
    render(row) {
      const problemNum = row.logicId
        ? `${row.prefix ? row.prefix + '-' : ''}${row.logicId}`
        : ''
      return h('div', { style: 'line-height: 1.3' }, [
        h('span', { style: 'font-weight: 700; font-size: 15px' }, row.label ?? ''),
        h('br'),
        h('span', { style: 'color: #999; font-size: 11px' }, problemNum),
      ])
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row) {
      return h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, [
        validContextId(row.problemId)
          ? h('a', { href: `/contests/${contestId}/problems/${row.problemId}`, style: 'font-size:13px;color:#2080f0' }, row.title ?? '-')
          : h('span', { style: 'font-size:13px' }, row.title ?? '-'),
        h('div', { style: 'display:flex;gap:8px;margin-top:2px' }, [
          h(resolveComponent('NButton') as any,
            { text: true, size: 'tiny', type: 'warning', onClick: () => navigateTo(`/admin/problems/${row.problemId}`) },
            { default: () => '编辑' }),
        ]),
      ])
    },
  },
  {
    title: '颜色',
    key: 'color',
    width: 60,
    render(row) {
      if (!row.color) return h('span', { style: 'color:#aaa' }, '-')
      // 只显示色块，忽略可能存在的 rgb 格式旧数据
      const isHex = /^#[0-9a-fA-F]{3,8}$/.test(row.color)
      return h('span', {
        title: row.color,
        style: `display:inline-block;width:20px;height:20px;border-radius:4px;background:${isHex ? row.color : '#ccc'};border:1px solid rgba(0,0,0,.15)`,
      })
    },
  },
  {
    title: '分值',
    key: 'weight',
    width: 60,
    render(row) { return h('span', row.weight ?? 1) },
  },
  {
    title: '操作',
    key: 'actions',
    width: 130,
    render(row) {
      return h('div', { style: 'display:flex;gap:6px' }, [
        h(NButton, {
          size: 'small', type: 'primary', ghost: true,
          onClick: () => openProblemEdit(row),
        }, { default: () => '编辑' }),
        h(NButton, {
          size: 'small', type: 'error', ghost: true,
          onClick: () => handleRemoveProblem(row.problemId),
        }, { default: () => '移除' }),
      ])
    },
  },
]

const contestUsers = ref<any[]>([])
const usersLoading = ref(false)
const addUserId = ref<number | null>(null)
const addingUser = ref(false)
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

async function handleAddUser() {
  if (!addUserId.value) return
  addingUser.value = true
  try {
    await contestsApi.addContestUser(contestId, addUserId.value)
    message.success('添加成功')
    addUserId.value = null
    fetchContestUsers()
  }
  catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '添加失败'
    message.error(msg)
  }
  finally { addingUser.value = false }
}

async function fetchContestUsers() {
  usersLoading.value = true
  try {
    const res = await contestsApi.getContestUsers(contestId)
    contestUsers.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error(e) }
  finally { usersLoading.value = false }
}

const exportUsersCsv = async () => {
  const token = authStore.accessToken
  const url = `${runtimeConfig.public.apiBase}/contests/${contestId}/users/export?token=${token}`
  window.open(url, '_blank')
}

async function handleRemoveUser(userId: number) {
  dialog.warning({
    title: '确认移除',
    content: '确定要移除该参赛用户吗？',
    positiveText: '移除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await contestsApi.removeContestUser(contestId, userId)
        message.success('移除成功')
        fetchContestUsers()
      }
      catch (e: any) { message.error(e?.message || '移除失败') }
    },
  })
}

async function handleImportUsers(options: UploadCustomRequestOptions) {
  const file = options.file.file
  if (!file) return
  try {
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const users = lines.map((line) => {
      const [username, studentId] = line.split(',').map(s => s.trim())
      return { username, studentId }
    }).filter(u => u.username)
    await contestsApi.importContestUsers(contestId, users)
    message.success(`导入 ${users.length} 个用户成功`)
    fetchContestUsers()
  }
  catch (e: any) { message.error(e?.message || '导入失败') }
  options.onFinish()
}

const userColumns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '用户名', key: 'username', render: row => Number.isInteger(row.id) && row.id > 0 ? h('a', { href: `/users/${row.id}` }, row.username) : (row.username || '-') },
  { title: '学号', key: 'studentId', render: r => r.studentId || '-' },
  { title: '邮箱', key: 'email', render: r => r.email || '-' },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row) {
      return h(NButton, {
        size: 'small', type: 'error', ghost: true,
        onClick: () => handleRemoveUser(row.id),
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
    const users = usernames.map(username => ({ username }))
    await contestsApi.importContestUsers(contestId, users)
    importResult.value = { type: 'success', text: `成功导入 ${users.length} 个用户` }
    importUserText.value = ''
    fetchContestUsers()
  }
  catch (e: any) {
    importResult.value = { type: 'error', text: e?.response?.data?.message || e?.message || '导入失败' }
  }
  finally { importingUsers.value = false }
}

const balloons = ref<any[]>([])
const balloonsLoading = ref(false)

async function fetchBalloons() {
  balloonsLoading.value = true
  try {
    const res = await contestsApi.getBalloons(contestId)
    balloons.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error(e) }
  finally { balloonsLoading.value = false }
}

async function handleMarkDelivered(bid: number) {
  try {
    await contestsApi.markBalloonDelivered(contestId, bid)
    message.success('已标记送达')
    fetchBalloons()
  }
  catch (e: any) { message.error(e?.message || '操作失败') }
}

const balloonColumns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '用户', key: 'username', render: r => r.username ? `${r.username}(#${r.userId})` : r.userId },
  { title: '题目', key: 'problemLabel', render: r => r.problemLabel ? `${r.problemLabel}` : r.problemId },
  {
    title: '状态',
    key: 'delivered',
    width: 100,
    render: r => h(NTag, { type: r.delivered ? 'success' : 'warning', size: 'small' },
      { default: () => r.delivered ? '已送达' : '待送达' }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row) {
      if (row.delivered) return h('span', '-')
      return h(NButton, {
        size: 'small', type: 'primary', ghost: true,
        onClick: () => handleMarkDelivered(row.id),
      }, { default: () => '标记送达' })
    },
  },
]

const submissions = ref<any[]>([])
const submissionsLoading = ref(false)
const submissionPage = ref(1)
const submissionPageCount = ref(1)
const submissionPerPage = 20
const validContextId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const router = useRouter()
const queryPagePath = route.path
const adminContestTabs = ['info', 'problems', 'users', 'import-user', 'balloons', 'submissions', 'rate', 'event', 'scoreboard']
let applyingRouteState = false
function readAdminContestRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingRouteState = true
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  const validTab = adminContestTabs.includes(tab)
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
function writeAdminContestRouteState() {
  if (router.currentRoute.value.path !== queryPagePath) return
  if (applyingRouteState) return
  const query = { ...route.query }
  if (activeTab.value === 'info') delete query.tab
  else query.tab = activeTab.value
  if (activeTab.value === 'submissions' && submissionPage.value > 1) query.page = String(submissionPage.value)
  else delete query.page
  void router.push({ query })
}
readAdminContestRouteState()
watch(() => route.query, readAdminContestRouteState)
watch([activeTab, submissionPage], writeAdminContestRouteState)
watch(submissionPage, () => { if (activeTab.value === 'submissions') fetchSubmissions() })

async function fetchSubmissions() {
  submissionsLoading.value = true
  try {
    const res = await contestsApi.getContestSubmissions(contestId, {
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
  { title: '用户', key: 'user', render: r => r.user?.username && validContextId(r.userId) ? h('a', { href: `/users/${r.userId}` }, `${r.user.username}(#${r.userId})`) : (r.user?.username ? `${r.user.username}(#${r.userId})` : r.userId) },
  { title: '题目', key: 'problem', render: r => r.problem?.title ? (validContextId(r.problemId) ? h('a', { href: `/contests/${contestId}/problems/${r.problemId}` }, `${r.problemLabel || ''} · ${r.problem.title}`) : `${r.problemLabel || ''} · ${r.problem.title}`) : r.problemId },
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

const ranking = ref<RankItem[]>([])
const rankingLoading = ref(false)

async function fetchRanking() {
  rankingLoading.value = true
  try {
    const res = await contestsApi.getRanking(contestId, 1, 200)
    ranking.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error(e) }
  finally { rankingLoading.value = false }
}

const exportCsv = async () => {
  const token = authStore.accessToken
  const url = `${runtimeConfig.public.apiBase}/contests/${contestId}/results/export?token=${token}`
  window.open(url, '_blank')
}

const exportSubmissionsCsv = async () => {
  const token = authStore.accessToken
  const res = await fetch(`${runtimeConfig.public.apiBase}/submissions/export?contestId=${contestId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contest-${contestId}-submissions.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// 通过率 tab
const rateColumns: DataTableColumns<any> = [
  { title: '序号', key: 'label', width: 70, render: (row, idx) => row.label || idx + 1 },
  { title: '题目', key: 'title', render: row => row.title || '-' },
  { title: '提交数', key: 'submits', width: 90, render: row => row.submits ?? 0 },
  { title: '通过数', key: 'accepts', width: 90, render: row => row.accepts ?? 0 },
  {
    title: '通过率',
    key: 'rate',
    width: 120,
    render(row) {
      const s = row.submits ?? 0
      const a = row.accepts ?? 0
      const pct = s > 0 ? Math.round(a / s * 10000) / 100 : 0
      return h('span', `${pct}%`)
    },
  },
]

// 事件日志 tab
const contestEvents = computed(() => {
  const events = (contest.value as any)?.events
  return Array.isArray(events) ? events : []
})

const eventColumns: DataTableColumns<any> = [
  { title: '时间', key: 'time', width: 180, render: row => fmtTime(row.time || row.createdAt) },
  { title: '类型', key: 'type', width: 120, render: row => row.type || '-' },
  { title: '内容', key: 'content', render: row => row.content || row.message || '-' },
]

const rankingColumns: DataTableColumns<RankItem> = [
  { title: '排名', key: 'rank', width: 80 },
  { title: '用户', key: 'username', render: row => Number.isInteger(row.userId) && row.userId > 0 ? h('a', { href: `/users/${row.userId}` }, row.username) : row.username },
  { title: '分数', key: 'score', width: 100 },
]

watch(activeTab, (tab) => {
  if (tab === 'users' && !contestUsers.value.length) fetchContestUsers()
  if (tab === 'balloons' && !balloons.value.length) fetchBalloons()
  if (tab === 'submissions' && !submissions.value.length) fetchSubmissions()
  if (tab === 'scoreboard' && !ranking.value.length) fetchRanking()
})

useHead(computed(() => ({ title: contest.value?.name || contest.value?.title ? `${contest.value?.name || contest.value?.title}` : '竞赛编辑' })))
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.admin-contest-detail {
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
