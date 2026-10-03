<template>
  <NMessageProvider>
    <NDialogProvider>
      <NNotificationProvider>
        <NLayout has-sider class="admin-shell">
          <NLayoutSider
            class="admin-desktop-sider"
            :collapsed="uiStore.sidebarCollapsed"
            collapse-mode="width"
            :collapsed-width="68"
            :width="248"
            show-trigger
            bordered
            @collapse="uiStore.toggleSidebar"
            @expand="uiStore.toggleSidebar"
          >
            <div class="admin-brand">
              <span class="brand-mark" aria-hidden="true">L</span>
              <span v-if="!uiStore.sidebarCollapsed" class="brand-name">Leverage <span>管理</span></span>
            </div>
            <nav aria-label="管理导航">
              <NMenu :collapsed="uiStore.sidebarCollapsed" :collapsed-width="68" :collapsed-icon-size="20" :options="adminMenuOptions" :value="activeKey" />
            </nav>
          </NLayoutSider>

          <NLayout class="admin-workspace">
            <NLayoutHeader bordered class="admin-topbar">
              <div class="topbar-leading">
                <NButton class="mobile-nav-trigger" quaternary circle aria-label="打开管理导航" aria-controls="admin-mobile-navigation" :aria-expanded="drawerOpen" @click="drawerOpen = true">
                  <template #icon><NIcon><MenuOutline /></NIcon></template>
                </NButton>
                <NBreadcrumb>
                  <NBreadcrumbItem><NButton text @click="navigateTo('/')">首页</NButton></NBreadcrumbItem>
                  <NBreadcrumbItem>管理后台</NBreadcrumbItem>
                </NBreadcrumb>
              </div>
              <div class="topbar-actions">
                <NButton quaternary class="desktop-home-link" @click="navigateTo('/')">返回前台</NButton>
                <NDropdown v-if="authStore.isLoggedIn" :options="userMenuOptions" @select="handleUserMenuSelect">
                  <NButton text class="account-button" aria-label="账户菜单">
                    <span class="account-name">{{ authStore.user?.username }}</span>
                    <NTag size="small" :bordered="false">{{ authStore.user?.role }}</NTag>
                  </NButton>
                </NDropdown>
              </div>
            </NLayoutHeader>

            <NLayoutContent class="admin-content"><slot /></NLayoutContent>
          </NLayout>

          <NDrawer v-model:show="drawerOpen" class="admin-mobile-drawer" placement="left" :width="320" :trap-focus="true" :auto-focus="true" :close-on-esc="true" aria-label="管理导航">
            <NDrawerContent title="管理导航" closable>
              <nav id="admin-mobile-navigation" aria-label="管理导航">
                <NMenu :options="adminMenuOptions" :value="activeKey" />
              </nav>
              <div class="drawer-footer">
                <NButton block quaternary @click="goHome">返回前台</NButton>
                <NButton v-if="authStore.isLoggedIn" block quaternary @click="logout">退出登录</NButton>
              </div>
            </NDrawerContent>
          </NDrawer>
        </NLayout>
      </NNotificationProvider>
    </NDialogProvider>
  </NMessageProvider>
</template>

<script setup lang="ts">
import { renderIcon } from '~/utils/naive'
import {
  PeopleOutline, CodeSlashOutline, TrophyOutline, SchoolOutline, HomeOutline, LogOutOutline,
  DocumentTextOutline, RefreshOutline, SettingsOutline, NotificationsOutline, PricetagsOutline,
  LibraryOutline, BriefcaseOutline, ListOutline, ServerOutline, GameControllerOutline, MenuOutline,
} from '@vicons/ionicons5'

useHead({ titleTemplate: (s) => s ? `${s} — Leverage OJ 管理后台` : 'Leverage OJ 管理后台' })

const authStore = useAuthStore()
const uiStore = useUiStore()
const route = useRoute()
const drawerOpen = ref(false)
const activeKey = computed(() => route.name as string)

function openRoute(path: string) {
  drawerOpen.value = false
  return navigateTo(path)
}

