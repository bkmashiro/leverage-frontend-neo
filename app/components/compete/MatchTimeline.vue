<template>
  <div class="timeline-container">
    <!-- Participants header (clickable to toggle) -->
    <div class="timeline-header">
      <button
        v-for="p in participants"
        :key="p.id"
        type="button"
        :aria-label="`${p.name}日志`"
        :aria-pressed="!hiddenParticipants.has(p.id)"
        class="participant-badge"
        :class="{ 'participant-hidden': hiddenParticipants.has(p.id) }"
        :style="hiddenParticipants.has(p.id) ? {} : { borderColor: p.color, background: p.color + '15' }"
        style="cursor:pointer;user-select:none"
        :title="hiddenParticipants.has(p.id) ? '点击显示' : '点击隐藏'"
        @click="toggleParticipant(p.id)"
      >
        <span class="participant-icon">{{ p.icon }}</span>
        <span class="participant-name">{{ p.name }}</span>
        <span v-if="hiddenParticipants.has(p.id)" style="font-size:10px;margin-left:4px;opacity:.6">隐藏</span>
      </button>
    </div>

    <!-- Timeline rounds -->
    <div class="timeline-body">
      <TransitionGroup name="round-appear">
        <div
          v-for="(round, ri) in visibleRounds"
          :key="ri"
          class="timeline-round"
        >
          <div class="round-label">
            <NTag size="small" type="info" :bordered="false">第 {{ round.round }} 轮</NTag>
          </div>

          <TransitionGroup name="event-appear">
            <div
              v-for="(event, ei) in round.events"
              :key="ei"
              class="timeline-event"
              :class="`event-${event.type}`"
            >
              <!-- Arrow row -->
              <div class="event-arrow">
                <span class="event-from" :style="{ color: getColor(event.from) }">
                  {{ getIcon(event.from) }} {{ getName(event.from) }}
                </span>
                <span class="event-arrow-sym">→</span>
                <span class="event-to" :style="{ color: getColor(event.to) }">
                  {{ getIcon(event.to) }} {{ getName(event.to) }}
                </span>
              </div>

              <!-- Content -->
              <div class="event-content">
                <pre class="event-data">{{ formatData(event.data) }}</pre>
                <!-- Debug info -->
                <div v-if="event.debug" class="event-debug">
                  <span class="debug-label">💬</span>
                  <span class="debug-text">{{ event.debug }}</span>
                </div>
                <div v-if="event.stderr" class="event-stderr">
                  <span class="debug-label">📋 stderr:</span>
                  <span class="debug-text">{{ event.stderr }}</span>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <!-- Display data -->
          <div v-if="round.display && showDisplay" class="round-display">
            <span class="display-label">🖼 Display</span>
            <pre class="event-data">{{ JSON.stringify(round.display, null, 2) }}</pre>
          </div>
        </div>
      </TransitionGroup>

      <!-- Final result -->
      <Transition name="round-appear">
        <div v-if="finalResult && visibleRounds.length === allRounds.length" class="timeline-result">
          <NAlert
            :type="resultType"
            :show-icon="false"
            style="border-radius:8px"
          >
            <div class="result-content">
              <span class="result-emoji">{{ resultEmoji }}</span>
              <div>
                <div class="result-title">{{ resultTitle }}</div>
                <div class="result-scores">
                  <span
                    v-for="(score, pid) in finalResult"
                    :key="pid"
                    class="score-chip"
                    :style="{ background: getColor(`Bot${pid}`) + '30', color: getColor(`Bot${pid}`) }"
                  >
                    {{ participantName(pid) }}: {{ score }}
                  </span>
                </div>
              </div>
            </div>
          </NAlert>
        </div>
      </Transition>
    </div>

    <!-- Controls -->
    <div v-if="allRounds.length > 0" class="timeline-controls">
      <NSlider
        :value="animStep"
        :min="0"
        :max="allRounds.length"
        :step="1"
        style="flex:1"
        @update:value="jumpTo"
      />
      <NText depth="3" style="font-size:12px;min-width:60px;text-align:right">
        {{ visibleRounds.length }} / {{ allRounds.length }} 轮
      </NText>
      <NButton size="small" :disabled="animStep >= allRounds.length" @click="animateAll">
        {{ animStep === 0 ? '▶ 播放' : '⏩ 继续' }}
      </NButton>
      <NButton size="small" text @click="showDisplay = !showDisplay">
        {{ showDisplay ? '隐藏 Display' : '显示 Display' }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { NTag, NAlert, NButton, NText, NSlider } from 'naive-ui'

export interface TimelineEvent {
  from: string   // 'Judge' | 'Bot0' | 'Bot1'
  to: string
  type: 'cmd' | 'resp' | 'display'
  data: any
  debug?: string
  stderr?: string
}

export interface TimelineRound {
  round: number
  events: TimelineEvent[]
  display?: any
}

interface Participant {
  id: string
  name: string
  icon: string
  color: string
}

const props = defineProps<{
  rounds: TimelineRound[]
  finalResult?: Record<string, number> | null
  judgerName?: string
  botNames?: Record<string, string>  // pid → name
}>()

const showDisplay = ref(false)
const animStep = ref(0)
let animTimer: ReturnType<typeof setTimeout> | null = null

const hiddenParticipants = ref<Set<string>>(new Set())
function toggleParticipant(id: string) {
  const s = new Set(hiddenParticipants.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  hiddenParticipants.value = s
}

const allRounds = computed(() => props.rounds)
const visibleRounds = computed(() => {
  const sliced = allRounds.value.slice(0, animStep.value)
  if (hiddenParticipants.value.size === 0) return sliced
  return sliced.map(r => ({
    ...r,
    events: r.events.filter(e => !hiddenParticipants.value.has(e.from)),
  }))
})

const COLORS: Record<string, string> = {
  Judge: '#722ed1',
  Bot0: '#2080f0',
  Bot1: '#d03050',
  Bot2: '#f0a020',
  Bot3: '#18a058',
}

const ICONS: Record<string, string> = {
  Judge: '⚖️',
  Bot0: '🤖',
  Bot1: '🤖',
  Bot2: '🤖',
  Bot3: '🤖',
}

function getColor(id: string) {
  return COLORS[id] || '#888'
}

function getIcon(id: string) {
  return ICONS[id] || '📦'
}

function getName(id: string): string {
  if (id === 'Judge') return props.judgerName || '裁判'
  // id is like 'Bot0', 'Bot1' → extract index
  const m = id.match(/^Bot(\d+)$/)
  if (m) {
    const idx = m[1]
    if (props.botNames?.[idx]) return props.botNames[idx]
    return id
  }
  return id
}

const participants = computed<Participant[]>(() => {
  const ps: Participant[] = [
    { id: 'Judge', name: props.judgerName || '裁判', icon: '⚖️', color: '#722ed1' },
  ]
  const bots = props.botNames || {}
  const numBots = Object.keys(bots).length || 2
  for (let i = 0; i < numBots; i++) {
    ps.push({
      id: `Bot${i}`,
      name: bots[String(i)] || `Bot ${i}`,
      icon: ICONS[`Bot${i}`] || '🤖',
      color: COLORS[`Bot${i}`] || '#888',
    })
  }
  return ps
})

function participantName(pid: string | number): string {
  const pidStr = String(pid)
  if (props.botNames?.[pidStr]) return props.botNames[pidStr]
  return `Bot${pidStr}`
}

function formatData(data: any): string {
  if (data === null || data === undefined) return '—'
  if (typeof data === 'object') return JSON.stringify(data, null, 2)
  return String(data)
}

const maxScore = computed(() => {
  if (!props.finalResult) return 0
  return Math.max(...Object.values(props.finalResult))
})

const winners = computed(() => {
  if (!props.finalResult) return []
  return Object.entries(props.finalResult)
    .filter(([, v]) => v === maxScore.value)
    .map(([k]) => k)
})

const isDraw = computed(() => props.finalResult && winners.value.length === Object.keys(props.finalResult).length)

const resultType = computed<'success' | 'warning' | 'error'>(() =>
  isDraw.value ? 'warning' : 'success'
)

const resultEmoji = computed(() => isDraw.value ? '🤝' : '🏆')

const resultTitle = computed(() => {
  if (!props.finalResult) return ''
  if (isDraw.value) return '平局！'
  return `${winners.value.map(pid => participantName(pid)).join('、')} 获胜！`
})

function jumpTo(step: number) {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }
  animStep.value = step
}

function animateAll() {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }
  if (animStep.value >= allRounds.value.length) return
  function step() {
    if (animStep.value < allRounds.value.length) {
      animStep.value++
      if (animStep.value < allRounds.value.length) animTimer = setTimeout(step, 400)
      else animTimer = null
    }
  }
  step()
}

