<template>
  <main class="learn-page">
    <div class="learn-layout">
      <aside class="chapter-navigation" aria-label="学习路径与章节">
        <h2>学习路径</h2>
        <div class="track-paths">
          <button v-for="path in TUTORIAL_TRACKS" :key="path.id" type="button" :aria-label="path.title" :aria-pressed="track === path.id" @click="setTrack(path.id)">
            {{ path.shortTitle }}
            <span>{{ path.chapters.length }} 章 · {{ path.level }}</span>
          </button>
        </div>
        <details class="chapter-directory" :open="!isMobile">
          <summary>章节目录 · {{ step }}/{{ currentPath.chapters.length }}</summary>
          <ol>
            <li v-for="(chapter, index) in currentPath.chapters" :key="chapter">
              <NuxtLink :to="{ path: '/compete/learn', query: { ...route.query, track, step: String(index + 1) } }" :aria-current="step === index + 1 ? 'step' : undefined">
                <span class="chapter-number">{{ index + 1 }}</span><span>{{ chapter }}</span>
              </NuxtLink>
            </li>
          </ol>
        </details>
      </aside>
      <section class="reading-surface" aria-label="教程内容">
        <div v-if="loading" class="state" role="status">正在加载示例练习…</div>
        <div v-else-if="loadError" class="state error" role="alert">
          {{ loadError }} <NButton text type="primary" @click="loadGames">重试</NButton>
        </div>
        <div v-else-if="!officialGameId" class="state" role="status">官方示例练习环境暂不可用，教程内容仍可阅读。</div>
        <WikiContent
          :games="games"
          :default-game-id="officialGameId"
          :track="track"
          :step="step - 1"
          public-read-only
          :show-track-selector="false"
          @update:track="setTrack"
          @update:step="setStep($event + 1)"
          @go-playground="handoff($event)"
          @go-renderer="handoff({ ...$event, tab: 'renderer' })"
        />
        <div v-if="track === 'bot' && step === 1" class="official-examples">
          <OfficialExamples :busy="startingExample" @practice="practiceExample" />
        </div>
      </section>
    </div>
    <aside class="handoff-note">
      <strong>开始练习</strong>
      <span>阅读无需登录。准备好代码后，登录并打开工作台测试；保存或参赛时会检查相应权限。</span>
      <NButton v-if="!authStore.isLoggedIn" secondary @click="navigateTo('/login')">登录后打开工作台</NButton>
    </aside>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import WikiContent from '~/components/compete/WikiContent.vue'
import OfficialExamples from '~/components/compete/OfficialExamples.vue'
import type { OfficialExample } from '~/types/official-example'
import type { Game } from '~/types/compete'
import { botzoneLanguage } from '~/utils/botzone-language'
import { TUTORIAL_TRACKS, type TutorialTrack } from '~/utils/tutorial-tracks'

definePageMeta({ layout: 'default' })

type Track = TutorialTrack
const TRACKS = TUTORIAL_TRACKS.map(path => path.id)
const STEPS = Object.fromEntries(TUTORIAL_TRACKS.map(path => [path.id, path.chapters.length])) as Record<Track, number>
const route = useRoute()
const router = useRouter()
const api = useCompeteApi()
const authStore = useAuthStore()
const handoffState = useTutorialDraftHandoff()
const message = useMessage()
const games = ref<Game[]>([])
const loading = ref(true)
const loadError = ref('')
const startingExample = ref(false)
const officialGameId = ref<number | null>(null)
const track = computed<Track>(() => TRACKS.includes(String(route.query.track) as Track) ? String(route.query.track) as Track : 'bot')
const currentPath = computed(() => TUTORIAL_TRACKS.find(path => path.id === track.value) ?? TUTORIAL_TRACKS[0])
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 900)
const step = computed(() => {
  const n = Number(route.query.step)
  return Number.isInteger(n) && n >= 1 && n <= STEPS[track.value] ? n : 1
})

