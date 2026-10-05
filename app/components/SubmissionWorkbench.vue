<template>
  <section ref="workbenchRoot" class="workbench" aria-label="评测工作区">
    <div class="workbench-toolbar" aria-label="提交操作">
      <NButton type="primary" :loading="running" :disabled="!code.trim() || running" @click="run">{{ running ? '运行中…' : '运行' }}</NButton>
      <NButton v-if="running" type="warning" @click="runPanel?.cancel()">取消运行</NButton>
      <NButton type="primary" secondary :loading="submitting" aria-label="提交代码" @click="submit">{{ submitting ? '提交中…' : '提交代码' }}</NButton>
      <NButton v-if="canRecover" secondary :loading="recovering" @click="showFormal(); $emit('recover')">找回上次提交</NButton>
    </div>
    <p v-if="!workspace.restorable.value" role="status">输入过大，本次输入不会在离开后恢复。</p>
    <div class="workbench-tabs" role="tablist" aria-label="工作区结果">
      <button id="workbench-tab-input" role="tab" :aria-selected="panel === 'input'" aria-controls="workbench-panel-run" :tabindex="panel === 'input' ? 0 : -1" @click="panel = 'input'" @keydown="navigateTabs">输入</button>
      <button id="workbench-tab-run" role="tab" :aria-selected="panel === 'run'" aria-controls="workbench-panel-run" :tabindex="panel === 'run' ? 0 : -1" @click="panel = 'run'" @keydown="navigateTabs">运行结果</button>
      <button id="workbench-tab-formal" role="tab" :aria-selected="panel === 'formal'" aria-controls="workbench-panel-formal" :tabindex="panel === 'formal' ? 0 : -1" @click="panel = 'formal'" @keydown="navigateTabs">正式评测</button>
    </div>
    <div ref="panelsRoot" class="workbench-panels" :style="{ minHeight: panelMinHeight ? `${panelMinHeight}px` : undefined }">
    <div v-show="panel !== 'formal'" id="workbench-panel-run" role="tabpanel" :aria-labelledby="panel === 'input' ? 'workbench-tab-input' : 'workbench-tab-run'">
      <OjRunPanel ref="runPanel" :code="code" :language="language" :samples="samples" :special-judge="specialJudge" :show-input="panel === 'input'" :workspace="workspace.state" @stdin-change="workspace.updateStdin" />
    </div>
    <div v-show="panel === 'formal'" id="workbench-panel-formal" role="tabpanel" aria-labelledby="workbench-tab-formal">
      <SubmissionFeedback :view="feedbackView" :submitting="submitting" :submit-error="submitError" :can-navigate-diagnostics="canNavigateDiagnostics" :diagnostics-stale="diagnosticsStale" @navigate-diagnostic="emit('navigate-diagnostic', $event)" @retry="$emit('retry')" @recover="$emit('recover')" />
    </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OjLanguage, PublicSample } from '~/types'
import type { SubmissionFeedbackView } from '~/utils/submission-feedback'
import type { WorkspacePanel } from '~/composables/useSampleWorkspace'

const props = defineProps<{
  code: string
  language: OjLanguage
  samples?: PublicSample[]
  specialJudge?: boolean
  feedbackView: SubmissionFeedbackView
  submitting?: boolean
  submitError?: string
  canRecover?: boolean
  recovering?: boolean
  canNavigateDiagnostics?: boolean
  diagnosticsStale?: boolean
}>()
const emit = defineEmits<{ submit: []; retry: []; recover: []; 'navigate-diagnostic': [location: { line: number; column: number }] }>()
const route = useRoute()
const router = useRouter()
const workspacePath = route.path
const workspace = useSampleWorkspace(workspacePath, computed(() => props.samples))
const panel = computed({ get: () => workspace.state.panel, set: (value: WorkspacePanel) => workspace.updatePanel(value) })
if (!workspace.restored.value && (props.feedbackView.id || props.canRecover || props.submitError)) panel.value = 'formal'
watch(() => props.feedbackView.id, (id, previous) => { if (id && id !== previous && !workspace.restored.value) showFormal() })
const runPanel = ref<{ run: () => Promise<void>; cancel: () => Promise<void>; busy: boolean } | null>(null)
function capturePosition(value: Parameters<typeof workspace.capturePosition>[0]) {
  // Nuxt's page-scoped route lags behind the committed router during navigation.
  // Ignore outgoing DOM clamping/scroll events before that old page unmounts.
  if (router.currentRoute.value.path === workspacePath) workspace.capturePosition(value)
}
defineExpose({ useSample: workspace.useSample, selectedSample: computed(() => workspace.state.selectedSample), state: workspace.state, capturePosition })
const workbenchRoot = ref<HTMLElement | null>(null)
const panelsRoot = ref<HTMLElement | null>(null)
const panelMinHeight = ref(0)
let pageScroller: HTMLElement | null = null
function savePageScroll() {
  if (pageScroller) capturePosition({ pageScrollTop: pageScroller.scrollTop })
}
onMounted(() => {
  pageScroller = workbenchRoot.value?.closest<HTMLElement>('.n-layout-content > .n-layout-scroll-container') ?? null
  // The page's async content is mounted now. Restore before accepting any new
  // user scroll; a deferred frame could overwrite an immediately scrolled page.
  if (pageScroller && router.currentRoute.value.path === workspacePath) pageScroller.scrollTop = workspace.state.pageScrollTop
  pageScroller?.addEventListener('scroll', savePageScroll, { passive: true })
})
const running = computed(() => Boolean(runPanel.value?.busy))
const anchorStyles: Array<{ element: HTMLElement; value: string }> = []
function disableScrollAnchoring() {
  // Keep the existing input footprint, but let long results grow/scroll naturally.
  if (panel.value === 'input') panelMinHeight.value = panelsRoot.value?.getBoundingClientRect().height ?? 0
  let element = workbenchRoot.value?.parentElement ?? null
  while (element) {
    if ((element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) && !anchorStyles.some(row => row.element === element)) {
      anchorStyles.push({ element, value: element.style.overflowAnchor })
      element.style.overflowAnchor = 'none'
    }
    element = element.parentElement
  }
}
onBeforeUnmount(() => {
  pageScroller?.removeEventListener('scroll', savePageScroll)
  for (const row of anchorStyles) row.element.style.overflowAnchor = row.value
})
function submit() {
  disableScrollAnchoring()
  showFormal()
  emit('submit')
}
watch(() => props.submitting, value => { if (value) showFormal() })
async function run() {
  disableScrollAnchoring()
  panel.value = 'run'
  await nextTick()
  await runPanel.value?.run()
}
function showFormal() { panel.value = 'formal' }
function navigateTabs(event: KeyboardEvent) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const tabs = Array.from((event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
  const index = tabs.indexOf(event.currentTarget as HTMLButtonElement)
  const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  const target = tabs[targetIndex]
  target?.focus()
  target?.click()
}
</script>

<style scoped>
.workbench { min-width: 0; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); padding: 10px; background: var(--lv-color-surface); overflow-anchor: none; }
.workbench-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.workbench-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--lv-color-border); margin-block: 10px; }
.workbench-tabs button { flex: none; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--lv-color-text-secondary); padding: 8px 10px; cursor: pointer; font: inherit; }
.workbench-tabs button[aria-selected="true"] { color: var(--lv-color-accent); border-bottom-color: var(--lv-color-accent); }
.workbench-tabs button:focus-visible { outline: 2px solid var(--lv-color-accent); outline-offset: -2px; }
.workbench [role="tabpanel"] { min-width: 0; }
</style>
