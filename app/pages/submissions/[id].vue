<template>
  <div v-if="submission" class="submission-detail">
    <NH2 style="margin-bottom: 24px">提交详情 #{{ submission.id }}</NH2>

    <!-- 基本信息 -->
    <NCard title="基本信息" style="margin-bottom: 24px">
      <NDescriptions :column="isMobile ? 1 : 2" label-placement="left" bordered>
        <NDescriptionsItem label="用户">
          <UserLink
            v-if="Number.isSafeInteger(submission.user?.id) && submission.user.id > 0"
            :user-id="submission.user.id"
            :username="submission.user.username"
          />
          <UserLink
            v-else-if="Number.isSafeInteger(submission.userId) && submission.userId > 0"
            :user-id="submission.userId"
            :username="`用户 #${submission.userId}`"
          />
          <span v-else style="color:#999">-</span>
        </NDescriptionsItem>

        <NDescriptionsItem label="题目">
          <NuxtLink
            v-if="detailProblemHref"
            :to="detailProblemHref"
            class="detail-link"
          >
            {{ submission.problem ? `${submission.problem.prefix}${submission.problem.logicId} ${submission.problem.title}` : `#${submission.problemId}` }}
          </NuxtLink>
          <span v-else style="color:#999">-</span>
        </NDescriptionsItem>

        <NDescriptionsItem label="语言">
          {{ LANGUAGE_LABEL[submission.language] || submission.language }}
        </NDescriptionsItem>

        <NDescriptionsItem label="状态">
          <NSpace align="center">
            <StatusTag :status="submission.status" />
          </NSpace>
        </NDescriptionsItem>

        <NDescriptionsItem label="执行时间">
          {{ submission.time !== undefined && submission.time !== null ? `${submission.time}ms` : '-' }}
        </NDescriptionsItem>

        <NDescriptionsItem label="内存使用">
          {{ submission.memory !== undefined && submission.memory !== null ? formatMemoryBytes(submission.memory) : '-' }}
        </NDescriptionsItem>

        <NDescriptionsItem label="评测来源">
          <NTag v-if="submission.provider === 'botzone'" type="info" size="small" :bordered="false">
            Botzone
          </NTag>
          <NTag v-else size="small" :bordered="false">本地评测</NTag>
        </NDescriptionsItem>

        <NDescriptionsItem v-if="submission.externalJobId" label="外部任务 ID">
          <NText code>{{ submission.externalJobId }}</NText>
        </NDescriptionsItem>

        <NDescriptionsItem label="提交时间" :span="2">
          {{ dayjs(submission.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
        </NDescriptionsItem>
      </NDescriptions>
    </NCard>

    <SubmissionFeedback :view="feedbackView" detail @retry="retryFeedback" />

    <!-- Botzone 游戏回放 -->
    <div v-if="submission.provider === 'botzone' && gameLog" style="margin-bottom: 24px">
      <BotzoneReplaySection :game-log="gameLog" />
    </div>

    <!-- 提交代码 -->
    <NCard title="提交代码">
      <CodeEditor
        v-model="codeContent"
        :language="ojEditorLanguage(submission.language)"
        :readonly="true"
        height="500px"
      />
    </NCard>
  </div>
  <div v-else class="submission-detail">
    <NH2>提交详情 #{{ submissionId }}</NH2>
    <SubmissionFeedback :view="feedbackView" detail @retry="retryFeedback" />
  </div>
</template>

<script setup lang="ts">
import type { BotzoneGameLog } from '~/types/botzone'
import { LANGUAGE_LABEL, ojEditorLanguage, formatMemoryBytes } from '~/types'
import { submissionText } from '~/utils/submission-feedback'
import dayjs from 'dayjs'

definePageMeta({ layout: 'default', middleware: 'auth' })
const route = useRoute()
const submissionId = computed(() => Number(route.params.id))
const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)
const { submission, view: feedbackView, start, retry: retryFeedback } = useSubmissionFeedback()
watch(submissionId, id => { void start(id) }, { immediate: true })
const codeContent = ref('')
watch(submission, data => { codeContent.value = submissionText(data, 'code') })
const detailProblemHref = computed(() => {
  const row = submission.value
  const problemId = row?.problem?.id ?? row?.problemId
  if (!Number.isSafeInteger(problemId) || (problemId ?? 0) <= 0) return null
  if (row?.contestId) return `/contests/${row.contestId}/problems/${problemId}`
  if (row?.courseId) return `/course/${row.courseId}/problems/${problemId}`
  return `/problems/${problemId}`
})
const gameLog = computed<BotzoneGameLog | null>(() => {
  const meta = submission.value?.providerMeta ?? submission.value?.misc?.providerMeta
  if (!meta || typeof meta !== 'object' || !('gameLog' in meta)) return null
  try {
    const log = typeof meta.gameLog === 'string' ? JSON.parse(meta.gameLog) : meta.gameLog
    return log && typeof log === 'object' ? log as BotzoneGameLog : null
  }
  catch { return null }
})
useHead(computed(() => ({ title: `提交 #${submissionId.value} — Leverage OJ` })))
</script>

<style scoped>
.loading-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.detail-link { color: var(--lv-color-accent, #426b96); text-decoration: none; }
.detail-link:hover { text-decoration: underline; }
.detail-link:focus-visible { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; }

.submission-detail {
  max-width: 1000px;
  margin: 0 auto;
}

</style>
