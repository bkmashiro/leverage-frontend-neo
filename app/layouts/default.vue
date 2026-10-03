<template>
  <NMessageProvider>
    <NDialogProvider>
      <NNotificationProvider>
        <NLoadingBarProvider>
          <NLayout has-sider class="app-layout">
            <NLayoutSider
              class="desktop-sider"
              :collapsed="uiStore.sidebarCollapsed"
              collapse-mode="width"
              :collapsed-width="64"
              :width="220"
              show-trigger
              bordered
              @collapse="uiStore.toggleSidebar"
              @expand="uiStore.toggleSidebar"
            >
              <NuxtLink to="/" class="logo-area" :class="{ collapsed: uiStore.sidebarCollapsed }" aria-label="Leverage OJ 首页">
                <div class="logo-main">
                  <span v-if="!uiStore.sidebarCollapsed" class="logo-text">Leverage OJ</span>
                  <span v-else class="logo-icon">OJ</span>
                </div>
                <div v-if="!uiStore.sidebarCollapsed" class="logo-version">v2.0</div>
              </NuxtLink>
              <NMenu
                :collapsed="uiStore.sidebarCollapsed"
                :collapsed-width="64"
                :collapsed-icon-size="22"
                :options="menuOptions"
                :value="activeKey"
              />
            </NLayoutSider>

            <NDrawer v-model:show="uiStore.mobileNavOpen" placement="left" :width="260">
              <NDrawerContent title="Leverage OJ" closable>
                <NMenu :options="menuOptions" :value="activeKey" @update:value="uiStore.closeMobileNav" />
              </NDrawerContent>
            </NDrawer>

            <NLayout class="main-layout">
              <NLayoutHeader bordered class="header-bar">
                <NButton class="mobile-menu-button" quaternary aria-label="打开导航菜单" :aria-expanded="uiStore.mobileNavOpen" @click="uiStore.mobileNavOpen = true">
                  <NIcon size="22"><MenuOutline /></NIcon>
                </NButton>
                <NBreadcrumb>
                  <NBreadcrumbItem>{{ currentRouteLabel }}</NBreadcrumbItem>
                </NBreadcrumb>

                <div class="header-right">
                  <nav v-if="authStore.isLoggedIn" class="header-inbox" aria-label="收件箱">
                    <NuxtLink to="/messages" class="header-icon-link" :aria-label="`消息${unreadMsgCount > 0 ? `，${unreadMsgCount} 条未读` : ''}`" title="消息">
                      <NBadge :value="unreadMsgCount" :max="99" :show="unreadMsgCount > 0" type="info">
                        <NIcon size="20"><ChatbubbleOutline /></NIcon>
                      </NBadge>
                    </NuxtLink>
                    <NuxtLink to="/notification" class="header-icon-link" :aria-label="`通知${unreadNotifCount > 0 ? `，${unreadNotifCount} 条未读` : ''}`" title="通知">
                      <NBadge :value="unreadNotifCount" :max="99" :show="unreadNotifCount > 0" type="info">
                        <NIcon size="20"><NotificationsOutline /></NIcon>
                      </NBadge>
                    </NuxtLink>
                  </nav>
                  <NDropdown
                    v-if="authStore.isLoggedIn"
                    :options="userMenuOptions"
                    @select="handleUserMenuSelect"
                  >
                    <NButton text class="user-trigger">
                      <NAvatar round size="small" :style="{ backgroundColor: avatarColor }">
                        {{ authStore.user?.username?.[0]?.toUpperCase() }}
                      </NAvatar>
                      <span class="username">{{ authStore.user?.username }}</span>
                      <NTag
                        size="small"
                        round
                        :bordered="false"
                        :type="roleTagType"
                      >
                        {{ roleLabel }}
                      </NTag>
                    </NButton>
                  </NDropdown>
                  <NButton v-else text @click="navigateTo('/login')">
                    登录
                  </NButton>
                </div>
              </NLayoutHeader>

              <NLayoutContent class="content-shell">
                <div class="content-inner">
                  <slot />
                </div>
              </NLayoutContent>
            </NLayout>
          </NLayout>
        </NLoadingBarProvider>
      </NNotificationProvider>
    </NDialogProvider>
  </NMessageProvider>
</template>

<script setup lang="ts">
import type { DropdownOption } from 'naive-ui'
import { renderIcon } from '~/utils/naive'
import {
  PersonOutline,
  CodeSlashOutline,
  TrophyOutline,
  SchoolOutline,
  SettingsOutline,
  LogOutOutline,
  HelpCircleOutline,
  ListOutline,
  PodiumOutline,
  ChatbubbleOutline,
  NotificationsOutline,
  GameControllerOutline,
  PulseOutline,
  KeyOutline,
  MenuOutline,
  BookOutline,
} from '@vicons/ionicons5'

