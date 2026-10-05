<template>
  <section v-if="output" class="compile-diagnostics" aria-label="编译错误">
    <div class="diagnostic-summary">
      <button v-if="first" type="button" class="diagnostic-link" :disabled="!navigable" @click="$emit('navigate-diagnostic', { line: first.line, column: first.column })">
        {{ navigable ? `定位首个错误（第 ${first.line} 行，第 ${first.column} 列）：${first.message}` : `首个错误（第 ${first.line} 行，第 ${first.column} 列）：${first.message}` }}
      </button>
      <button type="button" class="output-toggle" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起完整编译输出' : '展开完整编译输出' }}</button>
      <button type="button" class="output-copy" @click="copyOutput">复制完整输出</button>
    </div>
    <pre v-if="expanded" class="compile-output">{{ output }}</pre>
  </section>
</template>

<script setup lang="ts">
import { parseCompileDiagnostics } from '~/utils/compile-diagnostics'
const props = defineProps<{ output: string; navigable?: boolean }>()
defineEmits<{ 'navigate-diagnostic': [location: { line: number; column: number }] }>()
const expanded = ref(false)
const first = computed(() => parseCompileDiagnostics(props.output)[0])
async function copyOutput() {
  try { await navigator.clipboard.writeText(props.output) } catch { /* clipboard permission is optional */ }
}
</script>

<style scoped>
.compile-diagnostics { margin-top: 10px; }
.diagnostic-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.diagnostic-link, .output-toggle, .output-copy { border: 0; padding: 4px 0; color: var(--lv-color-accent); background: transparent; text-decoration: underline; cursor: pointer; }
.diagnostic-link:disabled { color: var(--lv-color-text-secondary); cursor: not-allowed; }
.compile-output { max-height: 320px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; background: var(--lv-color-surface-secondary); border-radius: 4px; }
</style>
