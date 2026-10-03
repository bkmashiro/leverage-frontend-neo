<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="submission" class="submission-detail">
    <NH2 style="margin-bottom: 24px">提交详情 #{{ submission.id }}</NH2>

    <!-- 基本信息 -->
    <NCard title="基本信息" style="margin-bottom: 24px">
      <NDescriptions :column="2" label-placement="left" bordered>
        <NDescriptionsItem label="用户">
          <UserLink
            v-if="Number.isSafeInteger(submission.user?.id) && submission.user.id > 0"
            :user-id="submission.user.id"
            :username="submission.user.username"
          />
          <UserLink
            v-else-if="Number.isSafeInteger(submission.userId) && submission.userId > 0"
            :user-id="submission.userId"
            :username="`用户 #${submission.userId}`"
          />
          <span v-else style="color:#999">-</span>
        </NDescriptionsItem>

        <NDescriptionsItem label="题目">
          <NuxtLink
            v-if="detailProblemHref"
            :to="detailProblemHref"
            class="detail-link"
          >
            {{ submission.problem ? `${submission.problem.prefix}${submission.problem.logicId} ${submission.problem.title}` : `#${submission.problemId}` }}
          </NuxtLink>
          <span v-else style="color:#999">-</span>
        </NDescriptionsItem>

        <NDescriptionsItem label="语言">
          {{ LANGUAGE_LABEL[submission.language] || submission.language }}
        </NDescriptionsItem>

        <NDescriptionsItem label="状态">
          <NSpace align="center">
            <StatusTag :status="submission.status" />
          </NSpace>
        </NDescriptionsItem>

        <NDescriptionsItem label="执行时间">
          {{ submission.time !== undefined && submission.time !== null ? `${submission.time}ms` : '-' }}
        </NDescriptionsItem>

        <NDescriptionsItem label="内存使用">
          {{ submission.memory !== undefined && submission.memory !== null ? formatMemory(submission.memory) : '-' }}
        </NDescriptionsItem>

        <NDescriptionsItem label="评测来源">
          <NTag v-if="submission.provider === 'botzone'" type="info" size="small" :bordered="false">
            Botzone
          </NTag>
          <NTag v-else size="small" :bordered="false">本地评测</NTag>
        </NDescriptionsItem>

        <NDescriptionsItem v-if="submission.externalJobId" label="外部任务 ID">
          <NText code>{{ submission.externalJobId }}</NText>
        </NDescriptionsItem>

        <NDescriptionsItem label="提交时间" :span="2">
          {{ dayjs(submission.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
        </NDescriptionsItem>
      </NDescriptions>
    </NCard>

    <!-- OJ 评测汇总 -->
    <NCard
      v-if="isFinalStatus(submission.status)"
      title="评测汇总"
      style="margin-bottom: 24px"
    >
      <NSpace align="center" size="large">
        <!-- 总裁决 -->
        <NStatistic label="总裁决">
          <StatusTag :status="submission.status" />
        </NStatistic>

        <!-- 通过率 -->
        <NStatistic
          v-if="caseResults.length > 0"
          label="测试点通过"
          :value="`${passCount} / ${caseResults.length}`"
        />

        <!-- 通过率进度条 -->
        <div v-if="caseResults.length > 0" style="min-width: 200px">
          <NText depth="3" style="font-size: 12px; display: block; margin-bottom: 4px">
            通过率 {{ passPercent.toFixed(0) }}%
          </NText>
          <NProgress
            type="line"
            :percentage="passPercent"
            :status="passPercent === 100 ? 'success' : passPercent > 0 ? 'warning' : 'error'"
            :show-indicator="false"
          />
        </div>
      </NSpace>
    </NCard>

    <!-- 编译结果 -->
    <NCard
      v-if="isFinalStatus(submission.status) || compileError"
      title="编译结果"
      style="margin-bottom: 24px"
    >
      <template v-if="compileError">
        <NSpace align="center" style="margin-bottom: 12px">
          <NTag type="error" :bordered="false" size="medium">CE 编译失败</NTag>
        </NSpace>
        <NCode :code="compileError" language="text" show-line-numbers />
        <NButton
          text
          type="error"
          size="small"
          style="margin-top: 8px"
          @click="navigateTo(`/submissions/ce/${submission.id}`)"
        >
          查看完整编译错误
        </NButton>
      </template>
      <template v-else>
        <NSpace align="center">
          <NTag type="success" :bordered="false" size="medium">OK 编译成功</NTag>
          <NText depth="3">代码通过编译</NText>
        </NSpace>
      </template>
    </NCard>

    <!-- 测试点详情 -->
    <NCard v-if="caseResults.length > 0" title="测试点详情" style="margin-bottom: 24px">
      <NDataTable
        :columns="caseColumns"
        :data="caseTableData"
        :bordered="true"
        :single-line="false"
        size="small"
      />
    </NCard>

    <!-- Botzone 游戏回放 -->
    <div v-if="submission.provider === 'botzone' && gameLog" style="margin-bottom: 24px">
      <BotzoneReplaySection :game-log="gameLog" />
    </div>

    <!-- 提交代码 -->
    <NCard title="提交代码">
      <CodeEditor
        v-model="codeContent"
        :language="ojEditorLanguage(submission.language)"
        :readonly="true"
        height="500px"
      />
    </NCard>
  </div>
  <div v-else>
    <NResult status="404" title="提交记录不存在" />
  </div>
</template>

<script setup lang="ts">
import { NTag, NText } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { Submission } from '~/types'
import type { BotzoneGameLog } from '~/types/botzone'
import { isFinalStatus, LANGUAGE_LABEL, ojEditorLanguage } from '~/types'
import dayjs from 'dayjs'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const submissionId = computed(() => Number(route.params.id))

// 后端 memory 单位为 bytes，自动换算显示
function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const submissionsApi = useSubmissionsApi()

const submission = ref<Submission | null>(null)
const detailProblemHref = computed(() => {
  const row = submission.value as (Submission & { contestId?: number | null; courseId?: number | null }) | null
  const problemId = Number.isSafeInteger(row?.problem?.id) && (row?.problem?.id ?? 0) > 0 ? row!.problem!.id : row?.problemId
  if (!Number.isSafeInteger(problemId) || (problemId ?? 0) <= 0) return null
  if (Number.isSafeInteger(row?.contestId) && (row?.contestId ?? 0) > 0) return `/contests/${row!.contestId}/problems/${problemId}`
  if (Number.isSafeInteger(row?.courseId) && (row?.courseId ?? 0) > 0) return `/course/${row!.courseId}/problems/${problemId}`
  return `/problems/${problemId}`
})
const loading = ref(true)
const codeContent = ref('')
const caseResults = ref<Array<{
  kind: string
  time: number | null
  memory: number | null
  extraMessage?: string
  actualOutput?: string
}>>([])
const compileError = ref('')
const gameLog = ref<BotzoneGameLog | null>(null)

// OJ 汇总
const passCount = computed(() => caseResults.value.filter(c => c.kind === 'Accepted').length)
const passPercent = computed(() =>
  caseResults.value.length > 0 ? (passCount.value / caseResults.value.length) * 100 : 0,
)

/** JudgeResultKind → 短标签 */
function kindShort(kind: string): string {
  const map: Record<string, string> = {
    Accepted: 'AC',
    WrongAnswer: 'WA',
    PresentationError: 'PE',
    TimeLimitExceeded: 'TLE',
    MemoryLimitExceeded: 'MLE',
    OutpuLimitExceeded: 'OLE',
    RuntimeError: 'RE',
    CompileError: 'CE',
    CompileTimeLimitExceeded: 'CRLE',
    CompileMemoryLimitExceed: 'CRLE',
    CompileFileLimitExceed: 'CRLE',
    SystemError: 'SE',
    SystemTimeLimitExceed: 'SE',
    SystemMemoryLimitExceed: 'SE',
    SystemOutpuLimitExceeded: 'SE',
    SystemRuntimeError: 'SE',
    SystemCompileError: 'SE',
    Unjudged: '?',
  }
  return map[kind] ?? kind.slice(0, 4)
}

const KIND_TAG_TYPE: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  Accepted: 'success',
  WrongAnswer: 'error',
  PresentationError: 'warning',
  TimeLimitExceeded: 'warning',
  MemoryLimitExceeded: 'warning',
  OutpuLimitExceeded: 'warning',
  RuntimeError: 'error',
  CompileError: 'default',
  SystemError: 'error',
  Unjudged: 'info',
}

function kindTagType(kind: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  return KIND_TAG_TYPE[kind] ?? (kind.startsWith('System') ? 'error' : kind.startsWith('Compile') ? 'default' : 'info')
}

// 展开的测试点行 key 集合
const expandedRows = ref<Set<number>>(new Set())

function toggleExpand(index: number) {
  if (expandedRows.value.has(index)) {
    expandedRows.value.delete(index)
  }
  else {
    expandedRows.value.add(index)
  }
}

const caseTableData = computed(() =>
  caseResults.value.map((c, i) => ({ index: i + 1, ...c })),
)

const caseColumns: DataTableColumns<any> = [
  { title: '#', key: 'index', width: 55, align: 'center' },
  {
    title: '结果',
    key: 'kind',
    width: 110,
    align: 'center',
    render(row) {
      return h(NTag, { type: kindTagType(row.kind), size: 'small', bordered: false }, () => kindShort(row.kind))
    },
  },
  {
    title: '时间(ms)',
    key: 'time',
    width: 90,
    align: 'center',
    render(row) {
      return row.time != null ? `${row.time}` : '-'
    },
  },
  {
    title: '内存(KB)',
    key: 'memory',
    width: 100,
    align: 'center',
    render(row) {
      return row.memory != null ? `${Math.round(row.memory / 1024)}` : '-'
    },
  },
  {
    title: '信息',
    key: 'extraMessage',
    ellipsis: { tooltip: true },
    render(row) {
      return row.extraMessage || '-'
    },
  },
  {
    title: '实际输出',
    key: 'actualOutput',
    width: 120,
    align: 'center',
    render(row) {
      if (!row.actualOutput) return h(NText, { depth: 3 }, () => '-')
      const expanded = expandedRows.value.has(row.index)
      return h('div', [
        h(
          'button',
          {
            class: 'output-toggle-btn',
            onClick: () => toggleExpand(row.index),
          },
          expanded ? '收起' : '展开',
        ),
        expanded
          ? h('pre', { class: 'output-pre' }, row.actualOutput)
          : null,
      ])
    },
  },
]

function parseMisc(data: any) {
  codeContent.value = data?.misc?.code || data?.code || ''
  compileError.value = data?.misc?.compileErrorMsg || data?.compileErrorMsg || ''

  // 解析测试点结果
  try {
    const raw = data?.misc?.judgeResult || data?.judgeResult
    if (raw) {
      caseResults.value = typeof raw === 'string' ? JSON.parse(raw) : raw
    }
  }
  catch { /* ignore */ }

  // 解析 Botzone 游戏日志
  try {
    const meta = data?.providerMeta || data?.misc?.providerMeta
    if (meta?.gameLog) {
      gameLog.value = typeof meta.gameLog === 'string'
        ? JSON.parse(meta.gameLog)
        : meta.gameLog
    }
    else {
      gameLog.value = null
    }
  }
  catch { /* ignore */ }
}

// 终态：status < 9
const TERMINAL_CHECK = (status: number) => status < 9

onMounted(async () => {
  try {
    const res = await submissionsApi.get(submissionId.value)
    submission.value = res.data
    parseMisc(res.data)
    // 仍在评测中（pending/judging/compiling）
    if (!TERMINAL_CHECK(res.data.status)) {
      startPolling()
    }
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
})

let pollTimer: ReturnType<typeof setTimeout> | null = null

function startPolling() {
  if (pollTimer) return
  const poll = async () => {
    try {
      const res = await submissionsApi.getStatus(submissionId.value)
      if (submission.value) {
        submission.value = { ...submission.value, status: res.data.status }
      }
      if (TERMINAL_CHECK(res.data.status)) {
        // 到达终态，拉取完整数据
        const full = await submissionsApi.get(submissionId.value)
        submission.value = full.data
        parseMisc(full.data)
        pollTimer = null
        return
      }
      pollTimer = setTimeout(poll, 3000)
    }
    catch {
      // 网络错误时稍后重试
      pollTimer = setTimeout(poll, 3000)
    }
  }
  pollTimer = setTimeout(poll, 3000)
}

onUnmounted(() => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
})

useHead(computed(() => ({ title: `提交 #${submissionId.value} — Leverage OJ` })))
</script>

<style scoped>
.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.detail-link { color: var(--lv-color-accent, #426b96); text-decoration: none; }
.detail-link:hover { text-decoration: underline; }
.detail-link:focus-visible { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }

.submission-detail {
  max-width: 1000px;
  margin: 0 auto;
}

.output-toggle-btn {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: #1677ff;
}

.output-toggle-btn:hover {
  background: #f0f5ff;
}

.output-pre {
  margin-top: 6px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
</style>
