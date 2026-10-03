<template>
  <div class="wiki-code-block">
    <div class="code-header">
      <span class="code-lang">{{ langLabel }}</span>
      <div class="code-actions">
        <NButton v-if="tryable" size="tiny" type="primary" secondary @click="$emit('try-it', code)">
          <NIcon :component="PlayOutline" aria-hidden="true" /> 在 Playground 测试
        </NButton>
        <NButton size="tiny" :text="!copied" :type="copied ? 'success' : 'default'" @click="copyCode">
          <NIcon :component="copied ? CheckmarkOutline : CopyOutline" aria-hidden="true" /> {{ copied ? '已复制' : '复制' }}
        </NButton>
      </div>
    </div>
    <NCode :code="code" :language="lang || 'python'" :highlight-js="hljs" show-line-numbers style="font-family:var(--lv-font-code);font-size:var(--lv-size-code);line-height:1.55;padding:14px 0" />
    <p v-if="copyError" class="copy-error" role="alert">无法复制，请选中代码手动复制。</p>
    <div v-if="explanation" class="code-annotation">
      <NIcon class="annotation-icon" :component="BulbOutline" aria-hidden="true" />
      <span>{{ explanation }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { NButton, NCode, NIcon } from 'naive-ui'
import { BulbOutline, CheckmarkOutline, CopyOutline, PlayOutline } from '@vicons/ionicons5'
import hljs from 'highlight.js/lib/core'

const props = defineProps<{
  code: string
  lang?: string
  explanation?: string
  tryable?: boolean
}>()

defineEmits<{ 'try-it': [code: string] }>()

const copied = ref(false)
const copyError = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const labels: Record<string, string> = {
  python: 'Python', cpp: 'C++', java: 'Java', javascript: 'JavaScript', go: 'Go',
  typescript: 'TypeScript', html: 'HTML', json: 'JSON', text: '文本',
}
const langLabel = computed(() => labels[props.lang || 'python'] || (props.lang || 'Code'))

async function copyCode() {
  copyError.value = false
  copied.value = false
  if (copyTimer) clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch { copyError.value = true }
}
onUnmounted(() => { if (copyTimer) clearTimeout(copyTimer) })
</script>

<style scoped>
.wiki-code-block {
  border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); overflow: hidden;
  margin: 10px 0; font-size: 13px;
}
.code-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; gap: 8px; flex-wrap: wrap; background: var(--lv-color-canvas); border-bottom: 1px solid var(--lv-color-border);
}
.code-lang { font-size: 12px; font-weight: 600; color: var(--lv-color-text-secondary); }
.code-actions { display: flex; gap: 8px; align-items: center; }
/* NCode handles its own styling */
.code-annotation {
  padding: 8px 12px; background: #fffbe6; border-top: 1px solid #ffe58f;
  font-size: 12px; display: flex; gap: 6px; align-items: flex-start;
}
.annotation-icon { flex-shrink: 0; }
.copy-error { margin: 0; padding: 8px 12px; color: var(--lv-color-error); font-size: 13px; }
</style>
