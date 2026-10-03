<template>
  <section v-if="diagnostics && (diagnostics.error || diagnostics.compilation.length || diagnostics.verdict === 'forfeit')" class="diagnostics" role="region" aria-label="执行诊断">
    <h3>执行诊断</h3>
    <p v-if="diagnostics.error" role="alert">{{ diagnostics.error }}</p>
    <p v-if="diagnostics.verdict === 'forfeit'">有选手未返回有效响应，按弃权规则结算。请检查响应格式、运行时错误和资源限制。</p>
    <article v-for="entry in diagnostics.compilation" :key="entry.key">
      <h4>{{ entry.key === 'judge' ? '裁判' : botNames?.[entry.key] || `Bot ${entry.key}` }} · 编译诊断</h4>
      <pre>{{ entry.message }}</pre>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ result: unknown; botNames?: Record<string, string> }>()
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const diagnostics = computed(() => {
  let value = props.result
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return null }
  }
  if (!record(value)) return null
  const messages = record(value.compileMessages) ? value.compileMessages : {}
  return {
    error: typeof value.error === 'string' ? value.error : '',
    verdict: typeof value.verdict === 'string' ? value.verdict : '',
    compilation: Object.entries(messages).flatMap(([key, message]) => typeof message === 'string' && message ? [{ key, message }] : []),
  }
})
</script>

<style scoped>
.diagnostics { margin-bottom: var(--lv-space-4); min-width: 0; overflow-wrap: anywhere; }
h3 { font-size: 16px; margin: 0 0 var(--lv-space-3); }
h4 { font-size: 14px; margin: var(--lv-space-3) 0 var(--lv-space-2); }
p { font-size: 14px; line-height: 1.7; }
pre { font-family: var(--lv-font-code); font-size: var(--lv-size-code); white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; max-height: 320px; padding: var(--lv-space-3); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); }
</style>
