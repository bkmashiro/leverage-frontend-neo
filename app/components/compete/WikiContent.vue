<template>
  <div class="wiki-content">
    <!-- Track selector -->
    <div v-if="showTrackSelector !== false" class="track-selector">
      <button
        v-for="t in tracks"
        :key="t.id"
        type="button"
        class="track-card"
        :class="{ selected: activeTrack === t.id }"
        :aria-pressed="activeTrack === t.id"
        @click="selectTrack(t.id)"
      >
        <NIcon class="track-icon" :component="t.icon" aria-hidden="true" />
        <div class="track-title">{{ t.title }}</div>
        <div class="track-desc">{{ t.desc }}</div>
        <div class="track-meta">{{ t.steps }} 步 · {{ t.level }}</div>
      </button>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPct + '%' }" />
    </div>
    <div class="progress-text">当前章节 {{ currentStep + 1 }} / {{ activeSteps.length }}</div>

    <!-- Tutorial content -->
    <div v-if="activeTrack === 'bot'" class="tutorial-body">
      <WikiBotTutorial
        :step="currentStep"
        :games="games"
        :default-game-id="defaultGameId"
        :lookup-opponent="!publicReadOnly"
        @next="nextStep"
        @go-playground="$emit('go-playground', $event)"
      />
    </div>
    <div v-else-if="activeTrack === 'judge'" class="tutorial-body">
      <WikiJudgeTutorial
        :step="currentStep"
        @next="nextStep"
        @go-playground="$emit('go-playground', $event)"
      />
    </div>
    <div v-else-if="activeTrack === 'renderer'" class="tutorial-body">
      <WikiRendererTutorial
        :step="currentStep"
        @next="nextStep"
        @go-renderer="$emit('go-renderer', $event)"
      />
    </div>

    <!-- Nav buttons -->
    <div class="nav-buttons">
      <NButton :disabled="currentStep === 0" @click="prevStep">← 上一步</NButton>
      <NSpace>
        <NText depth="3" style="font-size:12px">第 {{ currentStep + 1 }} 步，共 {{ activeSteps.length }} 步</NText>
      </NSpace>
      <NButton type="primary" :disabled="currentStep >= activeSteps.length - 1" @click="nextStep">
        下一步 →
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton, NIcon, NSpace, NText } from 'naive-ui'
import { CodeSlashOutline, ConstructOutline, ColorPaletteOutline } from '@vicons/ionicons5'
import { TUTORIAL_TRACKS } from '~/utils/tutorial-tracks'
import WikiBotTutorial from './WikiBotTutorial.vue'
import WikiJudgeTutorial from './WikiJudgeTutorial.vue'
import WikiRendererTutorial from './WikiRendererTutorial.vue'

const props = withDefaults(defineProps<{
  games: any[]
  defaultGameId?: number | null
  track?: string
  step?: number
  publicReadOnly?: boolean
  showTrackSelector?: boolean
}>(), { showTrackSelector: true })

const emit = defineEmits<{
  'go-playground': [{ tab: string; gameId?: number; code?: string; lang?: string }]
  'go-renderer': [{ html?: string }]
  'update:track': [track: string]
  'update:step': [step: number]
}>()

const localTrack = ref('bot')
const localStep = ref(0)
const activeTrack = computed(() => props.track ?? localTrack.value)
const currentStep = computed(() => props.step ?? localStep.value)
const trackSteps: Record<string, number> = Object.fromEntries(TUTORIAL_TRACKS.map(track => [track.id, track.chapters.length]))
const icons = { bot: CodeSlashOutline, judge: ConstructOutline, renderer: ColorPaletteOutline }
const tracks = TUTORIAL_TRACKS.map(track => ({ ...track, steps: track.chapters.length, icon: icons[track.id] }))

const activeSteps = computed(() => Array.from({ length: trackSteps[activeTrack.value] || 1 }))
const progressPct = computed(() => activeSteps.value.length > 1 ? (currentStep.value / (activeSteps.value.length - 1)) * 100 : 0)

function selectTrack(id: string) {
  if (props.track !== undefined) emit('update:track', id)
  else localTrack.value = id
  // The controlled parent changes track + first chapter atomically. Emitting
  // a second step update here would navigate with the previous route's track.
  if (props.step === undefined) localStep.value = 0
  else if (props.track === undefined) emit('update:step', 0)
}

function nextStep() {
  if (currentStep.value < activeSteps.value.length - 1) {
    const step = currentStep.value + 1
    if (props.step !== undefined) emit('update:step', step)
    else localStep.value = step
  }
}
function prevStep() {
  if (currentStep.value > 0) {
    const step = currentStep.value - 1
    if (props.step !== undefined) emit('update:step', step)
    else localStep.value = step
  }
}
</script>

<style scoped>
.wiki-content { display: flex; flex-direction: column; gap: var(--lv-space-4, 16px); }
.track-selector { display: flex; gap: var(--lv-space-3, 12px); flex-wrap: wrap; }
.track-card {
  appearance: none; font: inherit; color: inherit; text-align: left; display: block;
  flex: 1; min-width: 200px; max-width: 280px;
  border: 2px solid var(--lv-color-border, #e0e0e6); border-radius: var(--lv-radius-md, 10px); padding: 14px;
  cursor: pointer; transition: all 0.2s; background: var(--lv-color-surface, #fff);
}
.track-card:focus-visible { outline: 3px solid var(--lv-color-accent, #2080f0); outline-offset: 2px; }
.track-card:hover { border-color: var(--lv-color-accent, #2080f0); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(32,128,240,0.1); }
.track-card.selected { border-color: var(--lv-color-accent, #2080f0); background: var(--lv-color-accent-soft, #e8f4ff); }
.track-icon { font-size: 22px; margin-bottom: 8px; color: var(--lv-color-accent); }
.track-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.track-desc { font-size: 12px; color: #666; margin-bottom: 8px; line-height: 1.5; }
.track-meta { font-size: 12px; color: var(--lv-color-text-secondary); font-weight: 600; }
.progress-bar { height: 4px; background: #e0e0e6; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--lv-color-accent); border-radius: 2px; transition: width 0.4s ease; }
.progress-text { font-size: 12px; color: var(--lv-color-text-secondary); }
.tutorial-body { min-height: 400px; }
.nav-buttons { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f0f0f0; }
@media (prefers-reduced-motion: reduce) { .track-card, .progress-fill { transition: none; } .track-card:hover { transform: none; } }
</style>
