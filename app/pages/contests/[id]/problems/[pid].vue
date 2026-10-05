<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="loadError" class="state-center">
    <NResult :status="loadForbidden ? '403' : '500'" :title="loadForbidden ? '暂时无法访问该题目' : '题目加载失败'" :description="loadError">
      <template #footer>
        <NButton v-if="!loadForbidden" type="primary" @click="loadPage">重试</NButton>
        <NButton v-else @click="navigateTo(`/contests/${contestId}`)">返回竞赛</NButton>
      </template>
    </NResult>
  </div>
  <div v-else-if="problem" class="problem-page">
    <!-- 顶部倒计时 -->
    <div v-if="contestData" class="contest-timer-bar" :class="timerClass">
      <span class="timer-label">{{ timerLabel }}</span>
      <span class="timer-value">{{ timerDisplay }}</span>
    </div>

    <div class="problem-content-area">
    <!-- 左侧：题目信息 -->
    <div ref="problemLeftRef" class="problem-left" @scroll="saveWorkspaceScroll('left', $event)">
      <div class="problem-header">
        <div class="breadcrumb">
          <NButton text type="primary" @click="navigateTo(`/contests/${contestId}`)">
            返回竞赛
          </NButton>
          <span class="breadcrumb-sep"> / </span>
          <span>{{ problemLetter }}. {{ problem.title }}</span>
        </div>
        <NH2 style="margin: 8px 0 0">{{ problemLetter }}. {{ problem.title }}</NH2>
        <div class="problem-meta">
          <NTag size="small" :bordered="false" type="info">
            时间限制: {{ problem.timeLimit }}ms
          </NTag>
          <NTag size="small" :bordered="false" type="warning">
            内存限制: {{ problem.memoryLimit }}MB
          </NTag>
        </div>
        <div v-if="problem.tags && problem.tags.length" class="problem-tags">
          <NTag
            v-for="tag in problem.tags"
            :key="tag.id"
            size="small"
            type="info"
            :bordered="false"
          >
            {{ tag.name }}
          </NTag>
        </div>
      </div>

      <NDivider />

      <MarkdownView :content="problem.content ?? problem.description ?? ''" />
      <PublicSampleExamples v-if="problem.publicSamples?.length" :samples="problem.publicSamples" :selected-index="workbenchRef?.selectedSample ?? null" @use-sample="workbenchRef?.useSample($event)" />
    </div>

    <!-- 右侧：代码编辑器 + 提交 -->
    <div ref="problemRightRef" class="problem-right" @scroll="saveWorkspaceScroll('right', $event)">
      <div class="editor-header">
        <OjLanguageSelect v-model="language" />
      </div>

      <CodeEditor
        ref="editorRef"
        v-model="code"
        :state-key="route.path"
        :language="editorLanguage"
        height="450px"
      />

      <SubmissionWorkbench ref="workbenchRef" :code="code" :language="language" :samples="problem.publicSamples" :special-judge="!!(problem.spjId || problem.checkerLanguage)" :feedback-view="feedbackView" :submitting="submitting" :submit-error="submitError" :can-recover="canRecover" :recovering="recovering" :can-navigate-diagnostics="canNavigateDiagnostics" :diagnostics-stale="diagnosticsStale" @navigate-diagnostic="handleDiagnostic" @submit="handleSubmit" @retry="retryFeedback" @recover="recoverSubmission" />


    </div>
    </div><!-- end problem-content-area -->
  </div>
  <div v-else>
    <NResult status="404" title="题目不存在" />
  </div>
</template>

<script setup lang="ts">
import type { Problem, Contest, OjLanguage } from '~/types'
import { ojEditorLanguage } from '~/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const contestId = computed(() => Number(route.params.id))
const problemId = computed(() => Number(route.params.pid))

const problemsApi = useProblemsApi()
const contestsApi = useContestsApi()

const problem = ref<Problem | null>(null)
const contestData = ref<Contest | null>(null)
const loading = ref(true)
const loadError = ref('')
const loadForbidden = ref(false)

