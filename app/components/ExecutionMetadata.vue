<template>
  <section v-if="metadata && hasDetails" class="execution-metadata" aria-label="运行元数据">
    <div class="metadata-summary">
      <span v-if="metadata.timing" class="metadata-item">
        {{ timingScope }}：{{ Number(metadata.timing.wallMs.toFixed(2)) }} ms
      </span>
      <span v-if="metadata.memory" class="metadata-item">
        {{ memoryLabel }}：{{ formatMetadataBytes(metadata.memory.peakBytes) }}<template v-if="metadata.memory.limitBytes !== undefined"> / {{ formatMetadataBytes(metadata.memory.limitBytes) }}</template>
      </span>
      <span v-if="metadata.fuel" class="metadata-item">
        燃料：{{ metadata.fuel.consumed === undefined ? '—' : formatFuel(metadata.fuel.consumed) }} / {{ formatFuel(metadata.fuel.limit) }}
      </span>
      <span v-if="metadata.engine" class="metadata-item">{{ metadata.engine.name }}<template v-if="metadata.engine.version"> {{ metadata.engine.version }}</template></span>
    </div>
    <details>
      <summary>运行元数据</summary>
      <pre>{{ json }}</pre>
    </details>
  </section>
</template>

<script setup lang="ts">
import { formatFuel } from '~/utils/submission-feedback'
import { executionMetadataJson, formatMetadataBytes, normalizeExecutionMetadata } from '~/utils/execution-metadata'

const props = defineProps<{ value?: unknown }>()
const metadata = computed(() => normalizeExecutionMetadata(props.value))
const json = computed(() => executionMetadataJson(props.value))
const hasDetails = computed(() => !!metadata.value && (!!metadata.value.timing || !!metadata.value.memory || !!metadata.value.fuel || !!metadata.value.engine))
const timingScope = computed(() => {
  const timing = metadata.value?.timing
  if (!timing) return ''
  const scope = timing.scope === 'program_start_to_exit' ? '程序启动至退出' : 'ready 至退出'
  return timing.source === 'trusted_program_wall' ? scope : `${scope}（宿主观测）`
})
const memoryLabel = computed(() => {
  const kind = metadata.value?.memory?.kind
  if (kind === 'wasm_linear_memory_peak') return '线性内存峰值'
  if (kind === 'process_peak_rss') return '进程峰值 RSS'
  return kind === 'docker_stats' ? 'Docker 采样内存' : ''
})
</script>

<style scoped>
.execution-metadata { display: grid; gap: 4px; min-width: 0; max-width: 100%; color: var(--lv-color-text-secondary); font-size: 12px; }
.metadata-summary { display: flex; flex-wrap: wrap; gap: 4px 12px; min-width: 0; }
.metadata-item { overflow-wrap: anywhere; }
summary { width: fit-content; max-width: 100%; cursor: pointer; color: var(--lv-color-accent); }
summary:focus-visible { outline: 2px solid var(--lv-color-accent); outline-offset: 2px; }
pre { box-sizing: border-box; max-width: 100%; max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 8px; border-radius: 4px; background: var(--lv-color-canvas); font: 11px/1.5 var(--lv-font-code); }
</style>
