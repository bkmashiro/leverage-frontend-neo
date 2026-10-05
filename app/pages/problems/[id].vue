<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="problem">
    <AdminViewBanner />
  <div ref="pageRef" class="problem-page">
    <!-- 左侧：题目信息 -->
    <div ref="problemLeftRef" class="problem-left" :style="{ flex: isMobile ? 'none' : `0 0 ${leftWidth}px` }" @scroll="saveWorkspaceScroll('left', $event)">
      <div class="problem-header">
        <NH2 style="margin: 0; display: flex; align-items: center; gap: 8px">
          {{ problem.prefix }}{{ problem.logicId }}. {{ problem.title }}
          <span v-if="isAcceptedByCurrentUser" class="ac-flag">✓</span>
        </NH2>
        <div class="problem-meta">
          <NTag type="info" :bordered="false">
            <NIcon size="14" :component="TimeOutline" aria-hidden="true" /> 时间限制: {{ problem.timeLimit }}ms
          </NTag>
          <NTag type="warning" :bordered="false">
            <NIcon size="14" :component="HardwareChipOutline" aria-hidden="true" /> 内存限制: {{ problem.memoryLimit }}MB
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

    <!-- 拖拽分隔条 -->
    <div
      v-if="!isMobile"
      class="drag-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="调整题面与代码区域宽度"
      :aria-valuenow="Math.round(leftWidth / (pageRef?.clientWidth || 1) * 100)"
      tabindex="0"
      @mousedown="startDrag"
      @keydown="resizeSplitWithKeyboard"
    />

    <!-- 右侧：代码编辑器 + 提交 -->
    <div ref="problemRightRef" class="problem-right" :style="{ flex: isMobile ? 'none' : '1', minWidth: isMobile ? '0' : '300px' }" @scroll="saveWorkspaceScroll('right', $event)">
      <div class="editor-header">
        <OjLanguageSelect v-model="language" />
        <NTooltip trigger="hover" placement="top">
          <template #trigger>
            <NButton text aria-label="全屏编辑代码" @click="toggleFullscreen">
              <NIcon size="18" :component="ExpandOutline" />
            </NButton>
          </template>
          {{ isFullscreen ? '退出全屏 (Ctrl+Shift+F)' : '全屏编辑 (Ctrl+Shift+F)' }}
        </NTooltip>
      </div>

      <!-- Retain one editor and run observer while the modal keeps its targets mounted. -->
      <NModal :show="isFullscreen" display-directive="show" :auto-focus="false" :mask-closable="false" @update:show="value => { if (!value) closeFullscreen() }">
      <div class="fullscreen-editor" role="dialog" aria-modal="true" aria-label="全屏代码编辑器">
        <div class="fullscreen-header">
          <OjLanguageSelect v-model="language" />
          <NButton text aria-label="退出全屏编辑" @click="closeFullscreen"><NIcon size="20" :component="ContractOutline" /></NButton>
        </div>
        <div ref="fullscreenCodeTarget" class="fullscreen-body" />
        <div ref="fullscreenFeedbackTarget" class="fullscreen-feedback" />
        <div class="fullscreen-footer"><span class="shortcut-hint">Esc 退出全屏 · Ctrl/Cmd + Enter 提交</span></div>
      </div>
      </NModal>
      <Teleport :to="fullscreenCodeTarget || 'body'" :disabled="!isFullscreen || !fullscreenCodeTarget">
        <CodeEditor
          ref="editorRef"
          v-model="code"
          :state-key="route.path"
          :language="languageName"
          :height="isFullscreen ? '100%' : isMobile ? '300px' : '450px'"
        />
      </Teleport>
      <Teleport :to="fullscreenFeedbackTarget || 'body'" :disabled="!isFullscreen || !fullscreenFeedbackTarget">
        <SubmissionWorkbench ref="workbenchRef" :code="code" :language="language" :samples="problem.publicSamples" :special-judge="!!(problem.spjId || problem.checkerLanguage)" :feedback-view="feedbackView" :submitting="submitting" :submit-error="submitError" :can-recover="canRecover" :recovering="recovering" :can-navigate-diagnostics="canNavigateDiagnostics" :diagnostics-stale="diagnosticsStale" @navigate-diagnostic="handleDiagnostic" @submit="handleSubmit" @retry="retryFeedback" @recover="recoverSubmission" />
      </Teleport>
      <div class="shortcut-hint">
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交 &nbsp;·&nbsp;
        <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> 全屏
      </div>
    </div>
  </div>
  </div>
  <div v-else>
    <NResult status="404" title="题目不存在" />
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { ContractOutline, ExpandOutline, HardwareChipOutline, TimeOutline } from '@vicons/ionicons5'
import type { Problem, OjLanguage } from '~/types'
import { ojEditorLanguage } from '~/types'

const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const problemId = computed(() => Number(route.params.id))

const problemsApi = useProblemsApi()
const usersApi = useUsersApi()
const authStore = useAuthStore()

