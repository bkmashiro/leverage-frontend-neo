<template>
  <section class="example-catalog" role="region" aria-label="官方练习示例">
    <header><h2>官方练习示例</h2><NButton text type="primary" :loading="loading" @click="load">刷新状态</NButton></header>
    <p class="description">从规则、示例 Bot 和对手齐备的游戏开始。载入代码后在工作台测试，不会自动保存 Bot 或发起对局。</p>
    <p v-if="loading" role="status">正在查询示例状态…</p>
    <div v-else-if="error" role="alert">示例状态加载失败。教程仍可阅读。 <NButton text type="primary" @click="load">重试</NButton></div>
    <p v-else-if="!items.length">当前没有官方示例，可继续选择已有游戏练习。</p>
    <article v-for="item in items" v-else :key="item.key">
      <h3>{{ item.title }} <NTag size="small" :type="item.status === 'ready' ? 'success' : 'warning'">{{ labels[item.status] }}</NTag></h3>
      <template v-if="item.status === 'ready' && item.gameId && item.opponents.length">
        <p>已提供 {{ item.opponents.length }} 个示例对手。需要登录；载入前会检查游戏是否仍可用，并保留现有草稿的覆盖确认。</p>
        <NButton type="primary" :loading="busy" @click="emit('practice', item)">载入示例代码</NButton>
      </template>
      <p v-else-if="item.status === 'missing'">未安装。请管理员通过 MCP 的 install_example 显式安装；此页面不会自动写入游戏或对手。</p>
      <p v-else>配置冲突或对手不可用。请管理员检查安装记录与游戏配置，系统不会覆盖已有内容。</p>
    </article>
    <NuxtLink to="/ai">查看 MCP 配置与示例安装说明</NuxtLink>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NButton, NTag } from 'naive-ui'
import type { OfficialExample } from '~/types/official-example'
defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ practice: [example: OfficialExample] }>()
const api = useCompeteApi()
const labels = { missing: '未安装', ready: '可练习', conflict: '配置冲突' }
const items = ref<OfficialExample[]>([])
const loading = ref(false)
const error = ref(false)
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = false
  try {
    const response = await api.listExamples()
    if (!Array.isArray(response.data.items)) throw new Error('Invalid example catalog')
    items.value = response.data.items
  } catch {
    items.value = []
    error.value = true
  } finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.example-catalog { margin: var(--lv-space-5) 0; padding: var(--lv-space-4); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); background: var(--lv-color-surface); min-width: 0; overflow-wrap: anywhere; }
header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--lv-space-2); }
h2 { margin: 0; font-size: var(--lv-size-section); }
h3 { margin: var(--lv-space-3) 0; font-size: var(--lv-size-body); }
p { font-size: 14px; line-height: 1.7; color: var(--lv-color-text-secondary); }
a { display: inline-block; margin-top: var(--lv-space-3); color: var(--lv-color-accent); font-size: 14px; }
</style>
