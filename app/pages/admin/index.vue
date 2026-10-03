<template>
  <div class="admin-dashboard">
    <!-- 页头 -->
    <div class="dashboard-header">
      <NH2 style="margin: 0">管理后台</NH2>
      <NText depth="3">欢迎回来，{{ authStore.user?.username }}！</NText>
    </div>

    <NAlert v-if="statError" type="error" title="平台统计暂时不可用" :bordered="false">
      <template #action><NButton size="small" @click="fetchStat">重试</NButton></template>
    </NAlert>
    <NSpin v-else-if="statLoading && !stat" :show="true" description="正在加载平台统计" />
    <NEmpty v-else-if="!stat" description="暂无统计数据" />
    <!-- 仅在 API 返回数据后展示统计 -->
    <NGrid v-else :cols="'1 s:2 m:3 l:5'" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
      <NGridItem span="1 m:1 s:1" style="min-width: 0">
        <NCard class="stat-card">
          <NStatistic label="用户" :value="stat?.user ?? 0" :loading="statLoading">
            <template #suffix>
              <NButton text size="tiny" tag="a" href="/admin/users" style="color: #2080f0; font-size: 12px; margin-left: 6px">
                查看 →
              </NButton>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="1 m:1 s:1" style="min-width: 0">
        <NCard class="stat-card">
          <NStatistic label="题目" :value="stat?.problem ?? 0" :loading="statLoading">
            <template #suffix>
              <NButton text size="tiny" tag="a" href="/admin/problems" style="color: #18a058; font-size: 12px; margin-left: 6px">
                查看 →
              </NButton>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="1 m:1 s:1" style="min-width: 0">
        <NCard class="stat-card">
          <NStatistic label="提交" :value="stat?.submission ?? 0" :loading="statLoading" />
        </NCard>
      </NGridItem>
      <NGridItem span="1 m:1 s:1" style="min-width: 0">
        <NCard class="stat-card">
          <NStatistic label="竞赛" :value="stat?.contest ?? 0" :loading="statLoading">
            <template #suffix>
              <NButton text size="tiny" tag="a" href="/admin/contests" style="color: #f0a020; font-size: 12px; margin-left: 6px">
                查看 →
              </NButton>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="1 m:1 s:1" style="min-width: 0">
        <NCard class="stat-card">
          <NStatistic label="课程" :value="stat?.course ?? 0" :loading="statLoading">
            <template #suffix>
              <NButton text size="tiny" tag="a" href="/admin/courses" style="color: #8a2be2; font-size: 12px; margin-left: 6px">
                查看 →
              </NButton>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 系统状态 -->
    <NCard class="section-card">
      <template #header>
        <div class="section-title">⚙️ 系统状态</div>
      </template>
      <NSpin :show="healthLoading">
        <NDescriptions :column="2" bordered>
          <NDescriptionsItem label="🗄️ 数据库">
            <NTag :type="dbStatus === 'up' ? 'success' : dbStatus === 'unknown' ? 'default' : 'error'" size="small">
              {{ dbStatus === 'up' ? '✅ 正常' : dbStatus === 'unknown' ? '未知' : '❌ 异常' }}
            </NTag>
            <NText v-if="sysInfo?.latency?.dbMs !== undefined" depth="3" style="font-size: 12px; margin-left: 8px">
              延迟 {{ sysInfo.latency.dbMs }}ms
            </NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="🔴 Redis">
            <NTag :type="redisStatus === 'up' ? 'success' : redisStatus === 'unknown' ? 'default' : 'error'" size="small">
              {{ redisStatus === 'up' ? '✅ 正常' : redisStatus === 'unknown' ? '未知' : '❌ 异常' }}
            </NTag>
            <NText v-if="sysInfo?.latency?.redisMs !== undefined" depth="3" style="font-size: 12px; margin-left: 8px">
              延迟 {{ sysInfo.latency.redisMs }}ms
            </NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="🧠 Heap">
            <NTag :type="heapStatus === 'up' ? 'success' : heapStatus === 'unknown' ? 'default' : 'warning'" size="small">
              {{ heapStatus === 'up' ? '✅ 正常' : heapStatus === 'unknown' ? '未知' : '⚠️ 偏高' }}
            </NTag>
            <NText v-if="health?.info?.memory_heap?.message" depth="3" style="font-size: 12px; margin-left: 8px">
              {{ health.info.memory_heap.message }}
            </NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="📦 RSS">
            <NTag :type="rssStatus === 'up' ? 'success' : rssStatus === 'unknown' ? 'default' : 'warning'" size="small">
              {{ rssStatus === 'up' ? '✅ 正常' : rssStatus === 'unknown' ? '未知' : '⚠️ 偏高' }}
            </NTag>
            <NText v-if="sysInfo?.memory?.rss" depth="3" style="font-size: 12px; margin-left: 8px">
              {{ sysInfo.memory.rss }}
            </NText>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="⚙️ 进程">
            <NText style="font-size: 12px">PID {{ sysInfo.process.pid }} · {{ sysInfo.process.nodeVersion }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="⏱️ 运行时长">
            <NText style="font-size: 12px">{{ sysInfo.process.uptime }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="🖥️ 平台">
            <NText style="font-size: 12px">{{ sysInfo.process.platform }}/{{ sysInfo.process.arch }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="🌐 环境">
            <NTag size="small" :type="sysInfo.env === 'production' ? 'error' : 'info'">{{ sysInfo.env }}</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="💾 内存详情">
            <NText style="font-size: 12px">
              Heap {{ sysInfo.memory.heapUsed }} / {{ sysInfo.memory.heapTotal }} · Ext {{ sysInfo.memory.external }}
            </NText>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="sysInfo" label="🔧 CPU 时间">
            <NText style="font-size: 12px">user {{ sysInfo.cpu.userMs }}ms · sys {{ sysInfo.cpu.systemMs }}ms</NText>
          </NDescriptionsItem>
        </NDescriptions>

        <!-- 评测统计 -->
        <NDivider style="margin: 16px 0" />
        <div class="queue-title" style="margin-bottom: 8px">
          <NText strong>📊 评测吞吐</NText>
          <NButton text size="tiny" style="margin-left: 8px" @click="fetchJudgeStats">🔄</NButton>
        </div>
        <NDescriptions v-if="judgeStats" :column="3" bordered size="small">
          <NDescriptionsItem label="1分钟">
            <NText>{{ judgeStats.last1min }} 次</NText>
            <NText depth="3" style="font-size: 11px; margin-left: 4px">AC {{ judgeStats.acLast1min }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="5分钟">
            <NText>{{ judgeStats.last5min }} 次</NText>
            <NText depth="3" style="font-size: 11px; margin-left: 4px">AC {{ judgeStats.acLast5min }}</NText>
          </NDescriptionsItem>
          <NDescriptionsItem label="10分钟">
            <NText>{{ judgeStats.last10min }} 次</NText>
            <NText depth="3" style="font-size: 11px; margin-left: 4px">AC {{ judgeStats.acLast10min }}</NText>
          </NDescriptionsItem>
        </NDescriptions>
        <NText v-else-if="judgersLoading" depth="3">加载中…</NText>

        <!-- 失败队列 -->
        <NDivider style="margin: 16px 0" />
        <div class="queue-title" style="margin-bottom: 8px">
          <NText strong>💀 失败队列</NText>
          <NTag v-if="failedJobs.length > 0" type="error" size="small" style="margin-left: 6px">{{ failedJobs.length }}</NTag>
          <NButton text size="tiny" style="margin-left: 8px" @click="fetchFailedJobs">🔄</NButton>
          <NButton v-if="failedJobs.length > 0" text size="tiny" type="primary" style="margin-left: 8px" @click="handleRetryAll">全部重投</NButton>
          <NButton v-if="failedJobs.length > 0" text size="tiny" type="error" style="margin-left: 8px" @click="handleClearAll">全部清空</NButton>
        </div>
        <NList v-if="failedJobs.length > 0" bordered size="small" style="margin-top: 4px">
          <NListItem v-for="job in failedJobs" :key="job.jobId">
            <NSpace align="center" justify="space-between" style="width: 100%">
              <div>
                <NText strong style="font-size: 12px">提交 #{{ job.submissionId ?? '?' }}</NText>
                <NText depth="3" style="font-size: 11px; margin-left: 8px">{{ job.failedReason?.slice(0, 60) }}</NText>
                <NText depth="3" style="font-size: 11px; display: block">重试 {{ job.attemptsMade }} 次 · {{ job.timestamp ? new Date(job.timestamp).toLocaleString('zh-CN') : '-' }}</NText>
              </div>
              <NSpace>
                <NButton size="tiny" type="primary" @click="handleRetryOne(job.jobId)">重投</NButton>
                <NButton size="tiny" type="error" @click="handleClearOne(job.jobId)">清除</NButton>
              </NSpace>
            </NSpace>
          </NListItem>
        </NList>

        <!-- 评测机状态 -->
        <NDivider style="margin: 16px 0" />
        <div class="queue-title">
          <NText strong>⚖️ 评测机</NText>
          <NButton text size="tiny" style="margin-left: 8px" @click="fetchJudgers">🔄</NButton>
        </div>
        <div v-if="judgersLoading" style="margin-top: 8px">
          <NText depth="3">正在加载评测机…</NText>
        </div>
        <NList v-else-if="judgers.length > 0" style="margin-top: 8px" bordered size="small">
          <NListItem v-for="j in judgers" :key="j.name">
            <NSpace align="center">
              <NTag :type="j.ttl > 0 ? 'success' : 'error'" size="small">
                {{ j.ttl > 0 ? '🟢 在线' : '🔴 离线' }}
              </NTag>
              <NText strong>{{ j.name }}</NText>
              <NText depth="3" style="font-size: 12px">v{{ j.version }}</NText>
              <NText v-if="j.ttl > 0" depth="3" style="font-size: 12px">TTL {{ j.ttl }}s</NText>
            </NSpace>
          </NListItem>
        </NList>
        <NEmpty v-else description="暂无在线评测机" style="margin-top: 8px" />

        <!-- 评测队列 -->
        <div v-if="queues" class="queue-section">
          <NDivider style="margin: 16px 0" />
          <div class="queue-title">
            <NText strong>⚡ 评测队列</NText>
            <NText depth="3" style="font-size: 12px">{{ queues.queue }}</NText>
            <NButton
              text size="tiny" tag="a"
              :href="`http://${apiHost}:3000/admin/queues?token=${accessToken}`"
              target="_blank"
              style="margin-left: 10px; font-size: 12px"
            >🔍 Bull Board →</NButton>
          </div>
          <NSpace style="margin-top: 8px">
            <NTag type="default" size="small">等待 {{ queues.waiting ?? 0 }}</NTag>
            <NTag type="info" size="small">活跃 {{ queues.active ?? 0 }}</NTag>
            <NTag type="success" size="small">完成 {{ queues.completed ?? 0 }}</NTag>
            <NTag type="error" size="small">失败 {{ queues.failed ?? 0 }}</NTag>
            <NTag v-if="(queues.delayed ?? 0) > 0" type="warning" size="small">延迟 {{ queues.delayed }}</NTag>
          </NSpace>
        </div>
        <div v-else-if="queuesLoading" class="queue-section">
          <NDivider style="margin: 16px 0" />
          <NText depth="3">正在加载队列信息…</NText>
        </div>
      </NSpin>
      <template #footer>
        <NText depth="3" style="font-size: 12px">
          最后更新：{{ healthUpdatedAt || '—' }}
          <NButton text size="tiny" style="margin-left: 8px" @click="fetchHealth">🔄 刷新</NButton>
        </NText>
      </template>
    </NCard>

    <!-- 最新公告 -->
    <NCard class="section-card">
      <template #header>
        <div class="section-header">
          <div class="section-title">📢 最新公告</div>
          <NButton size="small" @click="navigateTo('/admin/notifications')">查看全部 →</NButton>
        </div>
      </template>
      <NSpin :show="notifLoading">
        <NAlert v-if="notifError" type="error" title="公告暂时无法加载" :bordered="false">
          <template #action><NButton size="small" @click="fetchNotifications">重试</NButton></template>
        </NAlert>
        <NEmpty v-else-if="!notifLoading && notifications.length === 0" description="暂无公告" />
        <NList v-else-if="notifications.length > 0" bordered>
          <NListItem v-for="n in notifications" :key="n.id">
            <div class="notif-item">
              <div class="notif-meta">
                <NText strong>{{ n.title }}</NText>
                <NText depth="3" style="font-size: 12px">
                  {{ n.targetUserId ? `→ 用户 #${n.targetUserId}` : '全体用户' }}
                  ·
                  {{ formatTime(n.createdAt) }}
                </NText>
              </div>
              <NText depth="2" class="notif-content">{{ n.content }}</NText>
            </div>
          </NListItem>
        </NList>
      </NSpin>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'
import type { HealthStatus, QueueHealth, SystemInfo } from '~/composables/api/health'
import type { FailedJob } from '~/composables/api/transmit'
import type { StatResult } from '~/composables/api/statistics'
import type { Notification } from '~/composables/api/notifications'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const authStore = useAuthStore()
const statisticsApi = useStatisticsApi()
const healthApi = useHealthApi()
const notificationsApi = useNotificationsApi()
const transmitApi = useTransmitApi()
const config = useRuntimeConfig()
const message = useMessage()

// Bull Board 链接（附上 JWT）
const accessToken = computed(() => authStore.accessToken ?? '')
const apiHost = computed(() => {
  try {
    return new URL(config.public.apiBase as string).hostname
  }
  catch {
    return window.location.hostname
  }
})

// ── 统计数字 ─────────────────────────────────────────────────────────────────
const stat = ref<StatResult | null>(null)
const statLoading = ref(false)
const statError = ref(false)

async function fetchStat() {
  statLoading.value = true
  statError.value = false
  try {
    const res = await statisticsApi.getStat()
    stat.value = res.data
  }
  catch (e) {
    statError.value = true
    console.error('stat error', e)
  }
  finally {
    statLoading.value = false
  }
}

// ── 评测机 ───────────────────────────────────────────────────────────────────
interface Judger { name: string; version: string; ttl: number }
const judgers = ref<Judger[]>([])
const judgersLoading = ref(false)

async function fetchJudgers() {
  judgersLoading.value = true
  try {
    const res = await transmitApi.getJudgers()
    judgers.value = res.data ?? []
  }
  catch (e) {
    console.error('judgers error', e)
  }
  finally {
    judgersLoading.value = false
  }
}

interface JudgeStats { last1min: number; last5min: number; last10min: number; acLast1min: number; acLast5min: number; acLast10min: number }
const judgeStats = ref<JudgeStats | null>(null)

async function fetchJudgeStats() {
  try {
    const res = await transmitApi.getJudgeStats()
    judgeStats.value = res.data
  }
  catch (e) {
    console.error('judge stats error', e)
  }
}

// ── 失败队列 ─────────────────────────────────────────────────────────────────
const failedJobs = ref<FailedJob[]>([])
const failedJobsLoading = ref(false)

async function fetchFailedJobs() {
  failedJobsLoading.value = true
  try {
    const res = await transmitApi.getFailedJobs()
    failedJobs.value = res.data ?? []
  }
  catch (e) { console.error('failed jobs error', e) }
  finally { failedJobsLoading.value = false }
}

async function handleRetryOne(jobId: string | number) {
  await transmitApi.retryJob(jobId)
  message.success('已重新投递')
  fetchFailedJobs()
}

async function handleClearOne(jobId: string | number) {
  await transmitApi.clearJob(jobId)
  message.success('已清除')
  fetchFailedJobs()
}

async function handleRetryAll() {
  await transmitApi.retryAllFailed()
  message.success('全部重新投递')
  fetchFailedJobs()
}

async function handleClearAll() {
  await transmitApi.clearAllFailed()
  message.success('已清空失败队列')
  fetchFailedJobs()
}

// ── 系统健康 ─────────────────────────────────────────────────────────────────
const health = ref<HealthStatus | null>(null)
const healthLoading = ref(false)
const queues = ref<QueueHealth | null>(null)
const queuesLoading = ref(false)
const healthUpdatedAt = ref('')
const sysInfo = ref<SystemInfo | null>(null)

const dbStatus = computed(() => health.value?.info?.database?.status ?? 'unknown')
const redisStatus = computed(() => health.value?.info?.redis?.status ?? 'unknown')
const heapStatus = computed(() => health.value?.info?.memory_heap?.status ?? 'unknown')
const rssStatus = computed(() => health.value?.info?.memory_rss?.status ?? 'unknown')

async function fetchHealth() {
  healthLoading.value = true
  queuesLoading.value = true
  try {
    const [hRes, qRes] = await Promise.allSettled([
      healthApi.get(),
      healthApi.getQueues(),
    ])

    if (hRes.status === 'fulfilled') {
      health.value = hRes.value.data
    }
    else {
      // 503 ServiceUnavailableException — body is in error response
      const errData = (hRes.reason as any)?.response?.data
      if (errData?.info) {
        health.value = errData as HealthStatus
      }
    }

    if (qRes.status === 'fulfilled') {
      queues.value = qRes.value.data
    }

    // system info
    try {
      const sysRes = await healthApi.getSystem()
      sysInfo.value = sysRes.data
    }
    catch { /* non-critical */ }

    healthUpdatedAt.value = new Date().toLocaleTimeString('zh-CN')
  }
  catch (e) {
    console.error('health error', e)
  }
  finally {
    healthLoading.value = false
    queuesLoading.value = false
  }
}

// ── 最新公告 ─────────────────────────────────────────────────────────────────
const notifications = ref<Notification[]>([])
const notifLoading = ref(false)
const notifError = ref(false)

async function fetchNotifications() {
  notifLoading.value = true
  notifError.value = false
  try {
    const res = await notificationsApi.list({ page: 1, perPage: 3 })
    notifications.value = res.data.items
  }
  catch (e) {
    notifError.value = true
    console.error('notifications error', e)
  }
  finally {
    notifLoading.value = false
  }
}

function formatTime(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── 初始化 ───────────────────────────────────────────────────────────────────
onMounted(() => {
  fetchStat()
  fetchHealth()
  fetchJudgers()
  fetchJudgeStats()
  fetchFailedJobs()
  fetchNotifications()
})

useHead({ title: '控制台' })
</script>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-5, 20px);
  min-width: 0;
  color: var(--lv-color-text, #1c2730);
}

.dashboard-header {
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-1, 4px);
  margin-bottom: 0;
}

.dashboard-header :deep(h2) {
  color: var(--lv-color-text, #1c2730);
  font-size: var(--lv-size-title, 24px);
  line-height: 1.25;
  letter-spacing: -0.025em;
}

.stat-card { height: 100%; }
.stat-card :deep(.n-statistic .n-statistic__label) {
  color: var(--lv-color-text-secondary, #596875);
  font-size: var(--lv-size-meta, 13px);
}
.stat-card :deep(.n-statistic-value__content) { font-variant-numeric: tabular-nums; }
.section-card { width: 100%; }
.section-title { color: var(--lv-color-text, #1c2730); font-size: var(--lv-size-section, 18px); font-weight: 650; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: var(--lv-space-3, 12px); }
.queue-section { margin-top: 0; }
.queue-title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--lv-space-2, 8px); }
.notif-item { display: flex; flex-direction: column; gap: var(--lv-space-1, 4px); width: 100%; }
.notif-meta { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--lv-space-2, 8px); }
.notif-content {
  color: var(--lv-color-text-secondary, #596875);
  font-size: var(--lv-size-body, 15px);
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .admin-dashboard { gap: var(--lv-space-4, 16px); }
  .section-header { align-items: flex-start; }
  :deep(.n-descriptions .n-descriptions-table-content) { overflow-wrap: anywhere; }
  :deep(.n-card > .n-card__content) { padding: var(--lv-space-4, 16px); }
}
</style>
