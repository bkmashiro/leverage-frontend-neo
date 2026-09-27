<template>
  <div class="edit-profile-page">
    <NH2>编辑个人资料</NH2>

    <!-- 修改邮箱 -->
    <NCard title="基本信息" class="section-card">
      <NForm ref="infoFormRef" :model="infoForm" label-placement="top" style="max-width: 480px">
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="infoForm.email" placeholder="请输入邮箱" />
        </NFormItem>
      </NForm>
      <NButton type="primary" :loading="savingInfo" @click="handleSaveInfo">
        保存信息
      </NButton>
    </NCard>

    <!-- 修改密码 -->
    <NCard title="修改密码" class="section-card">
      <NForm ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-placement="top" style="max-width: 480px">
        <NFormItem label="当前密码" path="oldPassword">
          <NInput
            v-model:value="pwdForm.oldPassword"
            type="password"
            show-password-on="click"
            placeholder="请输入当前密码"
          />
        </NFormItem>
        <NFormItem label="新密码" path="newPassword">
          <NInput
            v-model:value="pwdForm.newPassword"
            type="password"
            show-password-on="click"
            placeholder="请输入新密码（至少6位）"
          />
        </NFormItem>
        <NFormItem label="确认新密码" path="confirmPassword">
          <NInput
            v-model:value="pwdForm.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="请再次输入新密码"
          />
        </NFormItem>
      </NForm>
      <NButton type="primary" :loading="savingPwd" @click="handleChangePassword">
        修改密码
      </NButton>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const authStore = useAuthStore()
const usersApi = useUsersApi()
const authApi = useAuthApi()
const message = useMessage()

const infoFormRef = ref()
const pwdFormRef = ref()
const savingInfo = ref(false)
const savingPwd = ref(false)

const infoForm = reactive({
  email: authStore.user?.email ?? '',
})

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== pwdForm.newPassword) {
          return new Error('两次输入的密码不一致')
        }
        return true
      },
      trigger: 'blur',
    },
  ],
}

async function handleSaveInfo() {
  if (!authStore.user) return
  savingInfo.value = true
  try {
    await usersApi.update(authStore.user.id, { email: infoForm.email })
    // 刷新用户信息
    await authStore.fetchProfile()
    message.success('信息更新成功')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '更新失败')
  }
  finally {
    savingInfo.value = false
  }
}

async function handleChangePassword() {
  try {
    await pwdFormRef.value?.validate()
  }
  catch {
    return
  }

  savingPwd.value = true
  try {
    if (!authStore.user?.id) throw new Error('profile unavailable')
    await authApi.changePassword(authStore.user.id, pwdForm.oldPassword, pwdForm.newPassword)
    message.success('密码修改成功，请重新登录')
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    // 登出并跳转
    setTimeout(() => {
      authStore.logout()
      navigateTo('/login')
    }, 1500)
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '密码修改失败')
  }
  finally {
    savingPwd.value = false
  }
}

useHead({ title: '编辑资料 — Leverage OJ' })
</script>

<style scoped>
.edit-profile-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 700px;
  margin: 0 auto;
}

.section-card {
  width: 100%;
}
</style>
