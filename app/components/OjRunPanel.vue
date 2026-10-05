<template>
  <section class="run-panel" aria-label="运行输入与结果">
    <header class="run-header">
      <strong>运行输入与结果</strong>
      <NTooltip trigger="hover" placement="top">
        <template #trigger><button class="help-button" type="button" aria-label="输入与输出帮助">ⓘ</button></template>
        使用当前输入运行代码。完整评测请点击「提交代码」。
      </NTooltip>
    </header>
    <div v-show="showInput" class="input-region">
      <small class="input-source">{{ workspace.appliedSample && workspace.selectedSample != null ? `公开样例 ${workspace.selectedSample + 1}` : '自定义输入' }}</small>
      <NInput :value="stdin" type="textarea" :rows="5" placeholder="自定义标准输入（stdin）" :input-props="{ 'aria-label': '自定义标准输入' }" @update:value="onStdinUpdate" />
    </div>
    <NAlert v-if="error" type="error" style="margin-top: 12px">{{ error }}</NAlert>
    <NAlert v-if="networkNotice" type="info" style="margin-top: 12px">{{ networkNotice }}</NAlert>
    <section v-if="runInfo" data-testid="oj-run-result" class="run-output" :class="{ 'has-result': result }" aria-live="polite">
      <div v-if="activeRun" class="run-current">
        <NTag type="info">{{ statusText }}</NTag>
      </div>
      <div v-if="result" class="result-content" :class="{ 'previous-result': isPreviousResult }">
        <NText v-if="isPreviousResult" depth="3" class="previous-label">上次运行结果</NText>
        <NTag :type="tagType">{{ resultLabel }}</NTag>
        <abbr v-if="result.runtime === 'wasmtime'" class="runtime-mark" title="Wasmtime 计量单位，不等同于 CPU 指令数；新编译器不支持 bits/stdc++.h，未启用 exceptions。">WASM</abbr>
        <span v-if="result.timeMs != null">耗时 {{ Number(result.timeMs.toFixed(2)) }} ms</span>
        <span v-if="result.memoryBytes != null">内存 {{ formatBytes(result.memoryBytes) }}</span>
        <span v-if="result.runtime === 'wasmtime'" class="fuel-metric">燃料 {{ fuelText }}</span>
        <NAlert v-if="result.outputTruncated" type="warning" style="margin-top: 8px">输出超出 64 KiB，已截断。</NAlert>
        <NAlert v-if="comparison && !comparison.equal" type="warning" style="margin-top: 8px">
          样例输出不同：第 {{ comparison.line }} 行
          <SampleOutputDiff :diff="comparison" />
        </NAlert>
        <NAlert v-else-if="comparison?.equal" type="success" style="margin-top: 8px">样例输出一致</NAlert>
        <p v-if="result.status === 'OK' && (runSnapshot?.specialJudge ?? specialJudge)" class="run-note">SPJ 结果请提交评测。</p>
        <small v-if="result.stdout.length > 65536 || result.stderr.length > 65536">输出展示已截断。</small>
        <NText v-if="result.exitCode != null" depth="3">退出码：{{ result.exitCode }}</NText>
        <div v-if="result.stdout" class="output-block"><strong>标准输出</strong><pre>{{ result.stdout.slice(0, 65536) }}</pre></div>
        <div v-if="result.stderr" class="output-block"><strong>标准错误</strong><pre>{{ result.stderr.slice(0, 65536) }}</pre></div>
      </div>
      <NText v-else-if="restoring" depth="3">正在恢复运行状态…</NText>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { OjLanguage, PublicSample } from '~/types'
import type { OjRun, OjRunResult } from '~/composables/api/runs'
import { formatFuel, limitReasonLabel } from '~/utils/submission-feedback'
import { diffSampleOutput } from '~/utils/sample-output-diff'

const props = defineProps<{ code: string; language: OjLanguage; samples?: PublicSample[]; specialJudge?: boolean; showInput?: boolean; workspace: { stdin: string; selectedSample: number | null; appliedSample: boolean }; }>()
const emit = defineEmits<{ 'stdin-change': [value: string] }>()
const samples = computed(() => props.samples ?? [])
const selectedSample = computed(() => props.workspace.selectedSample)
const stdin = computed(() => props.workspace.stdin)
const runSnapshot = ref<{ code: string; stdin: string; expected: string | null; specialJudge: boolean } | null>(null)
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
const resultLabel = computed(() => result.value?.runtime === 'wasmtime' && result.value.limitReason
  ? limitReasonLabel(result.value.limitReason) || resultStatusLabels[result.value.status] || result.value.status
  : result.value ? resultStatusLabels[result.value.status] ?? result.value.status : '')
const fuelText = computed(() => result.value?.runtime === 'wasmtime'
  ? `${formatFuel(typeof result.value.fuelConsumed === 'number' && Number.isSafeInteger(result.value.fuelConsumed) && result.value.fuelConsumed >= 0 ? result.value.fuelConsumed : null)} / ${formatFuel(typeof result.value.fuelLimit === 'number' && Number.isSafeInteger(result.value.fuelLimit) && result.value.fuelLimit > 0 ? result.value.fuelLimit : null)}`
  : '')
