import type { Ref } from 'vue'
import type { OjLanguage } from '~/types'
import { responseStatus } from '~/utils/submission-feedback'

type Receipt = { requestId: string; fingerprint: string }
const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

/** A request receipt is persisted before sending; recovery never creates a submission. */
export function useProblemSubmission(options: {
  problemId: Ref<number>
  courseId?: Ref<number>
  contestId?: Ref<number>
  code: Ref<string>
  language: Ref<OjLanguage>
}) {
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const api = useSubmissionsApi()
  const submitting = ref(false)
  const recovering = ref(false)
  const submitError = ref('')
  const pending = ref<Receipt | null>(null)
  const canRecover = computed(() => !!pending.value)
  const storageKey = computed(() => auth.user?.id ? `oj-submit:${auth.user.id}:${route.path}` : null)
  const feedback = useSubmissionFeedback(row => row.userId === auth.user?.id
    && row.problemId === options.problemId.value
    && (row.courseId ?? null) === (options.courseId?.value ?? null)
    && (row.contestId ?? null) === (options.contestId?.value ?? null))
  let request: AbortController | undefined

  function forget(key = storageKey.value) {
    if (key) { try { sessionStorage.removeItem(key) } catch { /* unavailable storage */ } }
    pending.value = null
  }
  function readReceipt() {
    pending.value = null
    if (!storageKey.value) return
    try {
      const raw = sessionStorage.getItem(storageKey.value)
      if (!raw) return
      const receipt = JSON.parse(raw) as Partial<Receipt>
      if (typeof receipt.requestId !== 'string' || !requestIdPattern.test(receipt.requestId)
        || typeof receipt.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.fingerprint)) { forget(); return }
      pending.value = { requestId: receipt.requestId, fingerprint: receipt.fingerprint }
    } catch { forget() }
  }
  function cancel() {
    request?.abort()
    request = undefined
    submitting.value = false
    recovering.value = false
    submitError.value = ''
    feedback.reset()
  }
  async function adopt(id: number, active: AbortController) {
    if (active.signal.aborted) return
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid submission ID')
    void feedback.start(id)
    await router.replace({ query: { ...route.query, submission: String(id) } })
    if (!active.signal.aborted) { forget(); submitError.value = '' }
  }
  async function lookup(receipt: Receipt, active: AbortController): Promise<boolean> {
    try {
      const { data } = await api.findByRequest(receipt.requestId, active.signal)
      if (active.signal.aborted) return false
      if (data.problemId !== options.problemId.value
        || (data.courseId ?? null) !== (options.courseId?.value ?? null)
        || (data.contestId ?? null) !== (options.contestId?.value ?? null)) throw new Error('Request context mismatch')
      await adopt(data.id, active)
      return true
    } catch (error) {
      if (responseStatus(error) === 404) return false
      throw error
    }
  }
  async function recoverSubmission() {
    const receipt = pending.value
    if (!receipt || request || !auth.user?.id) return
    const active = new AbortController()
    request = active
    recovering.value = true
    try {
      if (!await lookup(receipt, active) && !active.signal.aborted) {
        submitError.value = '尚未找到提交记录，请稍后找回。'
      }
    } catch (error) {
      if (active.signal.aborted) return
      const status = responseStatus(error)
      submitError.value = status === 401 || status === 403 ? '暂时无法找回提交，请确认登录状态和访问权限。'
        : '暂时无法找回提交，请稍后重试。'
    } finally {
      if (request === active) { request = undefined; recovering.value = false }
    }
  }

  watch(() => [route.path, auth.user?.id] as const, ([, user], previous) => {
    if (previous?.[1] && previous[1] !== user) forget(`oj-submit:${previous[1]}:${previous[0]}`)
    cancel()
    readReceipt()
    if (pending.value) void recoverSubmission()
  }, { immediate: true, flush: 'sync' })
  watch(() => [route.path, route.query.submission, auth.user?.id] as const, () => {
    const raw = route.query.submission
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !auth.user?.id) {
      feedback.reset()
      return
    }
    const id = Number(raw)
    if (feedback.view.value.id !== id) void feedback.start(id)
  }, { immediate: true })
  const onOnline = () => { if (pending.value) void recoverSubmission() }
  onMounted(() => window.addEventListener('online', onOnline))
  onScopeDispose(() => { cancel(); window.removeEventListener('online', onOnline) })

  async function handleSubmit() {
    if (request || !options.code.value.trim()) return
    if (!auth.user?.id) { submitError.value = '请先登录。'; return }
    const active = new AbortController()
    request = active
    submitting.value = true
    submitError.value = ''
    let sent = false
    let receipt: Receipt | null = null
    try {
      const payload = {
        problemId: options.problemId.value, language: options.language.value, code: options.code.value,
        ...(options.courseId ? { courseId: options.courseId.value } : {}),
        ...(options.contestId ? { contestId: options.contestId.value } : {}),
      }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
      if (active.signal.aborted) return
      const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      if (pending.value && await lookup(pending.value, active)) return
      if (active.signal.aborted) return
      receipt = pending.value?.fingerprint === fingerprint ? pending.value : { requestId: crypto.randomUUID(), fingerprint }
      // Fail before sending when the browser cannot retain the recovery handle.
      sessionStorage.setItem(storageKey.value!, JSON.stringify(receipt))
      pending.value = receipt
      sent = true
      const { data } = await api.create({ ...payload, requestId: receipt.requestId }, active.signal)
      await adopt(data.id, active)
    } catch (error) {
      if (active.signal.aborted) return
      const status = responseStatus(error)
      if (!sent) {
        submitError.value = pending.value ? '请先找回上次提交，当前代码未发送。'
          : '无法保存提交信息，请检查浏览器存储和 HTTPS 连接。代码未发送。'
      } else if (status === 409) {
        submitError.value = '提交内容不一致，请先找回上次提交。'
      } else if (status && status >= 400 && status < 500 && status !== 408) {
        forget()
        submitError.value = status === 429 ? '提交过于频繁，请稍后重试。'
          : status === 401 || status === 403 ? '当前无法提交，请确认登录状态和题目权限。'
            : '提交未被接受，请检查代码、语言和题目状态。'
      } else {
        submitError.value = '提交尚未确认，正在找回…'
        try {
          if (receipt && !await lookup(receipt, active) && !active.signal.aborted) {
            submitError.value = '尚未找到提交，请先查看提交记录或稍后找回。'
          }
        } catch {
          if (!active.signal.aborted) submitError.value = '提交尚未确认，请先查看提交记录或找回上次提交。'
        }
      }
    } finally {
      if (request === active) { request = undefined; submitting.value = false }
    }
  }
  return { submitting, submitError, canRecover, recovering, recoverSubmission, feedbackView: feedback.view, retryFeedback: feedback.retry, handleSubmit }
}
