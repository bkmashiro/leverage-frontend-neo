import type { PublicSample } from '~/types'

export type WorkspacePanel = 'input' | 'run' | 'formal'
export interface SampleWorkspaceState {
  panel: WorkspacePanel
  selectedSample: number | null
  stdin: string
  appliedSample: boolean
  initialized: boolean
  leftScrollTop: number
  rightScrollTop: number
  pageScrollTop: number
  splitWidth: number | null
}

// UI cache budgets, independent of the server's UTF-8 stdin limit.
export const WORKSPACE_CACHE_LIMIT = 24
export const WORKSPACE_CACHE_BYTES = 1024 * 1024
export const WORKSPACE_ENTRY_BYTES = 132 * 1024
const emptyWorkspace = (): SampleWorkspaceState => ({ panel: 'input', selectedSample: null, stdin: '', appliedSample: false, initialized: false, leftScrollTop: 0, rightScrollTop: 0, pageScrollTop: 0, splitWidth: null })

/** LRU with conservative UTF-16 text accounting; never truncate restorable input. */
export function createSampleWorkspaceCache() {
  const entries = new Map<string, { state: SampleWorkspaceState; bytes: number }>()
  let bytes = 0
  function remove(key: string) {
    bytes -= entries.get(key)?.bytes ?? 0
    entries.delete(key)
  }
  return {
    get size() { return entries.size },
    get bytes() { return bytes },
    get(key: string) {
      const entry = entries.get(key)
      if (!entry) return null
      entries.delete(key)
      entries.set(key, entry)
      return { ...entry.state }
    },
    set(key: string, state: SampleWorkspaceState) {
      remove(key)
      const size = 2 * (key.length + state.stdin.length) + 512
      if (size > WORKSPACE_ENTRY_BYTES) return false
      entries.set(key, { state: { ...state }, bytes: size })
      bytes += size
      while (entries.size > WORKSPACE_CACHE_LIMIT || bytes > WORKSPACE_CACHE_BYTES) remove(entries.keys().next().value!)
      return true
    },
    clear() { entries.clear(); bytes = 0 },
  }
}

const caches = new WeakMap<object, ReturnType<typeof createSampleWorkspaceCache>>()
function appWorkspaceCache() {
  const app = useNuxtApp()
  const auth = useAuthStore()
  let cache = caches.get(app)
  if (cache) return cache
  cache = createSampleWorkspaceCache()
  caches.set(app, cache)
  // Remove only the previous implementation's persisted custom inputs.
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('oj-workspace:')) sessionStorage.removeItem(key)
  } catch { /* storage may be disabled */ }
  const ownedCache = cache
  // App lifetime, not page lifetime: logout must clear data after leaving a problem.
  const scope = effectScope(true)
  scope.run(() => watch(() => auth.isLoggedIn ? auth.user?.id : null, () => ownedCache.clear(), { flush: 'sync' }))
  app.vueApp.onUnmount(() => { scope.stop(); ownedCache.clear(); caches.delete(app) })
  return cache
}

export function useSampleWorkspace(routePath: string, samples: Ref<PublicSample[] | undefined>) {
  const auth = useAuthStore()
  const cache = appWorkspaceCache()
  const owner = computed(() => auth.isLoggedIn ? auth.user?.id : null)
  const key = computed(() => owner.value == null ? null : `${owner.value}:${routePath}`)
  const state = reactive(emptyWorkspace())
  const restored = ref(false)
  const restorable = ref(true)
  function initializeSample() {
    // Restored empty input is still user workspace state, not a fresh visit.
    if (state.initialized || restored.value) return
    const index = samples.value?.findIndex(sample => typeof sample.input === 'string' && typeof sample.output === 'string') ?? -1
    if (index >= 0) {
      state.selectedSample = index
      state.stdin = samples.value![index]!.input
      state.appliedSample = true
      state.initialized = true
    }
  }
  function load() {
    const saved = key.value ? cache.get(key.value) : null
    restored.value = saved !== null
    Object.assign(state, saved ?? emptyWorkspace())
    initializeSample()
  }
  function save() { if (key.value) restorable.value = cache.set(key.value, state) }
  function useSample(index: number) {
    const sample = samples.value?.[index]
    if (!sample || typeof sample.input !== 'string' || typeof sample.output !== 'string') return
    Object.assign(state, { selectedSample: index, stdin: sample.input, appliedSample: true, initialized: true, panel: 'input' })
    save()
  }
  function updateStdin(value: string) {
    Object.assign(state, { stdin: value, selectedSample: null, appliedSample: false, initialized: true })
    save()
  }
  function updatePanel(value: WorkspacePanel) { state.panel = value; save() }
  function capturePosition(values: Partial<Pick<SampleWorkspaceState, 'leftScrollTop' | 'rightScrollTop' | 'pageScrollTop' | 'splitWidth'>>) {
    Object.assign(state, values)
    save()
  }
  watch(key, load, { immediate: true, flush: 'sync' })
  watch(samples, initializeSample, { deep: true })
  watch(state, save, { deep: true })
  onScopeDispose(save)
  return { state, restored, restorable, useSample, updateStdin, updatePanel, capturePosition }
}
