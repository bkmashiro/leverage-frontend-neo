<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="problem">
    <AdminViewBanner />
  <div class="problem-page" ref="pageRef">
    <!-- 左侧：题目信息 -->
    <div class="problem-left" :style="{ flex: isMobile ? 'none' : `0 0 ${leftWidth}px` }">
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
    <div class="problem-right" :style="{ flex: isMobile ? 'none' : '1', minWidth: isMobile ? '0' : '300px' }">
      <div class="editor-header">
        <NSelect
          v-model:value="language"
          :options="languageOptions"
          style="width: 180px"
        />
        <NTooltip trigger="hover" placement="top">
          <template #trigger>
            <NButton text aria-label="全屏编辑代码" @click="toggleFullscreen">
              <NIcon size="18" :component="ExpandOutline" />
            </NButton>
          </template>
          {{ isFullscreen ? '退出全屏 (Ctrl+Shift+F)' : '全屏编辑 (Ctrl+Shift+F)' }}
        </NTooltip>
      </div>

      <!-- 全屏遮罩 -->
      <NModal v-model:show="isFullscreen" :mask-closable="false" :close-on-esc="true">
        <div v-if="isFullscreen" class="fullscreen-editor" role="dialog" aria-label="全屏代码编辑器" aria-modal="true">
          <div class="fullscreen-header">
            <NSelect
              v-model:value="language"
              :options="languageOptions"
              style="width: 180px"
            />
            <NButton text aria-label="退出全屏编辑" @click="toggleFullscreen">
              <NIcon size="20" :component="ContractOutline" />
            </NButton>
          </div>
          <div class="fullscreen-body">
            <CodeEditor
              v-model="code"
              :language="languageName"
              height="100%"
            />
          </div>
          <div class="fullscreen-footer">
            <span class="shortcut-hint">
              <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交 &nbsp;·&nbsp;
              <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> 退出全屏
            </span>
            <NButton
              type="primary"
              :loading="submitting"
              size="large"
              @click="handleSubmit"
            >
              提交代码
            </NButton>
          </div>
        </div>
      </NModal>

      <!-- 普通编辑器（全屏时隐藏） -->
      <template v-if="!isFullscreen">
        <CodeEditor
          v-model="code"
          :language="languageName"
          :height="isMobile ? '300px' : '450px'"
        />

        <div class="submit-area">
          <NButton
            type="primary"
            :loading="submitting"
            block
            size="large"
            @click="handleSubmit"
          >
            提交代码
          </NButton>
          <div class="shortcut-hint">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交 &nbsp;·&nbsp;
            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> 全屏
          </div>
        </div>

      </template>
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
import { LANGUAGE_OPTIONS, ojEditorLanguage } from '~/types'

const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const problemId = computed(() => Number(route.params.id))

const problemsApi = useProblemsApi()
const submissionsApi = useSubmissionsApi()
const usersApi = useUsersApi()
const authStore = useAuthStore()

const problem = ref<Problem | null>(null)
const loading = ref(true)

// 拖拽分隔条
const pageRef = ref<HTMLElement | null>(null)
const leftWidth = ref(0)
let dragging = false
let stopDragging: (() => void) | undefined

function setLeftWidth(value: number) {
  if (!pageRef.value || isMobile.value) return
  leftWidth.value = Math.min(Math.max(value, 280), pageRef.value.clientWidth - 300)
}

function initLeftWidth() {
  if (pageRef.value && !isMobile.value) {
    setLeftWidth(pageRef.value.clientWidth * 0.5)
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
const submitting = ref(false)
const isAcceptedByCurrentUser = ref(false)

// 全屏状态
const isFullscreen = ref(false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

const languageOptions = LANGUAGE_OPTIONS
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
    isFullscreen.value = false
  }
}

async function handleSubmit() {
  if (!code.value.trim()) return
  submitting.value = true

  try {
    const sub = await submissionsApi.create({
      problemId: problemId.value,
      language: language.value,
      code: code.value,
    })
    navigateTo(`/submissions/${sub.data.id}`)
  }
  catch (e) {
    console.error(e)
  }
  finally {
    submitting.value = false
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
  z-index: 9999;
  background: var(--lv-color-surface, #fff);
  color: var(--lv-color-text, #202a35);
  display: flex;
  flex-direction: column;
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
