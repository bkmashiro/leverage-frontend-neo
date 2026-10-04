<template>
  <section class="run-panel" aria-label="运行输入与结果">
    <header class="run-header">
      <strong>运行输入与结果</strong>
      <NTooltip trigger="hover" placement="top">
        <template #trigger><button class="help-button" type="button" aria-label="输入与输出帮助">ⓘ</button></template>
        仅执行当前源码和输入，不读取评测隐藏数据，也不会创建正式提交。
      </NTooltip>
    </header>
    <NSelect v-if="samples.length" v-model:value="selectedSample" data-testid="public-sample-select" :options="sampleOptions" clearable placeholder="选择公开样例" style="margin-bottom: 10px" @update:value="applySample" />
    <div v-show="showInput" class="input-region">
      <NText v-if="!samples.length" depth="3" style="display:block;margin-bottom:8px">可在下方输入自定义 stdin。</NText>
      <NInput v-model:value="stdin" type="textarea" :rows="5" placeholder="自定义标准输入（stdin）" aria-label="自定义标准输入" @update:value="onStdinUpdate" />
    </div>
    <NAlert v-if="error" type="error" style="margin-top: 12px">{{ error }}</NAlert>
    <NAlert v-if="networkNotice" type="info" style="margin-top: 12px">{{ networkNotice }}</NAlert>
    <section v-if="runInfo" data-testid="oj-run-result" class="run-output" :class="{ 'has-result': result }" aria-live="polite">
      <div v-if="activeRun" class="run-current">
        <NTag type="info">{{ statusText }}</NTag>
      </div>
      <div v-if="result" class="result-content" :class="{ 'previous-result': isPreviousResult }">
        <NText v-if="isPreviousResult" depth="3" class="previous-label">上次运行结果</NText>
        <NTag :type="tagType">{{ resultStatusLabels[result.status] ?? result.status }}</NTag>
        <span v-if="result.timeMs != null">耗时 {{ Number(result.timeMs.toFixed(2)) }} ms</span>
        <span v-if="result.memoryBytes != null">内存 {{ formatBytes(result.memoryBytes) }}</span>
        <NAlert v-if="result.outputTruncated" type="warning" style="margin-top: 8px">输出超出 64 KiB，已截断。</NAlert>
        <NAlert v-if="comparison && !comparison.equal" type="warning" style="margin-top: 8px">
          公开样例首次差异：第 {{ comparison.line }} 行；仅供对照，不是正式评测结果。
          <div class="diff-grid">
            <div><strong>期望</strong><pre>{{ showWhitespace ? visibleWhitespace(comparison.expectedContext) : comparison.expectedContext }}</pre></div>
            <div><strong>实际</strong><pre>{{ showWhitespace ? visibleWhitespace(comparison.actualContext) : comparison.actualContext }}</pre></div>
          </div>
          <small v-if="comparison.truncated">对照上下文已截断。</small>
          <label class="whitespace-toggle"><input v-model="showWhitespace" type="checkbox">显示空白字符</label>
        </NAlert>
        <NAlert v-else-if="comparison?.equal" type="success" style="margin-top: 8px">公开样例输出一致。仅为客户端对照，不是正式评测结果。</NAlert>
        <p v-if="result.status === 'OK' && !comparison" class="run-note">执行完成；自定义输入或特殊判题题目不做答案判定。</p>
        <NText v-if="result.exitCode != null" depth="3">退出码：{{ result.exitCode }}</NText>
        <div v-if="result.stdout" class="output-block"><strong>标准输出</strong><pre>{{ result.stdout }}</pre></div>
        <div v-if="result.stderr" class="output-block"><strong>标准错误</strong><pre>{{ result.stderr }}</pre></div>
      </div>
      <NText v-else-if="restoring" depth="3">正在恢复运行状态…</NText>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { OjLanguage, PublicSample } from '~/types'
import type { OjRun, OjRunResult } from '~/composables/api/runs'
import { diffSampleOutput } from '~/utils/sample-output-diff'

