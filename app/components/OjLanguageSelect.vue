<template>
  <div class="oj-language-select">
    <NSelect v-model:value="model" :options="LANGUAGE_OPTIONS" aria-label="编程语言" />
    <NuxtLink
      v-if="isWasm"
      to="/help/wasm"
      class="wasm-help-link"
      aria-label="查看 WASM 语言说明"
      title="WASM 语言说明"
    >
      <NIcon size="18" aria-hidden="true"><HelpCircleOutline /></NIcon>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { HelpCircleOutline } from '@vicons/ionicons5'
import type { OjLanguage } from '~/types'
import { LANGUAGE_OPTIONS } from '~/types'

const model = defineModel<OjLanguage>({ required: true })
const isWasm = computed(() => model.value.endsWith('-wasm'))
</script>

<style scoped>
.oj-language-select {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 180px;
  max-width: 100%;
  flex: 0 0 auto;
}

.wasm-help-link {
  display: inline-flex;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 30px;
  border-radius: 50%;
  color: var(--lv-color-text-secondary, #666);
}

.wasm-help-link:hover,
.wasm-help-link:focus-visible {
  color: var(--lv-color-primary, #2080f0);
}

.wasm-help-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
