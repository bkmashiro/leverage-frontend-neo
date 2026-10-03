<template>
  <main class="home-page" aria-labelledby="home-title">
    <header class="page-intro">
      <p class="eyebrow">LEVERAGE OJ</p>
      <h1 id="home-title">今天，想从哪里开始？</h1>
      <p class="intro-copy">练习、对战或系统学习，选择适合现在的下一步。</p>
    </header>

    <nav class="quick-actions" aria-label="常用记录与竞赛入口">
      <NuxtLink to="/submissions">提交记录</NuxtLink>
      <NuxtLink to="/contests">竞赛列表</NuxtLink>
      <NuxtLink to="/ranklist">排行榜</NuxtLink>
    </nav>

    <section class="task-section" aria-label="开始学习与练习">
      <NuxtLink class="task-card task-card-primary" to="/problems">
        <span class="task-number">01 · 练习</span>
        <span class="task-title">题库练习</span>
        <span class="task-description">从题目列表挑选一道题，开始编码与提交。</span>
        <span class="task-action">浏览题目 <NIcon size="18"><ArrowForwardOutline /></NIcon></span>
      </NuxtLink>
      <NuxtLink class="task-card" to="/compete">
        <span class="task-number">02 · 实战</span>
        <span class="task-title">Bot 对战</span>
        <span class="task-description">浏览可用游戏，创建房间或查看对局。</span>
        <span class="task-action">进入对战 <NIcon size="18"><ArrowForwardOutline /></NIcon></span>
      </NuxtLink>
      <NuxtLink class="task-card" to="/compete/learn">
        <span class="task-number">03 · 学习</span>
        <span class="task-title">学习中心</span>
        <span class="task-description">阅读教程，了解 Bot 开发与对战流程。</span>
        <span class="task-action">打开学习中心 <NIcon size="18"><ArrowForwardOutline /></NIcon></span>
      </NuxtLink>
    </section>

    <section class="info-grid" aria-label="平台信息">
      <section class="surface announcement" aria-labelledby="announcement-title" aria-live="polite">
        <div class="section-heading"><div class="heading-with-icon"><NIcon size="19"><MegaphoneOutline /></NIcon><h2 id="announcement-title">全站公告</h2></div></div>
        <p v-if="announcementLoading" class="state-copy" role="status">公告加载中…</p>
        <p v-else-if="announcementError" class="state-copy error-copy" role="status">公告暂时无法加载。</p>
        <p v-else-if="siteAnnouncement" class="announcement-copy">{{ siteAnnouncement }}</p>
        <p v-else class="state-copy">暂无公告</p>
      </section>

      <section class="surface stats-panel" aria-labelledby="stats-title" aria-live="polite">
        <div class="section-heading"><div class="heading-with-icon"><NIcon size="19"><BarChartOutline /></NIcon><h2 id="stats-title">平台概况</h2></div></div>
        <p v-if="statsLoading" class="state-copy" role="status">平台数据加载中…</p>
        <p v-else-if="!canViewStats" class="state-copy">平台概况仅向管理人员开放。</p>
        <p v-else-if="statsError" class="state-copy error-copy" role="status">平台数据暂时无法加载。</p>
        <dl v-else class="stats-list">
          <div v-for="stat in statItems" :key="stat.label" class="stat-item"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div>
        </dl>
      </section>

      <section class="surface updates-panel" aria-labelledby="updates-title" aria-live="polite">
        <div class="section-heading">
          <div class="heading-with-icon"><NIcon size="19"><NotificationsOutline /></NIcon><h2 id="updates-title">最新通知</h2></div>
          <NuxtLink to="/notification" class="text-link">全部通知 <NIcon size="15"><ArrowForwardOutline /></NIcon></NuxtLink>
        </div>
        <p v-if="notificationsLoading" class="state-copy" role="status">通知加载中…</p>
        <div v-else-if="notificationsError" class="state-row">
          <p class="state-copy error-copy" role="status">通知暂时无法加载。</p>
          <button class="retry-button" type="button" @click="loadNotifications">重试</button>
        </div>
        <NEmpty v-else-if="notifications.length === 0" description="暂无通知" class="empty-state" />
        <ul v-else class="notification-list">
          <li v-for="notification in notifications" :key="notification.id">
            <NuxtLink to="/notification" class="notification-link">
              <span class="notification-title">{{ notification.title }}</span>
              <time v-if="notification.createdAt" :datetime="notification.createdAt">{{ formatDate(notification.createdAt) }}</time>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { StatResult } from '~/composables/api/statistics'