const adminMenuOptions = [
  { label: '仪表板', key: 'admin', icon: renderIcon(HomeOutline), onClick: () => openRoute('/admin') },
  { label: '用户管理', key: 'admin-users', icon: renderIcon(PeopleOutline), onClick: () => openRoute('/admin/users') },
  { label: '题目管理', key: 'admin-problems', icon: renderIcon(CodeSlashOutline), onClick: () => openRoute('/admin/problems') },
  { label: '竞赛管理', key: 'admin-contests', icon: renderIcon(TrophyOutline), onClick: () => openRoute('/admin/contests') },
  { label: '课程管理', key: 'admin-courses', icon: renderIcon(SchoolOutline), onClick: () => openRoute('/admin/courses') },
  {
    label: '提交管理', key: 'admin-submissions', icon: renderIcon(DocumentTextOutline),
    children: [
      { label: '全部提交', key: 'admin-submissions', onClick: () => openRoute('/admin/submissions') },
      { label: '抄袭检测', key: 'admin-submissions-sus', onClick: () => openRoute('/admin/submissions/sus') },
      { label: '最近可疑', key: 'admin-submissions-sus-recent', onClick: () => openRoute('/admin/submissions/sus/recent') },
      { label: '用户统计', key: 'admin-submissions-sus-union', onClick: () => openRoute('/admin/submissions/sus/union') },
    ],
  },
  {
    label: '重判', key: 'admin-rejudge', icon: renderIcon(RefreshOutline),
    children: [
      { label: '批量重判', key: 'admin-rejudge-index', onClick: () => openRoute('/admin/rejudge') },
      { label: '重评测记录', key: 'admin-rejudge-log', onClick: () => openRoute('/admin/rejudge/log') },
    ],
  },
  { label: 'Bot 对战管理', key: 'admin-compete', icon: renderIcon(GameControllerOutline), onClick: () => openRoute('/admin/compete') },
  { label: '标签管理', key: 'admin-tags', icon: renderIcon(PricetagsOutline), onClick: () => openRoute('/admin/tags') },
  { label: '学院管理', key: 'admin-colleges', icon: renderIcon(LibraryOutline), onClick: () => openRoute('/admin/colleges') },
  { label: '专业管理', key: 'admin-professions', icon: renderIcon(BriefcaseOutline), onClick: () => openRoute('/admin/professions') },
  { label: '通知管理', key: 'admin-notifications', icon: renderIcon(NotificationsOutline), onClick: () => openRoute('/admin/notifications') },
  { label: '系统设置', key: 'admin-setting', icon: renderIcon(SettingsOutline), onClick: () => openRoute('/admin/setting') },
  { label: '系统日志', key: 'admin-log', icon: renderIcon(ListOutline), onClick: () => openRoute('/admin/log') },
  { label: '系统任务', key: 'admin-task', icon: renderIcon(ServerOutline), onClick: () => openRoute('/admin/task') },
]

const userMenuOptions = [
  { label: '返回前台', key: 'home', icon: renderIcon(HomeOutline) },
  { label: '退出登录', key: 'logout', icon: renderIcon(LogOutOutline) },
]

watch(() => route.fullPath, () => { drawerOpen.value = false })

function goHome() {
  drawerOpen.value = false
  return navigateTo('/')
}

function logout() {
  authStore.logout()
  return navigateTo('/login')
}

function handleUserMenuSelect(key: string) {
  if (key === 'home') goHome()
  if (key === 'logout') logout()
}
</script>

<style scoped>
.admin-shell { min-height: 100vh; background: var(--lv-color-canvas); }
.admin-desktop-sider { background: var(--lv-color-surface); }
.admin-brand {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--lv-space-3);
  border-bottom: 1px solid var(--lv-color-border);
  color: var(--lv-color-text);
  font-size: var(--lv-size-section);
  font-weight: 650;
  letter-spacing: -0.02em;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--lv-color-accent);
  color: white;
  font-size: var(--lv-size-body);
  font-weight: 700;
}
.brand-name span { color: var(--lv-color-text-secondary); font-weight: 500; }
.admin-workspace { min-width: 0; background: var(--lv-color-canvas); }
.admin-topbar {
  position: sticky;
  z-index: 10;
  top: 0;
  height: 64px;
  padding: 0 var(--lv-space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--lv-color-surface);
}
.topbar-leading, .topbar-actions, .account-button { display: flex; align-items: center; gap: var(--lv-space-3); }
.mobile-nav-trigger { display: none; }
.account-name { max-width: 18ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-content { min-width: 0; padding: var(--lv-space-7); color: var(--lv-color-text); }
.admin-mobile-drawer { max-width: 88vw; }
.drawer-footer { display: grid; gap: var(--lv-space-2); margin-top: var(--lv-space-6); padding-top: var(--lv-space-4); border-top: 1px solid var(--lv-color-border); }
@media (max-width: 860px) {
  .admin-desktop-sider { display: none; }
  .mobile-nav-trigger { display: inline-flex; }
  .admin-topbar { height: 58px; padding: 0 var(--lv-space-3); }
  .admin-content { padding: var(--lv-space-4); }
  .desktop-home-link { display: none; }
  .topbar-leading, .topbar-actions, .account-button { gap: var(--lv-space-2); }
}
@media (max-width: 420px) {
  .admin-content { padding: var(--lv-space-3); }
  .account-name { max-width: 10ch; }
}
</style>
