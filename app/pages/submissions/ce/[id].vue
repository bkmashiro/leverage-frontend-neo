<template>
  <section class="ce-container" aria-labelledby="ce-title">
    <header class="ce-header">
      <div>
        <h1 id="ce-title">编译错误</h1>
        <NText depth="3">提交 #{{ submissionId }}</NText>
      </div>
      <NuxtLink class="detail-link" :to="`/submissions/${submissionId}`">返回提交详情</NuxtLink>
    </header>

    <div v-if="loading" class="loading-center" aria-label="正在加载编译错误" aria-busy="true">
      <NSpin size="medium" />
    </div>
    <NResult
      v-else-if="error"
      :status="error.status"
      :title="error.title"
      :description="error.description"
    >
      <template v-if="error.retry" #footer>
        <NButton @click="loadDiagnostic">重试</NButton>
      </template>
    </NResult>
    <pre v-else-if="ceContent" class="compiler-output" role="region" aria-label="编译器输出" tabindex="0">{{ ceContent }}</pre>
    <NEmpty v-else description="未记录编译错误信息" />
  </section>
</template>

<script setup lang="ts">
import { isAxiosError } from 'axios'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const submissionId = computed(() => Number(route.params.id))
const submissionsApi = useSubmissionsApi()
const ceContent = ref('')
const loading = ref(true)
const error = ref<{ status: '403' | '404' | '500', title: string, description: string, retry: boolean } | null>(null)
let request: AbortController | undefined

async function loadDiagnostic() {
  request?.abort()
  const active = new AbortController()
  request = active
  loading.value = true
  ceContent.value = ''
  error.value = null
  try {
    const { data } = await submissionsApi.getCE(submissionId.value, active.signal)
    if (active.signal.aborted) return
    // Whitelist diagnostic fields. Never stringify submission/user metadata.
    const text = typeof data === 'string' ? data : data?.misc?.compileErrorMsg ?? data?.compileErrorMsg
    ceContent.value = typeof text === 'string' ? text : ''
  }
  catch (cause) {
    if (active.signal.aborted) return
    const status = isAxiosError(cause) ? cause.response?.status : undefined
    error.value = status === 401 || status === 403
      ? { status: '403', title: '无权查看', description: '只有提交者本人或管理员才能查看编译错误详情', retry: false }
      : status === 404
        ? { status: '404', title: '提交不存在', description: '该提交不存在或已被删除', retry: false }
        : { status: '500', title: '加载失败', description: '暂时无法获取编译错误，请重试', retry: true }
  }
  finally {
    if (!active.signal.aborted) loading.value = false
  }
}

watch(submissionId, loadDiagnostic, { immediate: true })
onBeforeUnmount(() => request?.abort())
useHead(computed(() => ({ title: `编译错误 #${submissionId.value} — Leverage OJ` })))
</script>

<style scoped>
.ce-container {
  width: 100%;
  max-width: 1000px;
  min-width: 0;
  margin: 0 auto;
}

.ce-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--lv-space-3);
  margin-bottom: var(--lv-space-4);
}

h1 {
  margin: 0 0 var(--lv-space-1);
  color: var(--lv-color-text);
  font-size: var(--lv-size-title);
  line-height: 1.4;
}

.detail-link {
  color: var(--lv-color-accent);
  text-underline-offset: 3px;
}

.loading-center {
  display: grid;
  place-items: center;
  min-height: 160px;
}

.compiler-output {
  margin: 0;
  padding: var(--lv-space-4);
  max-height: min(65vh, 640px);
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 4;
  border: 1px solid var(--lv-color-border);
  border-radius: var(--lv-radius-md);
  background: var(--lv-color-surface);
  color: var(--lv-color-text);
  font: var(--lv-size-code)/1.65 var(--lv-font-code);
}
</style>