const runStatusLabels: Record<string, string> = { queued: '排队中', running: '运行中', completed: '已完成', cancelled: '已取消' }
const statusText = computed(() => activeRun.value ? runStatusLabels[activeRun.value.status] : '')
const tagType = computed(() => result.value?.status === 'OK' ? 'success' : 'error')
const comparison = computed(() => {
  const expected = runSnapshot.value?.expected ?? null
  if (isPreviousResult.value || expected == null || result.value?.status !== 'OK' || result.value.outputTruncated) return null
  return diffSampleOutput(expected, result.value.stdout)
})
function formatBytes(value: number) { return value === 0 ? '0 B' : `${(value / 1024).toFixed(1)} KiB` }
function onStdinUpdate(value: string) { emit('stdin-change', value) }
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
  runSnapshot.value = null
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
    error.value = '登录状态已失效或无权访问。'
  }
}
function setOffline() {
  online.value = false
  if (!busy.value) return
  networkNotice.value = '网络不可用，联网后自动恢复。'
  waitController?.abort()
  waitController = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = undefined
  retryResolve?.()
  retryResolve = null
}
function setOnline() {
  online.value = true
  if (networkNotice.value.startsWith('网络不可用')) networkNotice.value = '网络已恢复，正在获取结果…'
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
        ? '等待时间较长，正在自动重连…'
        : '连接中断，正在自动重连…'
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
  runSnapshot.value = null
  longWaitTimer = setTimeout(() => {
    if (token === generation && busy.value) {
      longWaitExpired = true
      networkNotice.value = '等待时间较长，仍在获取结果…'
    }
  }, 30_000)
  if (!online.value) networkNotice.value = '网络不可用，联网后自动恢复。'
  void waitForRun(token, id, true)
}
async function run() {
  if (busy.value) return
  stopWaiting()
  const requestGeneration = ++generation
  const sourceSnapshot = props.code
  const stdinSnapshot = stdin.value
  const appliedSample = props.workspace.appliedSample && selectedSample.value != null
    ? samples.value[selectedSample.value]
    : undefined
  const nextSnapshot = {
    code: sourceSnapshot,
    stdin: stdinSnapshot,
    specialJudge: !!props.specialJudge,
    expected: !props.specialJudge && appliedSample?.input === stdinSnapshot ? appliedSample.output : null,
  }
  error.value = ''
  networkNotice.value = ''
  isPreviousResult.value = !!result.value
  longWaitExpired = false
  activeRun.value = null
  if (new TextEncoder().encode(sourceSnapshot).byteLength > 256 * 1024) { error.value = '源码超过 256 KiB 限制。'; return }
  if (new TextEncoder().encode(stdinSnapshot).byteLength > 64 * 1024) { error.value = '标准输入超过 64 KiB 限制。'; return }
  runSnapshot.value = nextSnapshot
  busy.value = true
  longWaitTimer = setTimeout(() => {
    if (requestGeneration === generation && busy.value) {
      longWaitExpired = true
      networkNotice.value = '等待时间较长，仍在获取结果…'
    }
  }, 30_000)
  try {
    writeController = new AbortController()
    const response = await runsApi.create({ language: props.language, code: sourceSnapshot, stdin: stdinSnapshot }, writeController.signal)
    if (requestGeneration !== generation) return
    writeController = null
    const created = response.data
    storeRun(created.id)
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
    error.value = apiErrorMessage(e) || '运行请求未确认，请勿立即重复运行。'
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
      error.value = '正在取消运行…'
      void waitForRun(token, id)
    }
  }
  catch (e: unknown) {
    if (token === generation) {
      writeController = null
      const status = apiErrorStatus(e)
      if (status === 401 || status === 403 || status === 404) { stopForError(status); return }
      networkNotice.value = '取消结果未确认，正在重新读取状态…'
      busy.value = true
      void waitForRun(token, id, true)
    }
  }
}
defineExpose({ run, cancel, busy })

watch([() => route.path, () => authStore.user?.id, () => authStore.isLoggedIn], (current, previous) => {
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
.runtime-mark { display: inline-block; color: var(--lv-color-text-secondary); font-size: 11px; text-decoration: underline dotted; text-underline-offset: 2px; cursor: help; }
.fuel-metric { font-variant-numeric: tabular-nums; }
.help-button { border: 0; background: transparent; color: var(--lv-color-text-secondary); cursor: help; font: inherit; }
.run-note { color: var(--lv-color-text-secondary); font-size: 13px; margin: 0; }
.run-output { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; min-width: 0; min-height: 72px; }
.run-current { min-height: 28px; }
.result-content { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.previous-result { opacity: .72; }
.previous-label { font-size: 12px; }
.output-block { width: 100%; min-width: 0; }
.output-block pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; padding: 10px; background: var(--lv-color-canvas); border-radius: 6px; }
.result-content > .n-alert { box-sizing: border-box; width: 100%; min-width: 0; }
.input-source { display: block; margin-bottom: 6px; color: var(--lv-color-text-secondary); }
</style>
