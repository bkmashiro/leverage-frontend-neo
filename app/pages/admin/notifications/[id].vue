<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { sanitizeHtml } from '../../../utils/sanitize-html'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const { getNotification, updateNotification } = useNotificationsApi()
const message = useMessage()

const id = Number(route.params.id)
const notification = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const activeTab = ref('content')

onMounted(async () => {
  try {
    const res = await getNotification(id)
    notification.value = res.data
  } catch {
    message.error('加载公告失败')
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!notification.value) return
  saving.value = true
  try {
    await updateNotification(id, {
      title: notification.value.title,
      content: notification.value.content,
    })
    message.success('公告已更新')
  } catch {
    message.error('更新失败')
  } finally {
    saving.value = false
  }
}

useHead({ title: '通知详情' })
</script>

<template>
  <div>
    <n-page-header title="编辑公告" @back="$router.push('/admin/notifications')" />
    <n-spin :show="loading">
      <n-card v-if="notification" style="margin-top: 16px">
        <n-form label-placement="top">
          <n-form-item label="标题">
            <n-input v-model:value="notification.title" placeholder="公告标题" />
          </n-form-item>
          <n-form-item label="内容">
            <n-tabs v-model:value="activeTab" type="card" style="width: 100%">
              <n-tab-pane name="content" tab="编辑">
                <n-input
                  v-model:value="notification.content"
                  type="textarea"
                  :rows="14"
                  placeholder="支持 Markdown 格式"
                />
              </n-tab-pane>
              <n-tab-pane name="preview" tab="Markdown 预览">
                <div class="markdown-preview" style="min-height: 200px; padding: 8px">
                  <span v-if="!notification.content" style="color: #999">暂无内容</span>
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div v-else v-html="sanitizeHtml(notification.content)" />
                </div>
              </n-tab-pane>
            </n-tabs>
          </n-form-item>
          <n-form-item>
            <n-button type="primary" :loading="saving" @click="save">保存更新</n-button>
          </n-form-item>
        </n-form>
      </n-card>
    </n-spin>
  </div>
</template>