import type { Notification } from '~/composables/api/notifications'
import { ArrowForwardOutline, BarChartOutline, MegaphoneOutline, NotificationsOutline } from '@vicons/ionicons5'
import dayjs from 'dayjs'

definePageMeta({ layout: 'default' })

const authStore = useAuthStore()
const statisticsApi = useStatisticsApi()
const notificationsApi = useNotificationsApi()
const settingsApi = useSettingsApi()

const canViewStats = computed(() => authStore.isSupervisor)
const stats = ref<StatResult | null>(null)
const notifications = ref<Notification[]>([])
const siteAnnouncement = ref('')
const statsLoading = ref(false)
const statsError = ref(false)
const announcementLoading = ref(true)
const announcementError = ref(false)
const notificationsLoading = ref(true)
const notificationsError = ref(false)

const statItems = computed(() => [
  { label: '题目', value: stats.value?.problem ?? '—' },
  { label: '用户', value: stats.value?.user ?? '—' },
  { label: '提交', value: stats.value?.submission ?? '—' },
  { label: '竞赛', value: stats.value?.contest ?? '—' },
])

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

async function loadStatistics() {
  statsLoading.value = true
  statsError.value = false
  try {
    const res = await statisticsApi.get()
    stats.value = res.data
  }
  catch {
    statsError.value = true
  }
  finally {
    statsLoading.value = false
  }
}

async function loadAnnouncement() {
  announcementLoading.value = true
  announcementError.value = false
  try {
    const res = await settingsApi.get('site.announcement')
    siteAnnouncement.value = res.data?.valueString?.trim() || ''
  }
  catch {
    announcementError.value = true
  }
  finally {
    announcementLoading.value = false
  }
}

async function loadNotifications() {
  notificationsLoading.value = true
  notificationsError.value = false
  try {
    const res = await notificationsApi.list({ page: 1, perPage: 5 })
    notifications.value = res.data.items ?? []
  }
  catch {
    notificationsError.value = true
  }
  finally {
    notificationsLoading.value = false
  }
}

onMounted(() => {
  if (canViewStats.value) void loadStatistics()
  void loadAnnouncement()
  void loadNotifications()
})

useHead({ title: '首页 — Leverage OJ' })
</script>

