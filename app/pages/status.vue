<template>
  <div class="status-page">
    <div class="page-header">
      <div><NH2 style="margin: 0">系统状态</NH2><NText depth="3">每 30 秒刷新；不把浏览器请求耗时当作服务组件延迟。</NText></div>
      <NSpace align="center"><NText depth="3">{{ lastUpdated || '尚未更新' }}</NText><NButton size="small" @click="refresh">刷新</NButton></NSpace>
    </div>
    <NGrid :cols="'1 s:2 m:4'" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <NGridItem v-for="service in services" :key="service.key" span="1">
        <NCard size="small">
          <NSpace align="center"><span class="status-dot" :class="service.status" /><NText strong>{{ service.name }}</NText><NTag size="small" :type="tagType(service.status)">{{ label(service.status) }}</NTag></NSpace>
          <NText v-if="service.detail" depth="3" style="display:block;margin-top:8px">{{ service.detail }}</NText>
        </NCard>
      </NGridItem>
    </NGrid>
    <NCard size="small" title="Judge Worker">
      <NSpin :show="loadingJudge">
        <NDescriptions v-if="judge" :column="2" bordered size="small">
          <NDescriptionsItem label="Worker 数">{{ judge.workers }}</NDescriptionsItem>
          <NDescriptionsItem label="最近心跳">{{ time(judge.lastHeartbeatAt) }}</NDescriptionsItem>
          <NDescriptionsItem label="最近完成">{{ time(judge.lastCompletedAt) }}</NDescriptionsItem>
          <NDescriptionsItem label="内存观测计数">测量 {{ judge.memory.measured }} / 缺失 {{ judge.memory.missing }}</NDescriptionsItem>
        </NDescriptions>
        <NText v-else depth="3">Judge 健康数据暂不可用。</NText>
        <NText v-if="judge" depth="3" style="display:block;margin-top:8px">观测计数仅覆盖当前统计范围，不代表全历史；更新时间 {{ judge.timestamp }}</NText>
      </NSpin>
    </NCard>
    <NCard size="small" title="依赖延迟">
      <NSpace v-if="system"><NTag type="info">数据库 {{ system.latency.dbMs }} ms</NTag><NTag type="info">Redis {{ system.latency.redisMs }} ms</NTag></NSpace>
      <NText v-else depth="3">依赖延迟数据暂不可用。</NText>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import type { HealthStatus, JudgeHealth, SystemInfo } from '~/composables/api/health'
definePageMeta({ layout: 'default' })
const healthApi = useHealthApi()
const services = ref([
  { key: 'api', name: 'API', status: 'unknown' as string, detail: '' },
  { key: 'database', name: 'Database', status: 'unknown' as string, detail: '' },
  { key: 'redis', name: 'Redis', status: 'unknown' as string, detail: '' },
  { key: 'judge', name: 'Judge', status: 'unknown' as string, detail: '' },
])
const judge = ref<JudgeHealth | null>(null)
const system = ref<SystemInfo | null>(null)
const loadingJudge = ref(false)
const lastUpdated = ref('')
function tagType(status: string) { return status === 'up' ? 'success' : status === 'down' ? 'error' : 'default' }
function label(status: string) { return status === 'up' ? '正常' : status === 'down' ? '异常' : '未知' }
function time(value: number | null) { return value == null ? '暂无' : new Date(value).toLocaleString('zh-CN') }
async function refresh() {
  loadingJudge.value = true
  const [healthResult, judgeResult, systemResult] = await Promise.allSettled([healthApi.get(), healthApi.getJudge(), healthApi.getSystem()])
  if (healthResult.status === 'fulfilled') {
    const data = healthResult.value.data as HealthStatus
    const info = data.info ?? {}
    services.value[0]!.status = 'up'
    services.value[0]!.detail = '健康接口可用'
    for (const key of ['database', 'redis'] as const) {
      const item = info[key]
      const target = services.value.find(s => s.key === key)!
      target.status = item?.status === 'up' ? 'up' : item ? 'down' : 'unknown'
      target.detail = item?.message ?? ''
    }
  }
  else {
    services.value[0]!.status = 'down'
    services.value[0]!.detail = '健康接口不可用'
    services.value.slice(1, 3).forEach(item => { item.status = 'unknown'; item.detail = '依赖状态未知' })
  }
  if (judgeResult.status === 'fulfilled' && judgeResult.value.status < 500) {
    judge.value = judgeResult.value.data
    services.value[3]!.status = judge.value.status
    services.value[3]!.detail = `${judge.value.workers} 个 worker 在线`
  }
  else { judge.value = null; services.value[3]!.status = 'unknown'; services.value[3]!.detail = 'Judge 健康接口不可用' }
  system.value = systemResult.status === 'fulfilled' ? systemResult.value.data : null
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN')
  loadingJudge.value = false
}
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { void refresh(); timer = setInterval(() => void refresh(), 30_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
useHead({ title: '系统状态 — Leverage OJ' })
</script>

<style scoped>
.status-page { max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: #909399; }
.status-dot.up { background: #18a058; }.status-dot.down { background: #d03050; }
@media(max-width:600px) { .page-header { align-items: flex-start; flex-direction: column; } }
</style>