async function loadGames() {
  loading.value = true
  loadError.value = ''
  try {
    const [gamesResult, examplesResult] = await Promise.allSettled([
      api.listGames({ page: 1, perPage: 100 }),
      api.listExamples(),
    ])
    if (gamesResult.status === 'rejected') throw gamesResult.reason
    const data = gamesResult.value.data as { items?: Game[] } | Game[]
    games.value = Array.isArray(data) ? data : data.items ?? []
    const example = examplesResult.status === 'fulfilled'
      ? examplesResult.value.data.items.find(item => item.key === 'closest-v1')
      : undefined
    officialGameId.value = example?.status === 'ready' ? example.gameId ?? null : null
  } catch {
    loadError.value = '游戏列表加载失败。教程内容可以继续阅读，练习环境暂不可用。'
  } finally { loading.value = false }
}

async function practiceExample(example: OfficialExample) {
  if (startingExample.value || example.status !== 'ready' || !example.gameId) return
  const options = { tab: 'bot', gameId: example.gameId, code: example.starter.code, lang: example.starter.language }
  if (!authStore.isLoggedIn) { await handoff(options); return }
  const owner = authStore.user?.id
  startingExample.value = true
  try {
    const response = await api.getGame(example.gameId)
    if (owner !== authStore.user?.id || !authStore.isLoggedIn) return
    if (response.data.disabled || response.data.id !== example.gameId) {
      message.warning('示例游戏暂不可用，请刷新示例状态。')
      return
    }
    games.value = [...games.value.filter(game => game.id !== response.data.id), response.data]
    await handoff(options)
  } catch {
    message.error('示例游戏加载失败，请刷新示例状态后重试。')
  } finally { startingExample.value = false }
}

function navigateChapter(next: Partial<{ track: Track; step: number }>) {
  const nextTrack = next.track ?? track.value
  const nextStep = next.step ?? step.value
  void router.push({ path: '/compete/learn', query: {
    ...route.query,
    track: nextTrack,
    step: String(Math.min(STEPS[nextTrack], Math.max(1, nextStep))),
  } })
}
function setTrack(value: string) {
  if (TRACKS.includes(value as Track)) navigateChapter({ track: value as Track, step: 1 })
}
function setStep(value: number) { navigateChapter({ step: value }) }

async function handoff(opts: { tab?: string; code?: string; lang?: string; html?: string; gameId?: number }) {
  const targetTab = opts.tab === 'judge' ? 'judge' : opts.tab === 'renderer' || opts.html !== undefined ? 'renderer' : 'bot'
  const targetGameId = opts.gameId ?? officialGameId.value
  if (!authStore.isLoggedIn || authStore.user?.id == null) {
    message.info('请先登录；为保护代码，登录前不会暂存教程草稿。')
    await navigateTo('/login')
    return
  }
  if (!targetGameId) {
    message.warning('官方示例练习环境暂不可用，请稍后重试。')
    return
  }
  let targetGame = games.value.find(game => Number(game.id) === targetGameId)
  if (!targetGame) {
    try {
      const response = await api.getGame(targetGameId)
      if (Number(response.data.id) !== targetGameId || response.data.disabled) throw new Error('Unavailable official example')
      targetGame = response.data
      games.value = [...games.value, targetGame]
    } catch {
      message.warning('官方示例练习环境暂不可用，请刷新状态后重试。')
      return
    }
  }
  if (targetGame.disabled) {
    message.warning('官方示例练习环境暂不可用，请刷新状态后重试。')
    return
  }
  const accepted = handoffState.stage({
    targetTab,
    gameId: targetGameId,
    ...(targetTab === 'renderer'
      ? { html: opts.html }
      : { code: opts.code, lang: opts.lang ? botzoneLanguage(opts.lang) : undefined }),
  })
  if (!accepted) return
  await navigateTo({ path: '/compete/playground', query: { tab: targetTab, gameId: targetGameId } })
}

watch([track, step], ([t, s]) => {
  if (router.currentRoute.value.path !== '/compete/learn') return
  const canonical = route.query.track === t && String(route.query.step ?? '') === String(s)
  if (!canonical) void router.replace({ path: '/compete/learn', query: { ...route.query, track: t, step: String(s) } })
}, { immediate: true })
onMounted(loadGames)
</script>