const problem = ref<Problem | null>(null)
const loading = ref(true)

// 拖拽分隔条
const workbenchRef = ref<{ useSample: (index: number) => void; selectedSample: number | null; state: { leftScrollTop: number; rightScrollTop: number; splitWidth: number | null }; capturePosition: (value: { leftScrollTop?: number; rightScrollTop?: number; splitWidth?: number | null }) => void } | null>(null)
const problemLeftRef = ref<HTMLElement | null>(null)
const problemRightRef = ref<HTMLElement | null>(null)
const pageRef = ref<HTMLElement | null>(null)
const leftWidth = ref(0)
let dragging = false
let stopDragging: (() => void) | undefined

function setLeftWidth(value: number) {
  if (!pageRef.value || isMobile.value) return
  leftWidth.value = Math.min(Math.max(value, 280), pageRef.value.clientWidth - 300)
  workbenchRef.value?.capturePosition({ splitWidth: leftWidth.value })
}

function saveWorkspaceScroll(side: 'left' | 'right', event: Event) {
  if (isFullscreen.value) return
  const element = event.currentTarget as HTMLElement
  const key = side === 'left' ? 'leftScrollTop' : 'rightScrollTop'
  if (workbenchRef.value?.state[key] !== element.scrollTop) workbenchRef.value?.capturePosition({ [key]: element.scrollTop })
}

watch(workbenchRef, (workbench) => {
  if (!workbench) return
  const { leftScrollTop, rightScrollTop, splitWidth } = workbench.state
  if (splitWidth) setLeftWidth(splitWidth)
  nextTick(() => {
    if (problemLeftRef.value) problemLeftRef.value.scrollTop = leftScrollTop
    if (problemRightRef.value) problemRightRef.value.scrollTop = rightScrollTop
  })
}, { flush: 'post' })

function initLeftWidth() {
  if (pageRef.value && !isMobile.value) {
    setLeftWidth(workbenchRef.value?.state.splitWidth ?? pageRef.value.clientWidth * 0.5)
  }
}

// The page container appears only after the asynchronous problem fetch.
watch(pageRef, element => { if (element) nextTick(initLeftWidth) }, { flush: 'post' })

function resizeSplitWithKeyboard(event: KeyboardEvent) {
  if (!pageRef.value) return
  const actions: Record<string, number> = {
    ArrowLeft: leftWidth.value - 32,
    ArrowRight: leftWidth.value + 32,
    Home: 280,
    End: pageRef.value.clientWidth - 300,
  }
  const target = actions[event.key]
  if (target === undefined) return
  event.preventDefault()
  setLeftWidth(target)
}

