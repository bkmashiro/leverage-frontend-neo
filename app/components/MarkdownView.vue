<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-body" v-html="rendered" />
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import { sanitizeHtml } from '../utils/sanitize-html'
import katex from 'katex'

const props = defineProps<{
  content: string
}>()

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(texmath, {
  engine: katex,
  delimiters: ['dollars', 'brackets'],  // 支持 $...$ 和 \(...\) 两种格式
  katexOptions: { throwOnError: false },
})

const rendered = computed(() => sanitizeHtml(md.render(props.content || '')))
</script>

<style scoped>
.markdown-body { max-width: var(--lv-width-reading); color: var(--lv-color-text); font-size: 16px; line-height: 1.75; overflow-wrap: anywhere; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3), .markdown-body :deep(h4) { color: var(--lv-color-text); font-weight: 650; line-height: 1.3; }
.markdown-body :deep(h1) { margin: var(--lv-space-7) 0 var(--lv-space-4); font-size: var(--lv-size-title); }
.markdown-body :deep(h2) { margin: var(--lv-space-6) 0 var(--lv-space-3); font-size: var(--lv-size-section); }
.markdown-body :deep(h3) { margin: var(--lv-space-5) 0 var(--lv-space-2); font-size: 18px; }
.markdown-body :deep(h4) { margin: var(--lv-space-4) 0 var(--lv-space-2); font-size: 16px; }
.markdown-body :deep(p) { margin: var(--lv-space-3) 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; }
.markdown-body :deep(li + li) { margin-top: var(--lv-space-1); }
.markdown-body :deep(pre) { max-width: 100%; margin: var(--lv-space-4) 0; padding: var(--lv-space-4); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: #f6f8fa; overflow: auto; }
.markdown-body :deep(pre code), .markdown-body :deep(code) { font-family: var(--lv-font-code); font-size: var(--lv-size-code); line-height: 1.55; }
.markdown-body :deep(p code), .markdown-body :deep(li code) { padding: 2px var(--lv-space-1); border-radius: var(--lv-radius-sm); background: var(--lv-color-accent-soft); }
.markdown-body :deep(img), .markdown-body :deep(video) { max-width: 100%; height: auto; }
.markdown-body :deep(a) { color: var(--lv-color-accent); text-underline-offset: 2px; }
.markdown-body :deep(a:hover) { color: var(--lv-color-accent-hover); }
.markdown-body :deep(eq) { display: inline; }
.markdown-body :deep(section.eqno), .markdown-body :deep(section.eq) { display: block; margin: var(--lv-space-3) 0; text-align: center; }
.markdown-body :deep(.katex-display) { max-width: 100%; overflow-x: auto; overflow-y: hidden; }
.markdown-body :deep(blockquote) { margin: var(--lv-space-4) 0; padding-left: var(--lv-space-4); border-left: 3px solid var(--lv-color-border); color: var(--lv-color-text-secondary); }
.markdown-body :deep(table) { display: block; width: 100%; margin: var(--lv-space-4) 0; border-collapse: collapse; overflow-x: auto; }
.markdown-body :deep(th), .markdown-body :deep(td) { padding: var(--lv-space-2) var(--lv-space-3); border: 1px solid var(--lv-color-border); text-align: left; }
.markdown-body :deep(th) { background: var(--lv-color-accent-soft); font-weight: 600; }
@media (max-width: 767px) {
  .markdown-body { font-size: 16px; }
  .markdown-body :deep(h1) { font-size: 24px; }
  .markdown-body :deep(pre) { padding: var(--lv-space-3); }
}
</style>
