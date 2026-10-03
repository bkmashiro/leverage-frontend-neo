import { watch } from 'vue'

export type TutorialTargetTab = 'bot' | 'judge' | 'renderer'
export interface TutorialDraftHandoff {
  ownerId: string | number
  gameId?: number
  targetTab: TutorialTargetTab
  code?: string
  lang?: string
  html?: string
}

/** Volatile, owner-bound, one-shot bridge from public lessons to the workbench. */
export function useTutorialDraftHandoff() {
  const pending = useState<TutorialDraftHandoff | null>('tutorial-draft-handoff', () => null)
  const auth = useAuthStore()

  watch(() => auth.user?.id, (ownerId) => {
    if (!ownerId || (pending.value && String(pending.value.ownerId) !== String(ownerId))) pending.value = null
  })

  function stage(value: Omit<TutorialDraftHandoff, 'ownerId'>): boolean {
    const ownerId = auth.user?.id
    if (!auth.isLoggedIn || ownerId == null) return false
    pending.value = { ...value, ownerId }
    return true
  }

  /** Consume exactly once. A mismatch is discarded, never delivered later. */
  function consume(ownerId: string | number | undefined): TutorialDraftHandoff | null {
    const value = pending.value
    pending.value = null
    if (ownerId == null || !value || String(value.ownerId) !== String(ownerId)) return null
    return value
  }

  function peek() { return pending.value }
  function clear() { pending.value = null }
  return { stage, consume, peek, clear }
}
