<template>
  <div class="sus-detail">
    <div class="page-header">
      <NSpace align="center">
        <NButton text @click="navigateTo('/admin/submissions/sus')">
          ← 返回列表
        </NButton>
        <NH2 style="margin: 0">
          抄袭详情 — {{ hashsum.slice(0, 8) }}
        </NH2>
      </NSpace>
      <NSpace>
        <NButton type="error" :loading="banningAll" @click="showBanModal = true">
          批量封禁本组用户
        </NButton>
        <NButton type="warning" :loading="checkingAll" @click="markAllChecked">
          全部标记为已审查
        </NButton>
      </NSpace>
    </div>

    <NModal
      v-model:show="showBanModal"
      preset="dialog"
      title="批量封禁本组用户"
      positive-text="确认封禁"
      negative-text="取消"
      :loading="banningAll"
      @positive-click="handleBatchBan"
    >
      <NInput
        v-model:value="banReason"
        type="textarea"
        placeholder="请输入封禁原因"
        :rows="3"
      />
    </NModal>

    <NSpin :show="loading">
      <div v-if="!loading && submissions.length === 0">
        <NEmpty description="暂无相关提交" />
      </div>

      <div v-for="sub in submissions" :key="sub.submissionId ?? sub.id" class="sub-card">
        <NCard :title="`提交 #${sub.submissionId ?? sub.id} — 用户: ${sub.submission?.user?.username ?? sub.user?.username ?? sub.submission?.userId ?? '-'}`" size="small">
          <template #header-extra>
            <NSpace align="center">
              <StatusTag :status="sub.status" />
              <NSwitch
                :value="!!sub.checked"
                :loading="sub._loading"
                @update:value="(v: boolean) => toggleChecked(sub, v)"
              >
                <template #checked>已审查</template>
                <template #unchecked>未审查</template>
              </NSwitch>
            </NSpace>
          </template>
          <template #default>
            <NTag size="small" :bordered="false" style="margin-bottom: 8px">
              {{ LANGUAGE_LABEL[sub.submission?.language ?? sub.language] ?? sub.submission?.language ?? sub.language ?? '未知语言' }}
            </NTag>
            <CodeEditor
              :model-value="sub.submission?.misc?.code ?? sub.code ?? '// 暂无代码'"
              :language="ojEditorLanguage(sub.submission?.language ?? sub.language ?? '')"
              :readonly="true"
              height="300px"
            />
          </template>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NInput, useMessage } from 'naive-ui'
import { LANGUAGE_LABEL, ojEditorLanguage } from '~/types'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const message = useMessage()
const suspicionsApi = useSuspicionsApi()
const usersApi = useUsersApi()

const hashsum = computed(() => route.params.hashsum as string)
const submissions = ref<any[]>([])
const loading = ref(false)
const checkingAll = ref(false)
const showBanModal = ref(false)
const banReason = ref('')
const banningAll = ref(false)

async function fetchDetail() {
  loading.value = true
  try {
    const res = await suspicionsApi.get(hashsum.value)
    submissions.value = (Array.isArray(res.data) ? res.data : res.data.items ?? []).map((s: any) => ({
      ...s,
      _loading: false,
    }))
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

async function toggleChecked(sub: any, value: boolean) {
  sub._loading = true
  try {
    const sid = sub.submissionId ?? sub.id
    await suspicionsApi.markChecked(sid, value)
    sub.checked = value
    message.success('已更新')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '操作失败')
  }
  finally {
    sub._loading = false
  }
}

async function markAllChecked() {
  checkingAll.value = true
  try {
    for (const sub of submissions.value) {
      if (!sub.checked) {
        const sid = sub.submissionId ?? sub.id
        await suspicionsApi.markChecked(sid, true)
        sub.checked = true
      }
    }
    message.success('全部标记完成')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '操作失败')
  }
  finally {
    checkingAll.value = false
  }
}

async function handleBatchBan() {
  const userIds = [...new Set(submissions.value.map(sub => sub.submission?.userId ?? sub.userId).filter(Boolean))]
  if (userIds.length === 0) {
    message.warning('未找到可封禁的用户')
    return false
  }
  banningAll.value = true
  try {
    await Promise.all(userIds.map(uid => usersApi.update(uid, { status: 2, remarks: banReason.value })))
    message.success(`已封禁 ${userIds.length} 人`)
    showBanModal.value = false
    banReason.value = ''
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '封禁失败')
    return false
  }
  finally {
    banningAll.value = false
  }
}

onMounted(fetchDetail)

useHead({ title: '可疑代码' })
</script>

<style scoped>
.sus-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-card {
  margin-bottom: 16px;
}
</style>