const language = ref<OjLanguage>('cpp17')
const code = ref('')
const editorRef = ref<{ goToDiagnostic: (location: { line: number; column: number }) => boolean } | null>(null)
function handleDiagnostic(location: { line: number; column: number }) {
  if (canNavigateDiagnostics.value && !diagnosticsStale.value) editorRef.value?.goToDiagnostic(location)
}
const workbenchRef = ref<{ useSample: (index: number) => void; selectedSample: number | null; state: { leftScrollTop: number; rightScrollTop: number }; capturePosition: (value: { leftScrollTop?: number; rightScrollTop?: number }) => void } | null>(null)
const problemLeftRef = ref<HTMLElement | null>(null)
const problemRightRef = ref<HTMLElement | null>(null)
function saveWorkspaceScroll(side: 'left' | 'right', event: Event) {
  const key = side === 'left' ? 'leftScrollTop' : 'rightScrollTop'
  const scrollTop = (event.currentTarget as HTMLElement).scrollTop
  if (workbenchRef.value?.state[key] !== scrollTop) workbenchRef.value?.capturePosition({ [key]: scrollTop })
}
watch(workbenchRef, (workbench) => {
  if (!workbench) return
  nextTick(() => {
    if (problemLeftRef.value) problemLeftRef.value.scrollTop = workbench.state.leftScrollTop
    if (problemRightRef.value) problemRightRef.value.scrollTop = workbench.state.rightScrollTop
  })
}, { flush: 'post' })
const { submitting, submitError, feedbackView, retryFeedback, handleSubmit, canRecover, recovering, recoverSubmission, canNavigateDiagnostics, diagnosticsStale } = useProblemSubmission({ problemId, contestId, code, language })

const editorLanguage = computed(() => ojEditorLanguage(language.value))

// 竞赛题目序号（A, B, C...）
const problemLetter = computed(() => {
  if (!contestData.value?.problems || !problem.value) return ''
  const idx = contestData.value.problems.findIndex((p: any) => p.problemId === problem.value!.id)
  return idx >= 0 ? String.fromCharCode(65 + idx) : ''
})

// ── 倒计时 ──────────────────────────────────────────────
const now = ref(Date.now())
let timerInterval: ReturnType<typeof setInterval> | null = null

const timerLabel = computed(() => {
  if (!contestData.value) return ''
  const start = new Date(contestData.value.startTime).getTime()
  const end   = new Date(contestData.value.endTime).getTime()
  const t = now.value
  if (t < start) return '距开始'
  if (t < end)   return '距结束'
  return '竞赛已结束'
})

const timerClass = computed(() => {
  if (!contestData.value) return ''
  const end = new Date(contestData.value.endTime).getTime()
  const diff = end - now.value
  if (diff <= 0) return 'timer-ended'
  if (diff < 10 * 60 * 1000) return 'timer-urgent'   // < 10分钟
  if (diff < 30 * 60 * 1000) return 'timer-warning'  // < 30分钟
  return 'timer-normal'
})

const timerDisplay = computed(() => {
  if (!contestData.value) return ''
  const start = new Date(contestData.value.startTime).getTime()
  const end   = new Date(contestData.value.endTime).getTime()
  const t = now.value
  const diff = t < start ? start - t : t < end ? end - t : 0
  if (diff <= 0) return '--:--:--'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

onMounted(() => {
  timerInterval = setInterval(() => { now.value = Date.now() }, 1000)
  void loadPage()
})

async function loadPage() {
  loading.value = true
  loadError.value = ''
  loadForbidden.value = false
  try {
    const [problemRes, contestRes] = await Promise.all([
      problemsApi.get(problemId.value),
      contestsApi.get(contestId.value),
    ])
    problem.value = (problemRes as any).data ?? problemRes
    contestData.value = (contestRes as any).data ?? contestRes
  }
  catch (error: any) {
    console.error(error)
    loadForbidden.value = [401, 403].includes(error?.response?.status)
    loadError.value = loadForbidden.value
      ? '请确认你已登录并拥有竞赛访问权限。'
      : '请检查网络连接后重试。'
  }
  finally {
    loading.value = false
  }
}




onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

useHead(computed(() => ({ title: problem.value?.title ? `${problem.value.title} — Leverage OJ` : '题目 — Leverage OJ' })))
</script>

<style scoped>
.loading-center,
.state-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.contest-timer-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--lv-space-3);
  padding: var(--lv-space-2) var(--lv-space-4);
  margin-bottom: var(--lv-space-4);
  border: 1px solid var(--lv-color-border);
  border-radius: var(--lv-radius-md);
  background: var(--lv-color-accent-soft);
  color: var(--lv-color-text);
  font-weight: 600;
  font-size: var(--lv-size-body);
  width: 100%;
}