const props = defineProps<{ code: string; language: OjLanguage; samples?: PublicSample[]; specialJudge?: boolean; showInput?: boolean }>()
const samples = computed(() => (props.samples ?? []).filter(s => typeof s.input === 'string' && typeof s.output === 'string'))
const selectedSample = ref<number | null>(null)
const showWhitespace = ref(false)
const expectedOutput = ref<string | null>(null)
const stdin = ref('')
const sampleOptions = computed(() => samples.value.map((_, i) => ({ label: `公开样例 ${i + 1}`, value: i })))
const runsApi = useRunsApi()
const authStore = useAuthStore()
const route = useRoute()
const activeRun = ref<OjRun | null>(null)
const result = ref<OjRunResult | null>(null)
const error = ref('')
const networkNotice = ref('')
const busy = ref(false)
const restoring = ref(false)
const isPreviousResult = ref(false)
const online = ref(true)
let retryTimer: ReturnType<typeof setTimeout> | undefined
let waitController: AbortController | null = null
let writeController: AbortController | null = null
let restoringId: string | null = null
let generation = 0
let retryResolve: (() => void) | null = null
let longWaitTimer: ReturnType<typeof setTimeout> | undefined
let longWaitExpired = false
let ownedSessionKey: string | null = null
const sessionKey = computed(() => `oj-run:${authStore.user?.id ?? 'anonymous'}:${encodeURIComponent(route.path)}`)
const runInfo = computed(() => !!activeRun.value || !!result.value || restoring.value)
const resultStatusLabels: Record<string, string> = { OK: '执行成功', CE: '编译错误', RE: '运行错误', TLE: '超时', MLE: '内存超限', OLE: '输出超限', SE: '系统错误', CANCELLED: '已取消' }
const runStatusLabels: Record<string, string> = { queued: '排队中', running: '运行中', completed: '已完成', cancelled: '已取消' }
const statusText = computed(() => activeRun.value ? runStatusLabels[activeRun.value.status] : '')
const tagType = computed(() => result.value?.status === 'OK' ? 'success' : 'error')
const comparison = computed(() => {
  if (isPreviousResult.value || props.specialJudge || selectedSample.value == null || expectedOutput.value == null || result.value?.status !== 'OK' || result.value.outputTruncated) return null
  return diffSampleOutput(expectedOutput.value, result.value.stdout)
})
function visibleWhitespace(value: string) {
  return value.replace(/ /g, '·').replace(/\t/g, '⇥').replace(/\n/g, '↵') || '(空)'
}
function formatBytes(value: number) { return value === 0 ? '0 B' : `${(value / 1024).toFixed(1)} KiB` }
function applySample(index: number | null) { if (index != null) stdin.value = samples.value[index]?.input ?? '' }
function onStdinUpdate(value: string) {
  if (selectedSample.value != null && value !== samples.value[selectedSample.value]?.input) selectedSample.value = null
}
function apiErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined
  const response = error.response
  return response && typeof response === 'object' && 'status' in response && typeof response.status === 'number' ? response.status : undefined
}
function apiErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined
  const response = error.response
  if (!response || typeof response !== 'object' || !('data' in response)) return undefined
  const data = response.data
  return data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : undefined
}
function clearStoredRun(key = ownedSessionKey ?? sessionKey.value) {
  try { sessionStorage.removeItem(key) } catch { /* unavailable storage */ }
  if (ownedSessionKey === key) ownedSessionKey = null
}
function storeRun(id: string) {
  ownedSessionKey = sessionKey.value
  try { sessionStorage.setItem(ownedSessionKey, id) } catch { /* unavailable storage */ }
}
function stopWaiting() {
  writeController?.abort()
  writeController = null
  waitController?.abort()
  waitController = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = undefined
  retryResolve?.()
  retryResolve = null
  if (longWaitTimer) clearTimeout(longWaitTimer)
  longWaitTimer = undefined
}
function resetForScopeChange() {
  generation++
  stopWaiting()
  activeRun.value = null
  result.value = null
  error.value = ''
  networkNotice.value = ''
  busy.value = false
  restoring.value = false
  restoringId = null
  isPreviousResult.value = false
  expectedOutput.value = null
  longWaitExpired = false
}
function finish(run: OjRun) {
  activeRun.value = null
  result.value = run.result ?? null
  busy.value = false
  restoring.value = false
  isPreviousResult.value = false
  restoringId = null
  networkNotice.value = ''
  error.value = ''
  storeRun(run.id)
  stopWaiting()
}
function stopForError(status: number) {
  busy.value = false
  restoring.value = false
  restoringId = null
  networkNotice.value = ''
  activeRun.value = null
  stopWaiting()
  if (status === 404) {
    clearStoredRun()
    error.value = '运行记录已过期或不可访问。'
  }
  else {
    clearStoredRun()
    error.value = '登录状态已失效或无权访问，已停止恢复运行。'
  }
}
function setOffline() {
  online.value = false
  if (!busy.value) return
  networkNotice.value = '网络不可用，恢复联网后会继续等待；不会重新提交运行。'
  waitController?.abort()
  waitController = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = undefined
  retryResolve?.()
  retryResolve = null
}
function setOnline() {
  online.value = true
  if (networkNotice.value.startsWith('网络不可用')) networkNotice.value = '网络已恢复，正在继续等待运行结果…'
  const id = activeRun.value?.id ?? restoringId
  if (id && busy.value && !waitController) void waitForRun(generation, id, !!restoringId)
}
async function waitForRun(token: number, id: string, readFirst = false) {
  if (token !== generation || waitController || !online.value) return
  const controller = new AbortController()
  waitController = controller
  let backoff = 500
  while (!controller.signal.aborted && token === generation && online.value) {
    try {
      const requestedAt = Date.now()
      const response = readFirst ? await runsApi.get(id, controller.signal) : await runsApi.wait(id, controller.signal)
      if (controller.signal.aborted || token !== generation) return
      const current = response.data
      if (current.status === 'completed' || current.status === 'cancelled') { finish(current); return }
      activeRun.value = current
      restoring.value = false
      restoringId = null
      const wasRead = readFirst
      readFirst = false
      backoff = 500
      if (!longWaitExpired) networkNotice.value = ''
      if (!wasRead && Date.now() - requestedAt < 250) await new Promise<void>((resolve) => {
        retryResolve = resolve
        retryTimer = setTimeout(() => { retryTimer = undefined; retryResolve = null; resolve() }, 500)
      })
    }
    catch (e: unknown) {
      if (controller.signal.aborted || token !== generation) return
      const status = apiErrorStatus(e)
      if (status === 401 || status === 403 || status === 404) { stopForError(status); return }
      networkNotice.value = longWaitExpired
        ? '等待时间较长，尚未收到最终结果；连接异常后正在自动重连。'
        : '暂时无法连接运行服务，正在自动重连；不会重新提交运行。'
      await new Promise<void>((resolve) => {
        retryResolve = resolve
        retryTimer = setTimeout(() => { retryTimer = undefined; retryResolve = null; resolve() }, backoff)
      })
      backoff = Math.min(8000, backoff * 2)
    }
  }
  if (waitController === controller) waitController = null
  if (token === generation && activeRun.value && online.value && busy.value) void waitForRun(token, id)
}
function resumeRun() {
  if (!authStore.isLoggedIn || typeof window === 'undefined') return
  let id: string | null = null
  try { id = sessionStorage.getItem(sessionKey.value) } catch { return }
  if (!id) return
  ownedSessionKey = sessionKey.value
  const token = ++generation
  longWaitExpired = false
  restoring.value = true
  busy.value = true
  error.value = ''
  networkNotice.value = ''
  restoringId = id
  expectedOutput.value = null
  longWaitTimer = setTimeout(() => {
    if (token === generation && busy.value) {
      longWaitExpired = true
      networkNotice.value = '等待时间较长，尚未收到最终结果；会继续确认，无需重复运行。'
    }
  }, 30_000)
  if (!online.value) networkNotice.value = '网络不可用，恢复联网后会继续等待；不会重新提交运行。'
  void waitForRun(token, id, true)
}
async function run() {
  if (busy.value) return
  stopWaiting()
  const requestGeneration = ++generation
  error.value = ''
  networkNotice.value = ''
  isPreviousResult.value = !!result.value
  longWaitExpired = false
  activeRun.value = null
  const nextExpectedOutput = !props.specialJudge && selectedSample.value != null ? (samples.value[selectedSample.value]?.output ?? null) : null
  if (new TextEncoder().encode(props.code).byteLength > 256 * 1024) { error.value = '源码超过 256 KiB 限制。'; return }
  if (new TextEncoder().encode(stdin.value).byteLength > 64 * 1024) { error.value = '标准输入超过 64 KiB 限制。'; return }
  busy.value = true
  longWaitTimer = setTimeout(() => {
    if (requestGeneration === generation && busy.value) {
      longWaitExpired = true
      networkNotice.value = '等待时间较长，尚未收到最终结果；会继续确认，无需重复运行。'
    }
  }, 30_000)
  try {
    writeController = new AbortController()
    const response = await runsApi.create({ language: props.language, code: props.code, stdin: stdin.value }, writeController.signal)
    if (requestGeneration !== generation) return
    writeController = null
    const created = response.data
    storeRun(created.id)
    expectedOutput.value = nextExpectedOutput
    activeRun.value = created
    if (created.status === 'completed' || created.status === 'cancelled') finish(created)
    else void waitForRun(requestGeneration, created.id)
  }
  catch (e: unknown) {
    if (requestGeneration !== generation) return
    busy.value = false
    if (longWaitTimer) clearTimeout(longWaitTimer)
    longWaitTimer = undefined
    networkNotice.value = ''
    writeController = null
    error.value = apiErrorMessage(e) || '未能确认运行请求结果，请勿立即重复运行。代码和输入仍保留。'
  }
}
async function cancel() {
  if (!activeRun.value || !busy.value) return
  const id = activeRun.value.id
  const token = ++generation
  stopWaiting()
  try {
    writeController = new AbortController()
    const response = await runsApi.cancel(id, writeController.signal)
    if (token !== generation) return
    writeController = null
    if (response.data.status === 'completed' || response.data.status === 'cancelled') finish(response.data)
    else {
      activeRun.value = response.data
      busy.value = true
      error.value = '取消请求已提交，等待运行容器清理；清理期间重试可能暂时收到 429。'
      void waitForRun(token, id)
    }
  }
  catch (e: unknown) {
    if (token === generation) {
      writeController = null
      const status = apiErrorStatus(e)
      if (status === 401 || status === 403 || status === 404) { stopForError(status); return }
      networkNotice.value = '暂时无法确认取消结果，正在重新读取运行状态。'
      busy.value = true
      void waitForRun(token, id, true)
    }
  }
}
defineExpose({ run, cancel, busy })