const authStore = useAuthStore()
const uiStore = useUiStore()
const route = useRoute()
const notificationsApi = useNotificationsApi()
const msgApi = useMessageApi()

const unreadNotifCount = ref(0)
const unreadMsgCount = ref(0)
let unreadTimer: ReturnType<typeof setInterval> | null = null

const activeKey = computed(() => {
  if (route.path === '/compete/learn') return 'compete-learn'
  const root = route.path.split('/').filter(Boolean)[0]
  if (root === 'course') return 'courses'
  return root || (route.name as string)
})
watch(() => route.fullPath, () => uiStore.closeMobileNav())

const baseMenuOptions = [
  {
    label: '题目列表',
    key: 'problems',
    icon: renderIcon(CodeSlashOutline),
    onClick: () => navigateTo('/problems'),
  },
  {
    label: '竞赛',
    key: 'contests',
    icon: renderIcon(TrophyOutline),
    onClick: () => navigateTo('/contests'),
  },
  {
    label: '课程',
    key: 'courses',
    icon: renderIcon(SchoolOutline),
    onClick: () => navigateTo('/courses'),
  },
  {
    label: '提交记录',
    key: 'submissions',
    icon: renderIcon(ListOutline),
    onClick: () => navigateTo('/submissions'),
  },
  {
    label: '排行榜',
    key: 'ranklist',
    icon: renderIcon(PodiumOutline),
    onClick: () => navigateTo('/ranklist'),
  },
  {
    label: 'Bot 对战',
    key: 'compete',
    icon: renderIcon(GameControllerOutline),
    onClick: () => navigateTo('/compete'),
  },
  {
    label: 'Bot 学习中心',
    key: 'compete-learn',
    icon: renderIcon(BookOutline),
    onClick: () => navigateTo('/compete/learn'),
  },
  {
    label: '消息',
    key: 'messages',
    icon: renderIcon(ChatbubbleOutline),
    onClick: () => navigateTo('/messages'),
  },
  {
    label: '通知',
    key: 'notification',
    icon: renderIcon(NotificationsOutline),
    onClick: () => navigateTo('/notification'),
  },
  {
    label: '帮助',
    key: 'help',
    icon: renderIcon(HelpCircleOutline),
    onClick: () => navigateTo('/help'),
  },
  {
    label: '系统状态',
    key: 'status',
    icon: renderIcon(PulseOutline),
    onClick: () => navigateTo('/status'),
  },
]

const adminMenuOptions = [
  {
    label: '管理后台',
    key: 'admin',
    icon: renderIcon(SettingsOutline),
    onClick: () => navigateTo('/admin'),
  },
]

const menuOptions = computed(() => {
  if (authStore.isAdmin) {
    return [...baseMenuOptions, ...adminMenuOptions]
  }
  return baseMenuOptions
})

const routeLabelMap: Record<string, string> = {
  '/': '首页',
  '/home': '首页',
  '/problems': '题目列表',
  '/contests': '竞赛',
  '/courses': '课程',
  '/submissions': '提交记录',
  '/ranklist': '排行榜',
  '/messages': '消息',
  '/notification': '通知',
  '/help': '帮助',
  '/admin': '管理后台',
  '/compete': 'Bot 对战',
  '/compete/learn': 'Bot 学习中心',
  '/compete/playground': 'Bot 工作台',
  '/profile': '个人中心',
  '/settings': '设置',
  '/status': '系统状态',
  '/settings/api-keys': 'API 密钥',
}

const currentRouteLabel = computed(() => {
  const exact = routeLabelMap[route.path]
  if (exact) return exact
  const root = `/${route.path.split('/').filter(Boolean)[0] ?? ''}`
  return routeLabelMap[root] ?? '当前页面'
})

const roleLabel = computed(() => authStore.user?.role ?? 'user')

const roleTagType = computed(() => {
  if (authStore.user?.role === 'sa') return 'error'
  if (authStore.user?.role === 'admin') return 'warning'
  return 'info'
})

const avatarColor = computed(() => {
  const seed = authStore.user?.username ?? 'U'
  const palette = ['#2080f0', '#18a058', '#f0a020', '#d03050', '#7a5af8', '#009688']
  const hash = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return palette[hash % palette.length]
})

