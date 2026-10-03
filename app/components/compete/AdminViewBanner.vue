<template>
  <NAlert
    v-if="authStore.isAdmin"
    type="warning"
    :show-icon="false"
    style="margin-bottom:12px"
  >
    <NSpace align="center" justify="space-between" :wrap="false">
      <NText>🛠 您正在以管理员身份访问用户视图</NText>
      <NButton size="small" type="warning" @click="navigateTo(adminPath)">
        前往管理页面 →
      </NButton>
    </NSpace>
  </NAlert>
</template>

<script setup lang="ts">
import { NAlert, NButton, NSpace, NText } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'

defineProps<{
  adminPath: string
}>()

const authStore = useAuthStore()
</script>
