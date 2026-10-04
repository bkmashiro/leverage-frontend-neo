<template>
  <div v-if="loading" class="loading-center">
    <NSpin size="large" />
  </div>
  <div v-else-if="loadError" class="state-center">
    <NResult :status="loadForbidden ? '403' : '500'" :title="loadForbidden ? '暂时无法访问该题目' : '题目加载失败'" :description="loadError">
      <template #footer>
        <NButton v-if="!loadForbidden" type="primary" @click="loadPage">重试</NButton>
        <NButton v-else @click="navigateTo(`/courses/${courseId}`)">返回课程</NButton>
      </template>
    </NResult>
  </div>
  <div v-else-if="problem" class="problem-page">
    <!-- 左侧：题目信息 -->
    <div class="problem-left">
      <div class="problem-header">
        <div class="breadcrumb">
          <NButton text type="primary" @click="navigateTo(`/courses/${courseId}`)">
            返回课程
          </NButton>
          <span class="breadcrumb-sep"> / </span>
          <span>{{ problem.title }}</span>
        </div>
        <NH2 style="margin: 8px 0 0">{{ problem.prefix }}{{ problem.logicId }}. {{ problem.title }}</NH2>
        <div class="problem-meta">
          <NTag size="small" :bordered="false" type="info">
            时间限制: {{ problem.timeLimit }}ms
          </NTag>
          <NTag size="small" :bordered="false" type="warning">
            内存限制: {{ problem.memoryLimit }}MB
          </NTag>
        </div>
        <div v-if="problem.tags && problem.tags.length" class="problem-tags">
          <NTag
            v-for="tag in problem.tags"
            :key="tag.id"
            size="small"
            type="info"
            :bordered="false"
          >
            {{ tag.name }}
          </NTag>
        </div>
      </div>

      <NDivider />

      <MarkdownView :content="problem.content ?? problem.description ?? ''" />
    </div>

    <!-- 右侧：代码编辑器 + 提交 -->
    <div class="problem-right">
      <div class="editor-header">
        <NSelect
          v-model:value="language"
          :options="languageOptions"
          style="width: 160px"
        />
      </div>

      <CodeEditor
        v-model="code"
        :language="editorLanguage"
        height="450px"
      />

      <SubmissionWorkbench :code="code" :language="language" :samples="problem.publicSamples" :special-judge="!!(problem.spjId || problem.checkerLanguage)" :feedback-view="feedbackView" :submitting="submitting" :submit-error="submitError" :can-recover="canRecover" :recovering="recovering" @submit="handleSubmit" @retry="retryFeedback" @recover="recoverSubmission" />


    </div>
  </div>
  <div v-else>
    <NResult status="404" title="题目不存在" />
  </div>
</template>

<script setup lang="ts">
import type { Problem, OjLanguage } from '~/types'
import { LANGUAGE_OPTIONS, ojEditorLanguage } from '~/types'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const courseId = computed(() => Number(route.params.id))
const problemId = computed(() => Number(route.params.pid))

const problemsApi = useProblemsApi()

const problem = ref<Problem | null>(null)
const loading = ref(true)
const loadError = ref('')
const loadForbidden = ref(false)

const language = ref<OjLanguage>('cpp17')
const code = ref('')
const { submitting, submitError, feedbackView, retryFeedback, handleSubmit, canRecover, recovering, recoverSubmission } = useProblemSubmission({ problemId, courseId, code, language })

const languageOptions = LANGUAGE_OPTIONS

const editorLanguage = computed(() => ojEditorLanguage(language.value))

onMounted(() => { void loadPage() })

async function loadPage() {
  loading.value = true
  loadError.value = ''
  loadForbidden.value = false
  try {
    const res = await problemsApi.get(problemId.value)
    problem.value = (res as any).data ?? res
  }
  catch (error: any) {
    console.error(error)
    loadForbidden.value = [401, 403].includes(error?.response?.status)
    loadError.value = loadForbidden.value
      ? '请确认你已登录并拥有课程访问权限。'
      : '请检查网络连接后重试。'
  }
  finally {
    loading.value = false
  }
}




useHead(computed(() => ({ title: problem.value?.title ? `${problem.value.title} — Leverage OJ` : '题目 — Leverage OJ' })))
</script>

<style scoped>
.loading-center,
.state-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.problem-page {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
  align-items: start;
  gap: var(--lv-space-6);
  width: 100%;
  min-width: 0;
  color: var(--lv-color-text);
  font-family: var(--lv-font-ui);
}

.problem-left,
.problem-right {
  min-width: 0;
  border: 1px solid var(--lv-color-border);
  border-radius: var(--lv-radius-lg);
  background: var(--lv-color-surface);
}

.problem-left {
  padding: clamp(20px, 3vw, 32px);
  line-height: 1.7;
  font-size: var(--lv-size-body);
}

.problem-right {
  position: sticky;
  top: var(--lv-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-3);
  padding: var(--lv-space-4);
}

.problem-header {
  display: flex;
  flex-direction: column;
  gap: var(--lv-space-3);
}

.problem-header :deep(h2) {
  color: var(--lv-color-text);
  font-size: var(--lv-size-title);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.problem-meta,
.problem-tags {
  display: flex;
  gap: var(--lv-space-2);
  flex-wrap: wrap;
}

.editor-header {
  display: flex;
  justify-content: flex-end;
}

.editor-header :deep(.n-select) {
  width: min(100%, 200px);
}

.problem-right :deep(.cm-editor) {
  width: 100%;
  min-width: 0;
  font-family: var(--lv-font-code);
  font-size: var(--lv-size-code);
}

.submit-area,
.submission-result {
  margin-top: var(--lv-space-1);
}

.result-row {
  display: flex;
  align-items: center;
  gap: var(--lv-space-2);
  margin-bottom: var(--lv-space-2);
}

.result-row:last-child { margin-bottom: 0; }
.result-label {
  color: var(--lv-color-text-secondary);
  font-size: var(--lv-size-body);
  min-width: 72px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  color: var(--lv-color-text-secondary);
  font-size: var(--lv-size-body);
}

.breadcrumb-sep {
  margin: 0 var(--lv-space-1);
  color: var(--lv-color-text-secondary);
}

@media (max-width: 900px) {
  .problem-page {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--lv-space-4);
  }

  .problem-right {
    position: static;
  }
}

@media (max-width: 600px) {
  .problem-left,
  .problem-right {
    border-radius: var(--lv-radius-md);
    padding: var(--lv-space-3);
  }

  .problem-header :deep(h2) {
    font-size: var(--lv-size-section);
  }
}
</style>