watch(() => [route.path, authStore.user?.id, authStore.isLoggedIn] as const, (current, previous) => {
  if (current[1] !== previous[1] || !current[2]) clearStoredRun()
  resetForScopeChange()
  resumeRun()
})
onMounted(() => {
  online.value = navigator.onLine
  window.addEventListener('offline', setOffline)
  window.addEventListener('online', setOnline)
  resumeRun()
})
onBeforeUnmount(() => {
  generation++
  stopWaiting()
  window.removeEventListener('offline', setOffline)
  window.removeEventListener('online', setOnline)
})
</script>

<style scoped>
.run-panel { min-width: 0; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); padding: 12px; background: var(--lv-color-surface); }
.run-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.help-button { border: 0; background: transparent; color: var(--lv-color-text-secondary); cursor: help; font: inherit; }
.run-note { color: var(--lv-color-text-secondary); font-size: 13px; margin: 0; }
.run-output { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; min-width: 0; min-height: 72px; }
.run-current { min-height: 28px; }
.result-content { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.previous-result { opacity: .72; }
.previous-label { font-size: 12px; }
.output-block { width: 100%; min-width: 0; }
.output-block pre, .diff-grid pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; padding: 10px; background: var(--lv-color-canvas); border-radius: 6px; }
.whitespace-toggle { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.diff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.diff-grid > div { min-width: 0; }
.diff-grid pre { max-height: 160px; margin: 4px 0; }
@media (max-width: 600px) { .diff-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
