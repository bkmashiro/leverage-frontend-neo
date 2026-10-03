<template>
  <NLayoutHeader bordered style="padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 56px">
    <!-- 左侧 Logo -->
    <NButton text tag="a" href="/problems" style="font-size: 18px; font-weight: bold; color: #18a058">
      Leverage OJ
    </NButton>

    <!-- 中间：快捷导航 -->
    <div v-if="!isMobile" style="display: flex; align-items: center; gap: 4px">
      <NButton text size="small" tag="a" href="/compete" style="color: #666">竞技场</NButton>
      <NButton text size="small" tag="a" href="/compete/playground" style="color: #666">Playground</NButton>
      <NButton text size="small" tag="a" href="/ai" style="color: #666">AI 指南</NButton>
    </div>

    <!-- 桌面端：右侧用户区域 -->
    <div v-if="!isMobile" style="display: flex; align-items: center; gap: 12px">
      <template v-if="authStore.isLoggedIn">
        <!-- 用户名 -->
        <span style="font-size: 14px; color: #333">{{ authStore.user?.username }}</span>

        <!-- 角色 badge -->
        <NTag
          v-if="authStore.user?.role"
          :type="roleBadgeType"
          size="small"
          round
        >
          {{ roleLabel }}
        </NTag>

        <!-- 消息图标（带未读角标） -->
        <NBadge :value="unreadCount" :max="99" :show="unreadCount > 0" type="info">
          <NButton text style="font-size: 20px; line-height: 1" @click="navigateTo('/messages')">
            <NIcon><MailOutline /></NIcon>
          </NButton>
        </NBadge>
      </template>

      <template v-if="authStore.isLoggedIn">
        <!-- 登出按钮 -->
        <NButton size="small" @click="handleLogout">
          登出
        </NButton>
      </template>

      <template v-else>
        <NButton type="primary" size="small" @click="navigateTo('/login')">
          登录
        </NButton>
      </template>
    </div>

    <!-- 移动端菜单 -->
    <div v-else style="display: flex; align-items: center; gap: 4px">
      <!-- 汉堡菜单按钮 -->
      <NButton text @click="mobileMenuOpen = true">
        <NIcon :component="MenuOutline" size="24" />
      </NButton>

      <!-- 移动端抽屉菜单 -->
      <NDrawer v-model:show="mobileMenuOpen" :width="280" placement="right">
        <NDrawerContent title="菜单">
          <template v-if="authStore.isLoggedIn">
            <!-- 用户信息 -->
            <div class="mobile-user-info">
              <div class="mobile-username">{{ authStore.user?.username }}</div>
              <NTag
                v-if="authStore.user?.role"
                :type="roleBadgeType"
                size="small"
                round
              >
                {{ roleLabel }}
              </NTag>
            </div>

            <NDivider style="margin: 12px 0" />

            <!-- 导航链接 -->
            <div class="mobile-nav">
              <NButton
                text
                block
                class="mobile-nav-item"
                @click="navigateTo('/problems'); mobileMenuOpen = false"
              >
                题目列表
              </NButton>
              <NButton
                text
                block
                class="mobile-nav-item"
                @click="navigateTo('/messages'); mobileMenuOpen = false"
              >
                <template #icon>
                  <NBadge :value="unreadCount" :max="99" :show="unreadCount > 0" :offset="[6, -4]" type="info">
                    <NIcon><MailOutline /></NIcon>
                  </NBadge>
                </template>
                消息
              </NButton>
            </div>

            <NDivider style="margin: 12px 0" />

            <NButton block @click="handleLogout">
              登出
            </NButton>
          </template>

          <template v-else>
            <NButton type="primary" block @click="navigateTo('/login'); mobileMenuOpen = false">
              登录
            </NButton>
          </template>
        </NDrawerContent>
      </NDrawer>
    </div>
  </NLayoutHeader>
</template>

<script setup lang="ts">
import { MailOutline, MenuOutline } from '@vicons/ionicons5'

const authStore = useAuthStore()
const msgApi = useMessageApi()

// 响应式移动端检测
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

const mobileMenuOpen = ref(false)
const unreadCount = ref(0)

async function fetchUnreadCount() {
  if (!authStore.isLoggedIn) return
  try {
    const res = await msgApi.getUnreadCount()
    const data = (res as any).data ?? res
    unreadCount.value = data.count ?? 0
  }
  catch {
    // ignore
  }
}

// Poll every 60 seconds
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  fetchUnreadCount()
  timer = setInterval(fetchUnreadCount, 60_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const roleLabel = computed(() => {
  const roleMap: Record<string, string> = {
    sa: '超级管理员',
    admin: '管理员',
    supervisor: '监督员',
    user: '用户',
    guest: '访客',
  }
  return roleMap[authStore.user?.role ?? ''] ?? authStore.user?.role ?? ''
})

const roleBadgeType = computed((): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  const typeMap: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    sa: 'error',
    admin: 'warning',
    supervisor: 'info',
    user: 'success',
    guest: 'default',
  }
  return typeMap[authStore.user?.role ?? ''] ?? 'default'
})

function handleLogout() {
  authStore.logout()
  navigateTo('/login')
}
</script>

<style scoped>
.mobile-user-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.mobile-username {
  font-size: 16px;
  font-weight: 600;
}

.mobile-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-nav-item {
  justify-content: flex-start !important;
  padding: 8px 4px;
  font-size: 15px;
}
</style>
