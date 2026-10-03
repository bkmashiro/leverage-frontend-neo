<template>
  <main class="learn-page">
    <header class="learn-header">
      <NuxtLink to="/compete" class="back-link">← Bot 对战</NuxtLink>
      <p class="eyebrow">学习 · 实践 · 对战</p>
      <h1>Bot 学习中心</h1>
      <p class="intro">理解协议，写出能运行的 Bot；也可以继续学习裁判和游戏可视化开发。</p>
    </header>

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
            <NuxtLink :to="{ path: '/compete/learn', query: { track, step: String(index + 1), gameId: selectedGameId || undefined } }" :aria-current="step === index + 1 ? 'step' : undefined">
              <span class="chapter-number">{{ index + 1 }}</span><span>{{ chapter }}</span>
            </NuxtLink>
          </li>
        </ol>
      </details>
    </aside>
    <section class="reading-surface" aria-label="教程内容">
      <h2 class="path-title">{{ currentPath.title }}</h2>
      <OfficialExamples v-if="track === 'bot' && step === 1" :busy="startingExample" @practice="practiceExample" />
      <div v-if="loading" class="state" role="status">正在加载可用游戏…</div>
      <div v-else-if="loadError" class="state error" role="alert">
        {{ loadError }} <NButton text type="primary" @click="loadGames">重试</NButton>
      </div>
      <div v-else-if="!games.length" class="state">暂时没有可用游戏。教程内容仍可阅读；稍后可从游戏目录选择练习环境。</div>
      <label v-if="games.length" class="game-picker">
        <span>练习游戏（可选）</span>
        <NSelect :value="selectedGameId" :options="gameOptions" clearable placeholder="选择教程示例游戏" aria-label="练习游戏" @update:value="setGame" />
      </label>

      <WikiContent
        :games="games"
        :default-game-id="selectedGameId"
        :track="track"
        :step="step - 1"
        public-read-only
        :show-track-selector="false"
        @update:track="setTrack"
        @update:step="setStep($event + 1)"
        @go-playground="handoff($event)"
        @go-renderer="handoff({ ...$event, tab: 'renderer' })"
      />
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
import { NButton, NSelect, useMessage } from 'naive-ui'
import WikiContent from '~/components/compete/WikiContent.vue'
import OfficialExamples from '~/components/compete/OfficialExamples.vue'
import type { OfficialExample } from '~/types/official-example'
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
const games = ref<any[]>([])
const loading = ref(true)
const loadError = ref('')
const startingExample = ref(false)
const gameOptions = computed(() => games.value.map(game => ({ label: game.name || game.title, value: game.id })))
const track = computed<Track>(() => TRACKS.includes(String(route.query.track) as Track) ? String(route.query.track) as Track : 'bot')
const currentPath = computed(() => TUTORIAL_TRACKS.find(path => path.id === track.value) ?? TUTORIAL_TRACKS[0])
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 900)
const step = computed(() => {
  const n = Number(route.query.step)
  return Number.isInteger(n) && n >= 1 && n <= STEPS[track.value] ? n : 1
})
const selectedGameId = computed<number | null>(() => {
  const n = Number(route.query.gameId)
  return Number.isSafeInteger(n) && n > 0 ? n : null
})

async function loadGames() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await api.listGames({ page: 1, perPage: 100 })
    games.value = (res.data as any)?.items || res.data || []
    if (!Array.isArray(games.value)) games.value = []
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

function navigateChapter(next: Partial<{ track: Track; step: number; gameId: number | null }>) {
  const nextTrack = next.track ?? track.value
  const nextStep = next.step ?? step.value
  void router.push({ path: '/compete/learn', query: {
    track: nextTrack,
    step: String(Math.min(STEPS[nextTrack], Math.max(1, nextStep))),
    gameId: (next.gameId === undefined ? selectedGameId.value : next.gameId) || undefined,
  } })
}
function setTrack(value: string) {
  if (TRACKS.includes(value as Track)) navigateChapter({ track: value as Track, step: 1 })
}
function setStep(value: number) { navigateChapter({ step: value }) }
function setGame(value: number | null) { navigateChapter({ gameId: value }) }

