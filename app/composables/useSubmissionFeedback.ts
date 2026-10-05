import type { Submission } from '~/types'
import { isFinalStatus } from '~/types'
import { normalizeJudgeCases, responseStatus, submissionText, type SubmissionFeedbackView } from '~/utils/submission-feedback'

/** One submission observer, never a submission retry mechanism. */
export function useSubmissionFeedback(accept?: (submission: Submission) => boolean) {
  const api = useSubmissionsApi()
  const auth = useAuthStore()
  const submission = ref<Submission | null>(null)
  const state = reactive<SubmissionFeedbackView>({
    id: null, phase: 'idle', message: '', stalled: false, cases: [], total: 0, completed: 0, compileError: '',
  })
  const view = computed(() => ({ ...state }))
  let controller: AbortController | undefined
  let stallTimer: ReturnType<typeof setTimeout> | undefined

  function clearStall() {
    clearTimeout(stallTimer)
    stallTimer = undefined
    state.stalled = false
  }
  function markProgress() {
    clearStall()
    // UX threshold, not a judge deadline or evidence of failure.
    stallTimer = setTimeout(() => { state.stalled = true }, 30000)
  }
  function stop() {
    controller?.abort()
    controller = undefined
    clearStall()
  }
  function reset() {
    stop()
    submission.value = null
    Object.assign(state, { id: null, status: undefined, phase: 'idle', message: '', cases: [], total: 0, completed: 0, compileError: '' })
  }
  function pause(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, ms)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted) finish()
    })
  }
  function validStatus(status: number) {
    return isFinalStatus(status) || [9, 10, 11].includes(status)
  }
  async function start(id: number, initial?: Submission) {
    if (state.id === id) stop()
    else reset()
    state.message = ''
    state.id = id
    if (!Number.isSafeInteger(id) || id <= 0) {
      state.phase = 'stopped'
      state.message = '提交 ID 无效。'
      return
    }
    if (initial && (!accept || accept(initial))) {
      submission.value = initial
      state.status = initial.status
    }
    const active = new AbortController()
    controller = active
    const signal = active.signal
    let after = ''
    let readDetail = true
    let backoff = 500
    state.phase = 'loading'
    markProgress()
    try {
      while (!signal.aborted) {
        if (!navigator.onLine) {
          state.phase = 'offline'
          state.message = '网络已断开，联网后自动恢复。'
          await pause(8000, signal)
          continue
        }
        try {
          if (readDetail) {
            const { data } = await api.get(id, signal)
            if (signal.aborted) return
            if (data.id !== id || (accept && !accept(data))) {
              state.phase = 'stopped'
              state.message = '这条提交与当前账号或题目不匹配。'
              return
            }
            if (!validStatus(data.status)) throw new Error('Invalid submission status')
            submission.value = data
            state.status = data.status
            state.compileError = isFinalStatus(data.status) ? submissionText(data, 'compileErrorMsg') : ''
            if (isFinalStatus(data.status)) {
              state.cases = normalizeJudgeCases(data.misc?.judgeResult ?? data.judgeResult)
              state.total = state.cases.length
              state.completed = state.cases.length
              state.phase = 'complete'
              state.message = ''
              return
            }
            readDetail = false
          }
          state.phase = 'waiting'
          state.message = ''
          const requestedAt = Date.now()
          const { data } = await api.waitStatus(id, signal, after)
          if (signal.aborted) return
          if (!validStatus(data.status) || !/^[a-f0-9]{64}$/.test(data.version)) throw new Error('Invalid wait response')
          if (isFinalStatus(data.status)) {
            // Only settle after the full detail read succeeds. It may race a rejudge.
            state.phase = 'fetching'
            state.message = ''
            readDetail = true
            continue
          }
          const changed = after !== data.version
          after = data.version
          state.status = data.status
          if (submission.value) submission.value = { ...submission.value, status: data.status }
          state.cases = normalizeJudgeCases(data.progress?.testcases)
          state.total = data.progress?.total ?? 0
          state.completed = data.progress?.completed ?? 0
          if (changed) markProgress()
          backoff = 500
          // Protect against a degraded server returning unchanged snapshots immediately.
          if (!changed && Date.now() - requestedAt < 250) await pause(500, signal)
        }
        catch (error) {
          if (signal.aborted) return
          const status = responseStatus(error)
          if (status && status >= 400 && status < 500 && ![408, 429].includes(status)) {
            state.phase = 'stopped'
            state.message = status === 404 ? '提交记录不存在或已删除。'
              : status === 401 || status === 403 ? '无法读取这条提交，请确认登录状态和访问权限。' : '无法读取评测状态，请稍后手动重试。'
            return
          }
          state.phase = navigator.onLine ? 'reconnecting' : 'offline'
          state.message = navigator.onLine ? '连接中断，正在自动重连…' : '网络已断开，联网后自动恢复。'
          await pause(backoff, signal)
          backoff = Math.min(8000, backoff * 2)
        }
      }
    }
    finally {
      if (controller === active) {
        controller = undefined
        clearStall()
      }
    }
  }
  function retry() { if (state.id) void start(state.id) }
  function onOnline() { if (state.phase === 'offline' || state.phase === 'reconnecting') retry() }
  function onOffline() {
    if (!controller) return
    // Abort the outstanding HTTP request rather than waiting for its timeout.
    const id = state.id
    if (id) void start(id, submission.value ?? undefined)
  }
  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  })
  watch(() => auth.user?.id, (user, previous) => { if (user !== previous) reset() })
  onScopeDispose(() => {
    stop()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })
  return { submission, view, start, stop, reset, retry }
}
