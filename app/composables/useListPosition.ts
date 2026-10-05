import type { Ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

/** Restore the list's own scroll container once its asynchronous rows are ready. */
export function useListPosition(root: Ref<HTMLElement | null>, ready: Ref<boolean>) {
  const router = useRouter()
  const auth = useAuthStore()
  const saved = useState<{ user: number | null; positions: Record<string, { top: number; left: number }> }>(
    'list-positions', () => ({ user: null, positions: {} }),
  )
  const pagePath = router.currentRoute.value.path
  let pending: string | null = router.currentRoute.value.fullPath
  let leaving = false
  let active = false

  function scroller(): HTMLElement | null {
    let element = root.value?.parentElement ?? null
    while (element) {
      if (/(auto|scroll)/.test(getComputedStyle(element).overflowY)) return element
      element = element.parentElement
    }
    return null
  }

  function remember(key: string) {
    const element = scroller()
    if (!element || saved.value.user !== auth.user?.id || pending) return
    const positions = saved.value.positions
    Reflect.deleteProperty(positions, key)
    positions[key] = { top: element.scrollTop, left: element.scrollLeft }
    // In-memory navigation convenience, bounded and cleared on account changes.
    const keys = Object.keys(positions)
    for (const key of keys.slice(0, Math.max(0, keys.length - 32))) Reflect.deleteProperty(positions, key)
  }

  async function restore() {
    if (!active || leaving || !pending || !ready.value) return
    const key = pending
    await nextTick()
    if (leaving || pending !== key || router.currentRoute.value.fullPath !== key || !ready.value) return
    const element = scroller()
    if (!element) return
    const position = saved.value.positions[key]
    pending = null
    element.scrollTo({ top: position?.top ?? 0, left: position?.left ?? 0, behavior: 'instant' })
  }

  // A person already scrolling while rows load takes precedence over restoration.
  function cancelRestore(event: Event) {
    const element = scroller()
    if (element && event.target instanceof Node && element.contains(event.target)) pending = null
  }

  watch(() => auth.user?.id ?? null, (user) => {
    if (saved.value.user !== user) saved.value = { user, positions: {} }
  }, { immediate: true, flush: 'sync' })
  watch(ready, () => { void restore() }, { flush: 'post' })
  onBeforeRouteLeave((_to, from) => {
    remember(from.fullPath)
    leaving = true
  })
  onBeforeRouteUpdate((to, from) => {
    if (to.path !== pagePath) return
    remember(from.fullPath)
    pending = to.fullPath
  })
  onMounted(() => {
    active = true
    document.addEventListener('wheel', cancelRestore, { passive: true })
    document.addEventListener('touchmove', cancelRestore, { passive: true })
    void restore()
  })
  onBeforeUnmount(() => {
    active = false
    document.removeEventListener('wheel', cancelRestore)
    document.removeEventListener('touchmove', cancelRestore)
  })
}
