<template>
  <section class="sample-diff" :class="{ dark: isDark }" aria-label="输出差异">
    <header><strong>Git 风格输出差异</strong><span class="diff-legend"><span>期望输出（− 删除）</span><span>实际输出（+ 新增）</span></span><label><input v-model="showWhitespace" type="checkbox">显示空白字符</label></header>
    <p v-if="diff.truncated" class="truncated-note">差异较大，仅显示有界片段；并非完整 diff。</p>
    <ol class="diff-lines" aria-label="差异行">
      <li v-for="(row, index) in diff.rows" :key="`${row.kind}-${row.line}-${index}`" :class="`line-${row.kind}`">
        <span class="line-number">{{ row.line }}</span>
        <span class="line-sign" :aria-label="row.kind === 'removed' ? '删除' : row.kind === 'added' ? '新增' : '上下文'">{{ row.kind === 'removed' ? '−' : row.kind === 'added' ? '+' : ' ' }}</span>
        <code>{{ renderWhitespace(row.text) }}</code>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { SampleOutputDiff } from '~/utils/sample-output-diff'
defineProps<{ diff: SampleOutputDiff }>()
const { isDark } = useTheme()
const showWhitespace = ref(false)
function renderWhitespace(value: string) {
  return showWhitespace.value ? value.replace(/ /g, '·').replace(/\t/g, '⇥').replace(/\n/g, '↵') || '(空)' : value || '(空)'
}
</script>

<style scoped>
.sample-diff { min-width: 0; max-width: 100%; border: 1px solid var(--lv-color-border); border-radius: 6px; overflow: hidden; }
.sample-diff header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: var(--lv-color-canvas); }
.diff-legend { display: flex; flex-wrap: wrap; gap: 8px; font-size: .8rem; }
.sample-diff header label { display: inline-flex; align-items: center; gap: 5px; font-size: .82rem; }
.truncated-note { margin: 0; padding: 6px 10px; color: var(--lv-color-text-secondary); font-size: .8rem; }
.diff-lines { list-style: none; padding: 0; margin: 0; max-height: 260px; overflow: auto; }
.diff-lines li { display: grid; grid-template-columns: 3.25rem 1.5rem minmax(0, 1fr); min-width: 0; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
.diff-lines .line-number { color: var(--lv-color-text-secondary); text-align: right; padding-right: 6px; user-select: none; }
.diff-lines .line-sign { text-align: center; font-weight: 700; }
.diff-lines code { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; padding-inline: 5px; }
.line-removed { color: #a61b1b; background: #fff0f0; }
.line-removed .line-sign { color: inherit; }
.line-added { color: #176b39; background: #eaf8ee; }
.line-added .line-sign { color: inherit; }
.line-context { color: var(--lv-color-text-secondary); }
.dark .line-removed { background: #3b1c20; color: #ffb7b7; }
.dark .line-added { background: #183324; color: #a9efbb; }
</style>