async function handoff(opts: { tab?: string; code?: string; lang?: string; html?: string; gameId?: number }) {
  const targetTab = opts.tab === 'judge' ? 'judge' : opts.tab === 'renderer' || opts.html !== undefined ? 'renderer' : 'bot'
  const targetGameId = opts.gameId ?? selectedGameId.value ?? games.value.find(game => game.title === '猜数字')?.id
  if (!authStore.isLoggedIn || authStore.user?.id == null) {
    message.info('请先登录；为保护代码，登录前不会暂存教程草稿。')
    await navigateTo('/login')
    return
  }
  if (!targetGameId) {
    message.warning('暂无可用练习游戏，请选择一个游戏后再打开工作台。')
    return
  }
  if (!games.value.some(game => game.id === targetGameId && !game.disabled)) {
    message.warning('所选游戏暂不可用，请选择一个可用游戏后再打开工作台。')
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

watch([track, step, selectedGameId], ([t, s, gameId]) => {
  const query = route.query
  const canonical = query.track === t && String(query.step ?? '') === String(s)
    && (gameId ? String(query.gameId) === String(gameId) : query.gameId === undefined)
  if (!canonical) void router.replace({ path: '/compete/learn', query: { track: t, step: String(s), gameId: gameId || undefined } })
}, { immediate: true })
onMounted(loadGames)
</script>

<style scoped>
.learn-page { width: min(100%, var(--lv-width-workspace, 1200px)); margin: 0 auto; padding: 8px 0 32px; color: var(--lv-color-text, inherit); font-family: var(--lv-font-ui, inherit); }
.learn-header { margin: 0 0 24px; }
.learn-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); align-items: start; gap: 24px; }
.chapter-navigation { position: sticky; top: 0; min-width: 0; }
.chapter-navigation h2 { margin: 0 0 12px; font-size: 15px; }
.track-paths { display: grid; gap: 8px; }
.track-paths button { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); color: var(--lv-color-text); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; }
.track-paths button[aria-pressed=true] { border-color: var(--lv-color-accent); background: var(--lv-color-accent-soft); color: var(--lv-color-accent); }
.track-paths button span { color: var(--lv-color-text-secondary); font-size: 12px; font-weight: 400; }
.chapter-directory { margin-top: 24px; }
.chapter-directory summary { font-size: 14px; font-weight: 600; cursor: pointer; }
.chapter-directory ol { display: grid; gap: 6px; list-style: none; margin: 12px 0 0; padding: 0; }
.chapter-directory a { display: flex; gap: 8px; padding: 10px 8px; border-radius: var(--lv-radius-sm); color: var(--lv-color-text-secondary); font-size: 14px; line-height: 1.5; text-decoration: none; }
.chapter-directory a[aria-current=step] { color: var(--lv-color-accent); background: var(--lv-color-accent-soft); font-weight: 600; }
.chapter-number { flex: 0 0 16px; font-variant-numeric: tabular-nums; }
.path-title { margin: 0 0 20px; font-size: var(--lv-size-section); line-height: 1.35; }
.back-link { color: var(--lv-color-accent, #2080f0); text-decoration: none; }
.eyebrow { margin: 28px 0 8px; color: var(--lv-color-accent, #2080f0); font-size: var(--lv-size-meta, 12px); font-weight: 700; letter-spacing: .08em; }
h1 { margin: 0; font-size: var(--lv-size-title, 28px); line-height: 1.3; }
.intro { max-width: 68ch; color: var(--lv-color-text-secondary, #666); line-height: 1.7; font-size: var(--lv-size-body, 16px); }
.reading-surface { min-width: 0; border: 1px solid var(--lv-color-border, #e4e7ec); border-radius: var(--lv-radius-lg, 14px); padding: clamp(16px, 3vw, 28px); background: var(--lv-color-surface, #fff); }
.game-picker { display: grid; gap: 8px; max-width: 420px; margin-bottom: 20px; font-size: var(--lv-size-meta, 13px); }
.state { padding: 24px 8px; color: var(--lv-color-text-secondary, #666); }
.error { color: var(--lv-color-error, #d03050); }
.handoff-note { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 16px; margin-top: 18px; padding: 14px 0; color: var(--lv-color-text-secondary, #666); font-size: 13px; line-height: 1.6; }
.handoff-note strong { color: var(--lv-color-text, #222); }
@media (max-width: 899px) { .learn-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; } .chapter-navigation { position: static; } .track-paths { display: flex; gap: 8px; } .track-paths button { flex: 1; min-width: 0; padding: 10px; } .chapter-directory { margin-top: 16px; } }
@media (max-width: 600px) { .learn-page { padding-top: 8px; } .reading-surface { padding: 16px; } }
</style>