function startDrag(e: MouseEvent) {
  stopDragging?.()
  dragging = true
  e.preventDefault()
  const onMove = (ev: MouseEvent) => {
    if (!dragging || !pageRef.value) return
    const rect = pageRef.value.getBoundingClientRect()
    const newLeft = ev.clientX - rect.left
    setLeftWidth(newLeft)
  }
  const onUp = () => {
    dragging = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    stopDragging = undefined
  }
  stopDragging = onUp
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

onMounted(() => {
  nextTick(initLeftWidth)
  window.addEventListener('resize', initLeftWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', initLeftWidth)
  stopDragging?.()
})

const language = ref<OjLanguage>('cpp17')
const code = ref('')
const editorRef = ref<{ goToDiagnostic: (location: { line: number; column: number }) => boolean } | null>(null)
function handleDiagnostic(location: { line: number; column: number }) {
  if (canNavigateDiagnostics.value && !diagnosticsStale.value) editorRef.value?.goToDiagnostic(location)
}
const { submitting, submitError, feedbackView, retryFeedback, handleSubmit, canRecover, recovering, recoverSubmission, canNavigateDiagnostics, diagnosticsStale } = useProblemSubmission({ problemId, code, language })
const isAcceptedByCurrentUser = ref(false)

// 全屏状态
const isFullscreen = ref(false)
const fullscreenCodeTarget = ref<HTMLElement | null>(null)
const fullscreenFeedbackTarget = ref<HTMLElement | null>(null)
let normalScrollTop = 0
async function closeFullscreen() {
  isFullscreen.value = false
  await nextTick()
  if (problemRightRef.value) problemRightRef.value.scrollTop = normalScrollTop
}
async function toggleFullscreen() {
  if (isFullscreen.value) return closeFullscreen()
  normalScrollTop = problemRightRef.value?.scrollTop ?? 0
  isFullscreen.value = true
}

const languageName = computed(() => ojEditorLanguage(language.value))
onMounted(async () => {
  try {
    problem.value = (await problemsApi.get(problemId.value)).data

    if (authStore.user?.id) {
      const acRes = await usersApi.getAcceptedProblems(authStore.user.id)
      const accepted = acRes.data?.items ?? []
      isAcceptedByCurrentUser.value = accepted.some((p: any) => Number(p.id) === problemId.value)
    }
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }

  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const ctrl = isMac ? e.metaKey : e.ctrlKey

  // Ctrl/Cmd + Enter → 提交代码
  if (ctrl && !e.shiftKey && e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
    return
  }

  // Ctrl/Cmd + Shift + F → 全屏切换
  if (ctrl && e.shiftKey && e.key === 'F') {
    e.preventDefault()
    toggleFullscreen()
    return
  }

  // Escape → 退出全屏
  if (e.key === 'Escape' && isFullscreen.value) {
    void closeFullscreen()
  }
}



useHead(computed(() => ({ title: problem.value?.title ? `${problem.value.title} — Leverage OJ` : '题目 — Leverage OJ' })))
</script>

<style scoped>
.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.problem-page {
  display: flex;
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid var(--lv-color-border, #dfe5ea);
  border-radius: var(--lv-radius-md, 8px);
  background: var(--lv-color-surface, #fff);
  color: var(--lv-color-text, #202a35);
  align-items: stretch;
  height: calc(100vh - 64px);
  overflow: hidden;
  gap: 0;
}

.problem-left {
  min-width: 280px;
  box-sizing: border-box;
  overflow-y: auto;
  padding: var(--lv-space-5, 20px);
}

.drag-divider {
  flex: 0 0 6px;
  background: var(--lv-color-border, #dfe5ea);
  cursor: col-resize;
  transition: background 0.15s;
  user-select: none;
  border-radius: 3px;
}
.drag-divider:hover,
.drag-divider:active,
.drag-divider:focus-visible {
  background: var(--lv-color-accent, #426b96);
}
.drag-divider:focus-visible {
  outline: 2px solid var(--lv-color-accent, #426b96);
  outline-offset: 2px;
}

.problem-right {
  min-width: 300px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: var(--lv-space-5, 20px);
}

.problem-right > .code-editor {
  flex-shrink: 0;
}

.problem-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.problem-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ac-flag {
  color: var(--lv-color-success, #26754d);
  font-size: 24px;
  font-weight: 700;
}

.problem-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.submit-area {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submission-result {
  margin-top: 4px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.result-row:last-child {
  margin-bottom: 0;
}

.result-label {
  color: var(--lv-color-text-secondary, #596875);
  font-size: 14px;
  min-width: 72px;
}

/* 快捷键提示 */
.shortcut-hint {
  font-size: 12px;
  color: var(--lv-color-text-secondary, #596875);
  text-align: center;
  user-select: none;
}

.shortcut-hint kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
  background: #f5f5f5;
  color: #555;
  box-shadow: 0 1px 0 #ccc;
}

/* 移动端响应式 */
@media (max-width: 767px) {
  .problem-page {
    height: auto;
    min-height: calc(100vh - 64px);
    overflow: visible;
    flex-direction: column;
    gap: 16px;
  }

  .problem-left {
    flex: none;
    width: 100%;
    overflow: visible;
  }

  .problem-right {
    flex: none;
    width: 100%;
    position: static; /* 移除 sticky，避免移动端滚动问题 */
    min-height: 200px;
    overflow: visible;
  }
}

/* 全屏模式 */
.fullscreen-editor {
  position: fixed;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100dvh;
  max-height: none;
  box-sizing: border-box;
  border: 0;
  padding: 0;
  margin: 0;
  background: var(--lv-color-surface, #fff);
  color: var(--lv-color-text, #202a35);
  display: flex;
  flex-direction: column;
}

.fullscreen-editor.fade-in-scale-up-transition-enter-from,
.fullscreen-editor.fade-in-scale-up-transition-leave-to {
  transform: none;
}
.fullscreen-editor.fade-in-scale-up-transition-enter-active,
.fullscreen-editor.fade-in-scale-up-transition-leave-active {
  transition: opacity 140ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .fullscreen-editor.fade-in-scale-up-transition-enter-active,
  .fullscreen-editor.fade-in-scale-up-transition-leave-active { transition: none; }
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--lv-color-canvas, #f3f5f7);
  border-bottom: 1px solid var(--lv-color-border, #dfe5ea);
}

.fullscreen-body {
  flex: 1;
  overflow: hidden;
}

.fullscreen-body :deep(.code-editor) {
  border: none;
  border-radius: 0;
}

.fullscreen-feedback {
  flex: none;
  max-height: 32vh;
  overflow: auto;
  padding-inline: 16px;
}

.fullscreen-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--lv-color-canvas, #f3f5f7);
  border-top: 1px solid var(--lv-color-border, #dfe5ea);
}

.fullscreen-footer .shortcut-hint {
  color: var(--lv-color-text-secondary, #596875);
}

.fullscreen-footer .shortcut-hint kbd {
  background: var(--lv-color-surface, #fff);
  border-color: var(--lv-color-border, #dfe5ea);
  color: var(--lv-color-text-secondary, #596875);
  box-shadow: 0 1px 0 var(--lv-color-border, #dfe5ea);
}
</style>
