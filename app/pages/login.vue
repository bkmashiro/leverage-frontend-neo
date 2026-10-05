<template>
  <div>
    <NForm ref="formRef" :model="form" :rules="rules" label-placement="top">
      <NFormItem label="用户名" path="username">
        <NInput
          v-model:value="form.username"
          placeholder="请输入用户名"
          :disabled="loading"
          @keydown.enter="handleLogin"
        >
          <template #prefix>
            <NIcon><PersonOutline /></NIcon>
          </template>
        </NInput>
      </NFormItem>
      <NFormItem label="密码" path="password">
        <NInput
          v-model:value="form.password"
          type="password"
          show-password-on="click"
          placeholder="请输入密码"
          :disabled="loading"
          @keydown.enter="handleLogin"
        >
          <template #prefix>
            <NIcon><LockClosedOutline /></NIcon>
          </template>
        </NInput>
      </NFormItem>
    </NForm>

    <NAlert v-if="error" type="error" style="margin-bottom: 16px">
      {{ error }}
    </NAlert>

    <NButton
      type="primary"
      block
      :loading="loading"
      @click="handleLogin"
    >
      登录
    </NButton>
    <NButton block quaternary style="margin-top: 10px" @click="navigateTo('/register')">
      没有账号？去注册
    </NButton>

    <NuxtLink to="/help" class="login-help-link">帮助与系统说明</NuxtLink>
    <div class="powered-by">Powered by Leverage OJ v2.0</div>
  </div>
</template>

<script setup lang="ts">
import { PersonOutline, LockClosedOutline } from '@vicons/ionicons5'

definePageMeta({
  layout: 'auth',
  middleware: 'auth',
})

const authStore = useAuthStore()
const router = useRouter()

const formRef = ref()
const loading = ref(false)
const error = ref('')

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  error.value = ''
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }

  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    router.push('/problems')
  }
  catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    error.value = err.response?.data?.message || '账号或密码错误，请重试'
  }
  finally {
    loading.value = false
  }
}

useHead({ title: '登录 — Leverage OJ' })
</script>

<style scoped>
.login-help-link {
  display: block;
  margin-top: 16px;
  text-align: center;
  color: #2080f0;
}

.powered-by {
  margin-top: 18px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}
</style>