<style scoped>
.home-page { display: flex; flex-direction: column; gap: var(--lv-space-6, 32px); width: min(100%, var(--lv-width-workspace, 1200px)); margin-inline: auto; color: var(--lv-color-text, #202a35); font-family: var(--lv-font-ui, inherit); font-size: var(--lv-size-body, 16px); }
.page-intro { padding: var(--lv-space-2, 8px) 0 0; }
.quick-actions { display: flex; flex-wrap: wrap; gap: var(--lv-space-4, 16px); }
.quick-actions a { color: var(--lv-color-accent, #426b96); font-size: 14px; text-underline-offset: 3px; }
.eyebrow { margin: 0 0 var(--lv-space-2, 8px); color: var(--lv-color-text-secondary, #526170); font-size: var(--lv-size-meta, 14px); font-weight: 650; letter-spacing: .06em; }
h1 { margin: 0; font-size: var(--lv-size-title, clamp(25px, 3vw, 32px)); line-height: 1.3; font-weight: 700; }
.intro-copy { margin: var(--lv-space-2, 8px) 0 0; color: var(--lv-color-text-secondary, #526170); line-height: 1.6; }
.task-section { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--lv-space-3, 16px); }
.task-card { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; min-height: 214px; padding: var(--lv-space-5, 24px); border: 1px solid var(--lv-color-border, #dce3ea); border-radius: var(--lv-radius-lg, 12px); background: var(--lv-color-surface, #fff); color: inherit; text-decoration: none; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
.task-card:hover { transform: translateY(-2px); border-color: var(--lv-color-accent, #426b96); }
.task-card:focus-visible, .text-link:focus-visible, .notification-link:focus-visible, .retry-button:focus-visible { outline: 3px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }
.task-card-primary { border-color: var(--lv-color-accent, #426b96); background: var(--lv-color-accent-soft, #f0f5fa); }
.task-number { color: var(--lv-color-text-secondary, #526170); font-size: var(--lv-size-meta, 14px); font-weight: 600; }
.task-title { margin-top: var(--lv-space-3, 16px); font-size: var(--lv-size-section, 20px); line-height: 1.35; font-weight: 700; }
.task-description { margin-top: var(--lv-space-2, 8px); color: var(--lv-color-text-secondary, #526170); line-height: 1.55; }
.task-action { display: inline-flex; align-items: center; gap: var(--lv-space-1, 4px); margin-top: auto; padding-top: var(--lv-space-4, 20px); color: var(--lv-color-accent, #426b96); font-weight: 650; }
.info-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: var(--lv-space-3, 16px); align-items: start; }
.surface { min-width: 0; padding: var(--lv-space-4, 20px); border: 1px solid var(--lv-color-border, #dce3ea); border-radius: var(--lv-radius-md, 10px); background: var(--lv-color-surface, #fff); }
.updates-panel { grid-column: 1 / -1; }
.section-heading { display: flex; justify-content: space-between; align-items: center; gap: var(--lv-space-2, 8px); margin-bottom: var(--lv-space-3, 16px); }
.heading-with-icon { display: flex; align-items: center; gap: var(--lv-space-2, 8px); color: var(--lv-color-accent, #426b96); }
h2 { margin: 0; color: var(--lv-color-text, #202a35); font-size: var(--lv-size-section, 19px); line-height: 1.4; }
.state-copy { margin: 0; color: var(--lv-color-text-secondary, #526170); line-height: 1.6; }
.error-copy { color: var(--lv-color-error, #a13b36); }
.announcement-copy { margin: 0; white-space: pre-wrap; line-height: 1.7; overflow-wrap: anywhere; }
.stats-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--lv-space-2, 8px); margin: 0; }
.stat-item { min-width: 0; padding: var(--lv-space-2, 8px); border-radius: var(--lv-radius-sm, 6px); background: var(--lv-color-canvas, #f6f8fa); }
.stat-item dt { color: var(--lv-color-text-secondary, #526170); font-size: var(--lv-size-meta, 14px); }
.stat-item dd { margin: var(--lv-space-1, 4px) 0 0; font-size: 22px; line-height: 1.3; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-link { display: inline-flex; align-items: center; gap: 2px; flex: none; color: var(--lv-color-accent, #426b96); text-decoration: none; font-size: var(--lv-size-meta, 14px); }
.text-link:hover { text-decoration: underline; }
.notification-list { display: flex; flex-direction: column; gap: var(--lv-space-2, 8px); margin: 0; padding: 0; list-style: none; }
.notification-link { display: flex; align-items: center; justify-content: space-between; gap: var(--lv-space-3, 16px); min-width: 0; padding: var(--lv-space-3, 16px); border: 1px solid var(--lv-color-border, #dce3ea); border-radius: var(--lv-radius-sm, 6px); color: inherit; text-decoration: none; }
.notification-link:hover { background: var(--lv-color-accent-soft, #f0f5fa); }
.notification-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
time { flex: none; color: var(--lv-color-text-secondary, #526170); font: var(--lv-size-meta, 14px)/1.4 var(--lv-font-code, ui-monospace, monospace); }
.state-row { display: flex; align-items: center; justify-content: space-between; gap: var(--lv-space-3, 16px); }
.retry-button { border: 0; padding: var(--lv-space-1, 4px) var(--lv-space-2, 8px); background: transparent; color: var(--lv-color-accent, #426b96); font: inherit; cursor: pointer; }
.empty-state { padding: var(--lv-space-4, 20px) 0; }
@media (max-width: 760px) {
  .home-page { gap: var(--lv-space-5, 24px); }
  .task-section { grid-template-columns: 1fr; }
  .task-card { min-height: 0; }
  .task-action { padding-top: var(--lv-space-3, 16px); }
  .info-grid { grid-template-columns: 1fr; }
  .updates-panel { grid-column: auto; }
}
@media (max-width: 430px) {
  .stats-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .surface { padding: var(--lv-space-3, 16px); }
  .notification-link { align-items: flex-start; flex-direction: column; gap: var(--lv-space-1, 4px); }
}
@media (prefers-reduced-motion: reduce) { .task-card { transition: none; } }
</style>