async function refreshUnreadCount() {
  if (!authStore.isLoggedIn) {
    unreadNotifCount.value = 0
    unreadMsgCount.value = 0
    return
  }
  try {
    const [notifRes, msgRes] = await Promise.all([
      notificationsApi.list({ read: false, perPage: 1 }),
      msgApi.getUnreadCount(),
    ])
    unreadNotifCount.value = Number((notifRes as any).data?.unreadCount ?? (notifRes as any).data?.total ?? 0)
    unreadMsgCount.value = Number((msgRes as any).data?.count ?? 0)
  }
  catch {
    unreadNotifCount.value = 0
    unreadMsgCount.value = 0
  }
}

onMounted(() => {
  refreshUnreadCount()
  unreadTimer = setInterval(refreshUnreadCount, 60 * 1000)
})

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer)
})

watch(() => authStore.isLoggedIn, refreshUnreadCount)

const userMenuOptions: DropdownOption[] = [
  {
    label: '个人主页',
    key: 'profile',
    icon: renderIcon(PersonOutline),
  },
  {
    label: 'API 密钥',
    key: 'api-keys',
    icon: renderIcon(KeyOutline),
  },
  {
    type: 'divider',
    key: 'd1',
  },
  {
    label: '退出登录',
    key: 'logout',
    icon: renderIcon(LogOutOutline),
  },
]

function handleUserMenuSelect(key: string) {
  if (key === 'logout') {
    authStore.logout()
    navigateTo('/login')
  }
  else if (key === 'profile') {
    navigateTo(`/users/${authStore.user?.id}`)
  }
  else if (key === 'api-keys') {
    navigateTo('/settings/api-keys')
  }
}
</script>

<style scoped>
.app-layout { min-height: 100vh; background: var(--lv-color-canvas); }
.main-layout, .content-shell { min-width: 0; background: var(--lv-color-canvas); }
.logo-area { height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--lv-space-1); border-bottom: 1px solid var(--lv-color-border); background: var(--lv-color-surface); text-decoration: none; }
.logo-area:focus-visible { outline: 2px solid var(--lv-color-accent); outline-offset: -3px; }
.logo-main { font-weight: 700; line-height: 1; }
.logo-text, .logo-icon { color: var(--lv-color-accent); }
.logo-text { letter-spacing: 0.3px; }
.logo-icon { font-size: 14px; }
.logo-version { font-size: var(--lv-size-meta); color: var(--lv-color-text-secondary); }
.logo-area.collapsed { height: 56px; }
.header-bar { min-height: 56px; padding: 0 var(--lv-space-5); display: flex; align-items: center; justify-content: space-between; background: var(--lv-color-surface); }
.header-right, .header-inbox { display: flex; align-items: center; }
.header-right { gap: var(--lv-space-4); }
.header-inbox { gap: var(--lv-space-1); }
.header-icon-link { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: var(--lv-radius-md); color: var(--lv-color-text-secondary); text-decoration: none; transition: background .15s, color .15s; }
.header-icon-link:hover, .header-icon-link:focus-visible, .header-icon-link.router-link-active { background: var(--lv-color-accent-soft); color: var(--lv-color-accent); }
.header-icon-link :deep(.n-badge-sup) { font-size: 10px; box-shadow: 0 0 0 2px var(--lv-color-surface); }
.user-trigger { display: flex; align-items: center; gap: var(--lv-space-2); border-radius: var(--lv-radius-md); padding: var(--lv-space-1) var(--lv-space-2); }
.user-trigger:hover { background: var(--lv-color-accent-soft); }
.username { max-width: 140px; overflow: hidden; color: var(--lv-color-text); text-overflow: ellipsis; white-space: nowrap; }
.content-shell { height: calc(100vh - 56px); overflow: auto; padding: var(--lv-space-6); }
.content-inner { width: 100%; max-width: var(--lv-width-workspace); margin: 0 auto; }
.mobile-menu-button { display: none; }
@media (max-width: 767px) {
  .desktop-sider { display: none; }
  .header-bar { gap: var(--lv-space-2); padding: 0 var(--lv-space-3); }
  .header-bar :deep(.n-breadcrumb) { flex: 1; min-width: 0; }
  .mobile-menu-button { display: inline-flex; flex: none; }
  .header-right { gap: var(--lv-space-1); }
  .header-inbox { gap: 0; }
  .header-icon-link { width: 34px; height: 38px; }
  .username, .user-trigger :deep(.n-tag) { display: none; }
  .content-shell { height: calc(100dvh - 56px); padding: var(--lv-space-4) var(--lv-space-3) var(--lv-space-7); }
}
</style>