<style scoped>
.learn-page { display: flex; flex-direction: column; width: min(100%, var(--lv-width-workspace)); height: calc(100dvh - 112px); min-height: 320px; margin: 0 auto; color: var(--lv-color-text); font-family: var(--lv-font-ui); }
.learn-layout { display: grid; flex: 1; min-height: 0; grid-template-columns: 220px minmax(0, 1fr); gap: var(--lv-space-5); }
.chapter-navigation { min-width: 0; min-height: 0; overflow: auto; padding-right: var(--lv-space-2); }
.chapter-navigation h2 { margin: 0 0 var(--lv-space-3); font-size: var(--lv-size-body); }
.track-paths { display: grid; gap: var(--lv-space-2); }
.track-paths button { display: flex; flex-direction: column; gap: var(--lv-space-1); padding: var(--lv-space-3); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); color: var(--lv-color-text); font: inherit; font-size: var(--lv-size-meta); font-weight: 600; text-align: left; cursor: pointer; }
.track-paths button[aria-pressed=true] { border-color: var(--lv-color-accent); background: var(--lv-color-accent-soft); color: var(--lv-color-accent); }
.track-paths button span { color: var(--lv-color-text-secondary); font-size: var(--lv-size-meta); font-weight: 400; }
.chapter-directory { margin-top: var(--lv-space-4); }
.chapter-directory summary { font-size: var(--lv-size-meta); font-weight: 600; cursor: pointer; }
.chapter-directory ol { display: grid; gap: var(--lv-space-1); list-style: none; margin: var(--lv-space-2) 0 0; padding: 0; }
.chapter-directory a { display: flex; gap: var(--lv-space-2); padding: var(--lv-space-2); border-radius: var(--lv-radius-sm); color: var(--lv-color-text-secondary); font-size: var(--lv-size-meta); line-height: 1.5; text-decoration: none; }
.chapter-directory a[aria-current=step] { color: var(--lv-color-accent); background: var(--lv-color-accent-soft); font-weight: 600; }
.chapter-number { flex: 0 0 16px; font-variant-numeric: tabular-nums; }
.reading-surface { min-width: 0; min-height: 0; overflow: auto; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-lg); padding: var(--lv-space-5); background: var(--lv-color-surface); scroll-behavior: smooth; }
.reading-surface :deep(.step-intro h3) { margin-top: 0; font-size: var(--lv-size-section); line-height: 1.35; }
.reading-surface :deep(.step-intro p) { color: var(--lv-color-text-secondary); font-size: var(--lv-size-body); line-height: 1.7; }
.official-examples { margin-top: var(--lv-space-4); border-top: 1px solid var(--lv-color-border); padding-top: var(--lv-space-3); }
.official-examples summary { color: var(--lv-color-accent); font-size: var(--lv-size-meta); cursor: pointer; }
.official-examples :deep(.example-catalog) { margin-bottom: 0; }
.state { padding: var(--lv-space-3) 0; color: var(--lv-color-text-secondary); font-size: var(--lv-size-body); }
.error { color: var(--lv-color-error); }
.handoff-note { display: flex; align-items: center; flex-wrap: wrap; gap: var(--lv-space-2) var(--lv-space-4); padding: var(--lv-space-2) 0; color: var(--lv-color-text-secondary); font-size: var(--lv-size-meta); line-height: 1.5; }
.handoff-note strong { color: var(--lv-color-text); }
@media (max-width: 899px) {
  .learn-page { height: auto; min-height: 0; }
  .learn-layout { display: flex; flex-direction: column; gap: var(--lv-space-3); }
  .chapter-navigation { overflow: visible; padding: 0; }
  .track-paths { display: flex; gap: var(--lv-space-2); }
  .track-paths button { flex: 1; min-width: 0; padding: var(--lv-space-2); }
  .chapter-directory { margin-top: var(--lv-space-2); }
  .reading-surface { overflow: visible; padding: var(--lv-space-4); }
}
</style>