.timer-normal { background: var(--lv-color-accent-soft); color: var(--lv-color-accent); }
.timer-warning { background: #fff4dc; color: var(--lv-color-warning); }
.timer-urgent { background: #fbe9e9; color: var(--lv-color-error); animation: pulse 1s ease-in-out infinite; }
.timer-ended { background: var(--lv-color-canvas); color: var(--lv-color-text-secondary); }
.timer-label { font-size: var(--lv-size-body); }
.timer-value { font-family: var(--lv-font-code); font-size: 20px; letter-spacing: 1px; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.problem-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  width: 100%;
  color: var(--lv-color-text);
  font-family: var(--lv-font-ui);
}

.problem-content-area {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  align-items: start;
  gap: var(--lv-space-6);
  width: 100%;
  min-width: 0;
}

.problem-left,
.problem-right {
  min-width: 0;
  border: 1px solid var(--lv-color-border);
  border-radius: var(--lv-radius-lg);
  background: var(--lv-color-surface);
}

.problem-left {
  padding: clamp(20px, 3vw, 32px);
  line-height: 1.7;
  font-size: var(--lv-size-body);
}

.problem-right {
  position: sticky;
  top: var(--lv-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-3);
  padding: var(--lv-space-4);
}

.problem-header {
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-3);
}

.problem-header :deep(h2) {
  color: var(--lv-color-text);
  font-size: var(--lv-size-title);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.problem-meta,
.problem-tags {
  display: flex;
  gap: var(--lv-space-2);
  flex-wrap: wrap;
}

.editor-header {
  display: flex;
  justify-content: flex-end;
}

.editor-header :deep(.n-select) {
  width: min(100%, 200px);
}

.problem-right :deep(.cm-editor) {
  width: 100%;
  min-width: 0;
  font-family: var(--lv-font-code);
  font-size: var(--lv-size-code);
}

.submit-area,
.submission-result {
  margin-top: var(--lv-space-1);
}

.result-row {
  display: flex;
  align-items: center;
  gap: var(--lv-space-2);
  margin-bottom: var(--lv-space-2);
}

.result-row:last-child { margin-bottom: 0; }
.result-label {
  color: var(--lv-color-text-secondary);
  font-size: var(--lv-size-body);
  min-width: 72px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  color: var(--lv-color-text-secondary);
  font-size: var(--lv-size-body);
}

.breadcrumb-sep {
  margin: 0 var(--lv-space-1);
  color: var(--lv-color-text-secondary);
}

@media (max-width: 900px) {
  .problem-content-area {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--lv-space-4);
  }

  .problem-right {
    position: static;
  }
}

@media (max-width: 600px) {
  .problem-left,
  .problem-right {
    border-radius: var(--lv-radius-md);
    padding: var(--lv-space-3);
  }

  .problem-header :deep(h2) {
    font-size: var(--lv-size-section);
  }

  .contest-timer-bar {
    gap: var(--lv-space-2);
    padding: var(--lv-space-2) var(--lv-space-3);
    margin-bottom: var(--lv-space-3);
    font-size: var(--lv-size-body);
    flex-wrap: wrap;
  }

  .timer-value {
    font-size: 18px;
    letter-spacing: 1px;
  }
}
</style>
