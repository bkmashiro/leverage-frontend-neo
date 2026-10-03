<template>
  <div class="tryit-block">
    <div class="tryit-header" @click="expanded = !expanded">
      <NTag type="success" :bordered="false" size="small" style="font-weight:700">
        ✏️ 动手试试
      </NTag>
      <span class="tryit-hint">{{ hint || '修改代码，看看结果有什么变化' }}</span>
      <NButton size="tiny" text>{{ expanded ? '▲ 收起' : '▼ 展开' }}</NButton>
    </div>

    <Transition name="slide-down">
      <div v-if="expanded" class="tryit-body">
        <!-- Mini editor -->
        <div class="tryit-editor">
          <div class="editor-controls">
            <NSelect v-model:value="lang" :options="BOTZONE_LANGUAGE_OPTIONS" size="small" style="width:120px" />
            <NButton size="small" text @click="resetCode">↩ 重置</NButton>
          </div>
          <CodeEditor v-model="editableCode" :language="lang" :height="editorHeight" />
        </div>

        <!-- Run controls -->
        <div class="tryit-run" v-if="gameId && opponentGamerId">
          <NButton type="primary" size="small" :loading="running" @click="run">
            ▶ 运行（测试对局）
          </NButton>
          <NText depth="3" style="font-size:11px">不影响 ELO，仅测试</NText>
        </div>
        <div v-else class="tryit-run">
          <NButton size="small" secondary @click="goPlayground">
            → 在 Playground 中完整测试
          </NButton>
        </div>

        <!-- Result preview -->
        <Transition name="fade">
          <div v-if="result" class="tryit-result">
            <NTag :type="result.success ? 'success' : 'error'" size="small">
              {{ result.success ? '✅ 对局完成' : '❌ 出错了' }}
            </NTag>
            <span v-if="result.finalResult" class="result-text">
              {{ formatResult(result.finalResult) }}
            </span>
            <span v-if="result.error" class="result-text error">{{ result.error }}</span>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NButton, NTag, NText, NSelect } from 'naive-ui'
import { BOTZONE_LANGUAGE_OPTIONS, botzoneLanguage } from '~/utils/botzone-language'

const props = defineProps<{
  initialCode: string
  initialLang?: string
  gameId?: number | null
  opponentGamerId?: number | null
  hint?: string
  compact?: boolean
}>()

const emit = defineEmits<{ 'try-code': [code: string, lang: string] }>()

const competeApi = useCompeteApi()
const expanded = ref(false)
const lang = ref(botzoneLanguage(props.initialLang))
const editableCode = ref(props.initialCode)
const running = ref(false)
const result = ref<{ success: boolean; finalResult?: any; error?: string } | null>(null)
const editorHeight = computed(() => props.compact ? '180px' : '240px')

watch(() => props.initialCode, (code) => { editableCode.value = code }, { immediate: true })

function resetCode() { editableCode.value = props.initialCode; lang.value = botzoneLanguage(props.initialLang); result.value = null }

function goPlayground() {
  emit('try-code', editableCode.value, lang.value)
}

async function run() {
  if (!props.gameId || !props.opponentGamerId) return
  running.value = true
  result.value = null
  try {
    const res = await competeApi.runPlayground(props.gameId, {
      code: editableCode.value,
      language: lang.value,
      opponentGamerId: props.opponentGamerId,
    })
    const { matchId } = res.data as any
    // Poll for result
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const mr = await competeApi.getMatch(matchId)
      const m = mr.data as any
      if (m.status === 2) {
        const r = typeof m.result === 'string' ? JSON.parse(m.result) : m.result
        result.value = { success: true, finalResult: r?.finalResult }
        break
      }
      if (m.status === 3) {
        result.value = { success: false, error: '对局执行失败' }
        break
      }
    }
    if (!result.value) result.value = { success: false, error: '超时未完成' }
  } catch (e: any) {
    result.value = { success: false, error: e?.message || '运行失败' }
  } finally {
    running.value = false
  }
}

function formatResult(fr: Record<string, number>) {
  const entries = Object.entries(fr)
  const maxScore = Math.max(...entries.map(([, v]) => v))
  const winners = entries.filter(([, v]) => v === maxScore).map(([k]) => `Bot${k}`)
  if (winners.length === entries.length) return '平局'
  return `胜者: ${winners.join(', ')} (分数: ${entries.map(([k, v]) => `${k}:${v}`).join(', ')})`
}
</script>

<style scoped>
.tryit-block { border: 2px dashed #b7eb8f; border-radius: 8px; overflow: hidden; margin: 12px 0; }
.tryit-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #f6ffed; cursor: pointer; user-select: none;
}
.tryit-hint { font-size: 12px; color: #555; flex: 1; }
.tryit-body { padding: 12px; background: #fff; }
.tryit-editor { border: 1px solid #e0e0e6; border-radius: 6px; overflow: hidden; margin-bottom: 8px; }
.editor-controls {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: #f5f5f7; border-bottom: 1px solid #e0e0e6;
}
.tryit-run { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tryit-result { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fafafa; border-radius: 6px; }
.result-text { font-size: 12px; }
.result-text.error { color: #d03050; font-family: monospace; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; max-height: 800px; overflow: hidden; }
.slide-down-enter-from, .slide-down-leave-to { max-height: 0; opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
