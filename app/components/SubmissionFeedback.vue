<template>
  <section v-if="view.id || submitting || submitError" class="feedback" data-testid="submission-feedback" aria-label="评测结果">
    <header class="feedback-header">
      <strong>{{ submitting ? '正在提交…' : view.phase === 'complete' ? '评测汇总' : '评测进度' }}</strong>
      <NTag v-if="view.status === 9 || view.status === 10 || view.status === 11" :bordered="false" type="info">{{ progressStatusLabel }}</NTag>
      <StatusTag v-else-if="view.status !== undefined" :status="view.status" />
      <NuxtLink v-if="view.id && !detail" :to="`/submissions/${view.id}`">提交 #{{ view.id }} ↗</NuxtLink>
      <NButton v-if="canRecover" size="small" secondary :loading="recovering" @click="$emit('recover')">找回上次提交</NButton>
    </header>
    <p v-if="submitting && view.id" class="muted">上次提交结果</p>
    <p v-if="submitError" role="alert" class="error">{{ submitError }}</p>
    <div class="feedback-state" role="status" aria-live="polite">
      <template v-if="view.message">
        <span>{{ view.message }}</span>
        <NButton size="tiny" secondary @click="$emit('retry')">重新连接</NButton>
      </template>
      <span v-else-if="view.stalled">等待时间较长，仍在获取结果…</span>
      <span v-else-if="(view.phase as string) === 'fetching'">正在读取最终结果…</span>
      <span v-else-if="view.phase === 'complete' && view.cases.length">测试点通过 {{ accepted }} / {{ view.cases.length }}</span>
      <span v-else-if="view.total">已完成 {{ view.completed }} / {{ view.total }} 个测试点</span>
      <span v-else-if="view.phase === 'loading'">正在恢复评测状态…</span>
      <span v-else-if="view.phase === 'waiting'">等待评测结果…</span>
      <span v-else-if="submitting">正在提交…</span>
      <span v-else>评测已结束。</span>
    </div>
    <div v-if="view.cases.length" :data-testid="view.phase !== 'complete' ? 'submission-progress' : undefined" class="case-region">
      <table>
        <caption class="sr-only">测试点详情</caption>
        <thead><tr><th scope="col">#</th><th scope="col">结果</th><th scope="col">时间</th><th scope="col">内存</th><th v-if="hasDetails" scope="col">详情</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in view.cases" :key="`${view.id}:${row.id}:${index}`">
            <th scope="row">{{ row.id }}</th>
            <td><NTag :type="row.verdict === 'AC' ? 'success' : row.verdict === '?' ? 'default' : 'error'" :bordered="false" size="small">{{ row.verdict }}</NTag></td>
            <td>{{ row.time == null ? '—' : `${Number(row.time.toFixed(2))}ms` }}</td>
            <td>{{ row.memory == null ? '未记录' : formatMemoryBytes(row.memory) }}</td>
            <td v-if="hasDetails">
              <span v-if="row.message">{{ row.message }}</span>
              <details v-if="row.actualOutput"><summary>实际输出</summary><pre>{{ row.actualOutput }}</pre></details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="view.compileError || (view.phase === 'complete' && view.status === 4)" class="compile-error">
      <strong>编译错误</strong>
      <pre v-if="view.compileError">{{ view.compileError }}</pre>
      <NuxtLink v-if="view.id" :to="`/submissions/ce/${view.id}`">查看完整编译错误</NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatMemoryBytes } from '~/types'
import type { SubmissionFeedbackView } from '~/utils/submission-feedback'
const props = defineProps<{ view: SubmissionFeedbackView; submitting?: boolean; submitError?: string; detail?: boolean; canRecover?: boolean; recovering?: boolean }>()
defineEmits<{ retry: []; recover: [] }>()
const accepted = computed(() => props.view.cases.filter(row => row.verdict === 'AC').length)
const hasDetails = computed(() => props.view.cases.some(row => row.message || row.actualOutput))
const progressStatusLabel = computed(() => ({ 9: '等待评测机', 10: '评测中', 11: '编译中' } as Record<number, string>)[props.view.status ?? -1] ?? '')
</script>

<style scoped>
.feedback { min-width: 0; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); padding: 12px; margin-block: 12px; background: var(--lv-color-surface); transition: background-color 140ms ease, border-color 140ms ease; }
.feedback-header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 28px; }
.feedback-header a { margin-inline-start: auto; }
.feedback a { color: var(--lv-color-accent); text-decoration: none; }
.feedback a:hover { text-decoration: underline; }
.feedback a:focus-visible, summary:focus-visible { outline: 2px solid var(--lv-color-accent); outline-offset: 2px; }
.feedback-state { min-height: 24px; margin-block: 8px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--lv-color-text-secondary); }
.muted { color: var(--lv-color-text-secondary); }
.error { color: var(--lv-color-error); overflow-wrap: anywhere; }
.case-region { max-height: 320px; overflow: auto; overscroll-behavior: contain; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 8px; text-align: start; border-bottom: 1px solid var(--lv-color-border); white-space: nowrap; }
th { font-weight: 500; }
thead { background: var(--lv-color-canvas); }
summary { cursor: pointer; color: var(--lv-color-accent); }
pre { white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; max-height: 200px; overflow: auto; font: 12px/1.6 var(--lv-font-code); }
.compile-error { margin-top: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (prefers-reduced-motion: reduce) { .feedback { transition: none; } }
@media (max-width: 600px) { th, td { padding: 6px; } .feedback { padding: 10px; } }
</style>