// Auto-animate when rounds arrive
watch(() => props.rounds.length, (len) => {
  if (!len) { jumpTo(0); return }
  if (animStep.value > len) jumpTo(len)
  if (len > 0 && animStep.value === 0) {
    jumpTo(0)
    animTimer = setTimeout(animateAll, 300)
  }
}, { immediate: true })
onUnmounted(() => { if (animTimer) clearTimeout(animTimer) })
</script>

<style scoped>
.timeline-container { display: flex; flex-direction: column; gap: var(--lv-space-2); min-width: 0; font-family: var(--lv-font-ui); }
.timeline-header {
  display: flex; flex-wrap: wrap; gap: var(--lv-space-2); padding: var(--lv-space-2) 0; border-bottom: 1px solid var(--lv-color-border);
}
.participant-badge.participant-hidden {
  background: #f0f0f0 !important; border-color: #ccc !important; opacity: .5;
}
.participant-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px; border-radius: 20px; border: 2px solid;
  font-size: 13px; font-weight: 600; font-family: inherit; color: var(--lv-color-text); min-height: 36px;
}
.participant-icon { font-size: 16px; }
.timeline-body { display: flex; flex-direction: column; gap: 4px; }
.timeline-round { border-left: 3px solid #e0e0e6; padding-left: 12px; margin-bottom: 8px; }
.round-label { margin-bottom: 6px; }
.timeline-event {
  display: flex; flex-direction: column; gap: 2px;
  margin-bottom: 6px; padding: 6px 10px;
  border-radius: var(--lv-radius-md); background: var(--lv-color-surface); border: 1px solid var(--lv-color-border);
}
.event-cmd { border-left: 3px solid #722ed1; }
.event-resp { border-left: 3px solid #2080f0; }
.event-display { border-left: 3px solid #18a058; }
.event-arrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600;
}
.event-arrow-sym { color: #aaa; }
.event-content { margin-top: 2px; }
.event-data {
  font-size: var(--lv-size-code); font-family: var(--lv-font-code); line-height: 1.6; background: var(--lv-color-canvas);
  padding: 4px 8px; border-radius: 4px; margin: 0;
  max-height: 100px; overflow: auto; white-space: pre-wrap; word-break: break-all;
}
.event-debug, .event-stderr {
  display: flex; gap: 4px; font-size: var(--lv-size-meta); margin-top: 3px;
  padding: 2px 6px; border-radius: 3px; background: #fffbe6;
}
.event-stderr { background: #fff1f0; }
.debug-label { font-weight: 600; flex-shrink: 0; }
.debug-text { color: var(--lv-color-text-secondary); font-family: var(--lv-font-code); overflow-wrap: anywhere; min-width: 0; }
.round-display {
  padding: 6px 10px; border-radius: 6px; background: #f6ffed;
  border: 1px dashed #b7eb8f; margin-top: 4px;
}
.display-label { font-size: 11px; font-weight: 600; color: #52c41a; display: block; margin-bottom: 4px; }
.timeline-result { margin-top: 12px; }
.result-content { display: flex; align-items: center; gap: 12px; }
.result-emoji { font-size: 28px; }
.result-title { font-weight: 700; font-size: 15px; margin-bottom: 6px; }
.result-scores { display: flex; gap: 8px; flex-wrap: wrap; }
.score-chip {
  padding: 2px 10px; border-radius: 12px;
  font-size: 13px; font-weight: 600;
}
.timeline-controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--lv-space-2);
  padding-top: var(--lv-space-2); border-top: 1px solid var(--lv-color-border);
}

/* Transitions */
.round-appear-enter-active { transition: all 0.35s ease; }
.round-appear-enter-from { opacity: 0; transform: translateY(-8px); }
.event-appear-enter-active { transition: all 0.25s ease; }
.event-appear-enter-from { opacity: 0; transform: translateX(-6px); }
</style>
