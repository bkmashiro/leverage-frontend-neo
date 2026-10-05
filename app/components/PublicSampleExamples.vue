<template>
  <section class="public-samples" aria-label="公开样例">
    <h3>公开样例</h3>
    <article v-for="({ sample, index }) in validSamples" :key="index" class="sample-card" :class="{ selected: selectedIndex === index }">
      <header class="sample-heading"><strong>样例 {{ index + 1 }}</strong><NButton size="small" secondary data-testid="use-public-sample" :aria-pressed="selectedIndex === index" @click="$emit('use-sample', index)">使用此样例</NButton></header>
      <div class="sample-columns">
        <div><h4>输入</h4><pre>{{ sample.input }}</pre></div>
        <div><h4>输出</h4><pre>{{ sample.output }}</pre></div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { PublicSample } from '~/types'
const props = defineProps<{ samples?: PublicSample[]; selectedIndex: number | null }>()
defineEmits<{ 'use-sample': [index: number] }>()
const validSamples = computed(() => (props.samples ?? []).map((sample, index) => ({ sample, index })).filter(({ sample }) => typeof sample.input === 'string' && typeof sample.output === 'string'))
</script>

<style scoped>
.public-samples { display: grid; gap: 10px; min-width: 0; }
.public-samples > h3 { margin: 0; font-size: 1rem; }
.sample-card { min-width: 0; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); padding: 12px; background: var(--lv-color-surface); }
.sample-card.selected { border-color: var(--lv-color-accent); }
.sample-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sample-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 8px; }
.sample-columns > div { min-width: 0; }
.sample-columns h4 { margin: 0 0 4px; font-size: .82rem; color: var(--lv-color-text-secondary); }
.sample-columns pre { box-sizing: border-box; max-width: 100%; max-height: 180px; overflow: auto; margin: 0; padding: 8px; border-radius: 6px; background: var(--lv-color-canvas); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
@media (max-width: 600px) { .sample-columns { grid-template-columns: minmax(0, 1fr); } }
</style>
