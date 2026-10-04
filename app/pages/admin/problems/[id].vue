<template>
  <div class="admin-problem-edit">
    <div class="page-header">
      <NSpace align="center">
        <NButton text @click="navigateTo('/admin/problems')">
          ← 返回题目列表
        </NButton>
        <NH2 style="margin: 0">
          {{ problem ? `${problem.prefix}${problem.logicId} - ${problem.title}` : '加载中...' }}
        </NH2>
        <NButton v-if="problem" type="info" size="small" ghost @click="navigateTo(`/problems/${problem.logicId}`)">
          查看题目页
        </NButton>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- 基本信息 Tab -->
        <NTabPane name="basic" tab="基本信息">
          <div style="max-width: 600px; margin-top: 24px">
            <NForm :model="basicForm" label-placement="left" label-width="100px">
              <NFormItem label="题目前缀">
                <NInput v-model:value="basicForm.prefix" placeholder="如 P" />
              </NFormItem>
              <NFormItem label="题号">
                <NInputNumber v-model:value="basicForm.logicId" :min="1" style="width: 100%" />
              </NFormItem>
              <NFormItem label="标题" required>
                <NInput v-model:value="basicForm.title" placeholder="输入题目标题" />
              </NFormItem>
              <NFormItem label="时间限制(ms)">
                <NInputNumber v-model:value="basicForm.timeLimit" :min="100" :max="30000" style="width: 100%" />
              </NFormItem>
              <NFormItem label="内存限制(MB)">
                <NInputNumber v-model:value="basicForm.memoryLimit" :min="16" :max="1024" style="width: 100%" />
              </NFormItem>
              <NFormItem label="公开样例">
                <div class="sample-editor">
                  <div v-for="(sample, index) in basicForm.publicSamples" :key="index" class="sample-row">
                    <NInput v-model:value="sample.input" type="textarea" :rows="3" :aria-label="`公开样例 ${index + 1} 输入`" placeholder="样例输入 stdin" />
                    <NInput v-model:value="sample.output" type="textarea" :rows="3" :aria-label="`公开样例 ${index + 1} 输出`" placeholder="预期输出" />
                    <NButton size="small" type="error" @click="removePublicSample(index)">删除</NButton>
                  </div>
                  <NButton size="small" @click="addPublicSample">添加公开样例</NButton>
                  <NText depth="3">旧 HTML 题面不会自动解析为结构化样例。</NText>
                </div>
              </NFormItem>
              <NFormItem label="隐藏">
                <NSwitch v-model:value="basicForm.hidden" />
              </NFormItem>
              <NFormItem>
                <NButton type="primary" :loading="savingBasic" @click="saveBasicInfo">
                  保存基本信息
                </NButton>
              </NFormItem>
            </NForm>
          </div>
        </NTabPane>

        <!-- 内容编辑 Tab -->
        <NTabPane name="content" tab="内容编辑">
          <div style="margin-top: 16px">
            <div class="content-editor-layout">
              <div class="editor-panel">
                <NText depth="3" style="font-size: 12px; margin-bottom: 8px; display: block">Markdown 编辑</NText>
                <CodeEditor
                  v-model="contentForm.description"
                  language="markdown"
                  height="500px"
                />
              </div>
              <div class="preview-panel">
                <NText depth="3" style="font-size: 12px; margin-bottom: 8px; display: block">实时预览</NText>
                <div class="preview-wrapper">
                  <MarkdownView :content="contentForm.description" />
                </div>
              </div>
            </div>
            <div style="margin-top: 16px">
              <NButton type="primary" :loading="savingContent" @click="saveContent">
                保存内容
              </NButton>
            </div>
          </div>
        </NTabPane>

        <!-- 测试用例 Tab -->
        <NTabPane name="testdata" tab="测试用例">
          <div style="margin-top: 24px">
            <NText strong style="margin-bottom: 12px; display: block">已有测试文件</NText>
            <NDataTable
              :columns="testCaseColumns"
              :data="testCases"
              :loading="loadingTestCases"
              :bordered="false"
              size="small"
              style="max-width: 600px; margin-bottom: 24px"
            />
            <NText v-if="!loadingTestCases && !testCases.length" depth="3" style="display: block; margin-bottom: 24px">
              暂无测试数据
            </NText>

            <NDivider />

            <NText strong style="margin-bottom: 12px; display: block">上传测试数据</NText>
            <NText depth="3" style="margin-bottom: 16px; display: block">
              上传 ZIP 格式的测试数据文件（包含 .in 和 .out 文件对）
            </NText>
            <NUpload
              :max="1"
              accept=".zip"
              :default-upload="false"
              @change="onFileChange"
            >
              <NButton>点击选择 ZIP 文件</NButton>
              <NText depth="3" style="display: block; margin-top: 4px; font-size: 12px">
                仅支持 .zip 格式
              </NText>
            </NUpload>
            <div style="margin-top: 16px">
              <NButton
                type="primary"
                :loading="uploading"
                :disabled="!uploadFile"
                @click="handleUpload"
              >
                上传测试数据
              </NButton>
            </div>
          </div>
        </NTabPane>

        <!-- 标签 Tab -->
        <NTabPane name="tags" tab="标签">
          <div style="margin-top: 24px; max-width: 600px">
            <NText strong style="margin-bottom: 12px; display: block">当前标签</NText>
            <div class="tags-list">
              <NTag
                v-for="tag in problemTags"
                :key="tag.id"
                closable
                :color="tag.color ? { color: tag.color, textColor: '#fff', borderColor: tag.color } : undefined"
                style="margin: 4px"
                @close="removeTag(tag.id)"
              >
                {{ tag.name }}
              </NTag>
              <NText v-if="!problemTags.length" depth="3">暂无标签</NText>
            </div>

            <NDivider />

            <NText strong style="margin-bottom: 12px; display: block">添加标签</NText>
            <NSpace>
              <NSelect
                v-model:value="selectedTagId"
                :options="availableTagOptions"
                placeholder="选择标签"
                clearable
                style="width: 240px"
                filterable
              />
              <NButton
                type="primary"
                :disabled="!selectedTagId"
                :loading="addingTag"
                @click="addTag"
              >
                添加
              </NButton>
            </NSpace>
          </div>
        </NTabPane>
      </NTabs>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, type UploadFileInfo, type DataTableColumns } from 'naive-ui'
import type { Problem, PublicSample, Tag } from '~/types'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const message = useMessage()
const problemId = computed(() => Number(route.params.id))

const problemsApi = useProblemsApi()
const tagsApi = useTagsApi()

const problem = ref<Problem | null>(null)
const loading = ref(false)
const activeTab = ref('basic')

// 基本信息表单
const basicForm = ref({
  prefix: '',
  logicId: 1,
  title: '',
  timeLimit: 1000,
  memoryLimit: 256,
  hidden: false,
  publicSamples: [] as PublicSample[],
})
const savingBasic = ref(false)

// 内容编辑
const contentForm = ref({ description: '' })
const savingContent = ref(false)

// 测试用例
const uploadFile = ref<File | null>(null)
const uploading = ref(false)
const testCases = ref<{ name: string; size: number }[]>([])
const loadingTestCases = ref(false)

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const testCaseColumns: DataTableColumns<{ name: string; size: number }> = [
  { title: '文件名', key: 'name' },
  { title: '大小', key: 'size', width: 120, render: row => formatSize(row.size) },
]

// 标签
const problemTags = ref<Tag[]>([])
const allTags = ref<Tag[]>([])
const selectedTagId = ref<number | null>(null)
const addingTag = ref(false)

const availableTagOptions = computed(() => {
  const existingIds = new Set(problemTags.value.map(t => t.id))
  return allTags.value
    .filter(t => !existingIds.has(t.id))
    .map(t => ({ label: t.name, value: t.id }))
})

async function fetchProblem() {
  loading.value = true
  try {
    const res = await problemsApi.get(problemId.value)
    problem.value = res.data
    basicForm.value = {
      prefix: res.data.prefix,
      logicId: res.data.logicId,
      title: res.data.title,
      timeLimit: res.data.timeLimit,
      memoryLimit: res.data.memoryLimit,
      hidden: res.data.hidden,
      publicSamples: (res.data.publicSamples ?? []).map(sample => ({ ...sample })),
    }
    contentForm.value.description = res.data.content || res.data.description || ''
    problemTags.value = res.data.tags || []
  }
  catch {
    message.error('加载题目失败')
  }
  finally {
    loading.value = false
  }
}

async function fetchAllTags() {
  try {
    const res = await tagsApi.list()
    // GET /tags 直接返回数组
    const data = res.data as any
    allTags.value = Array.isArray(data) ? data : (data.items || [])
  }
  catch {
    // ignore
  }
}

function addPublicSample() {
  basicForm.value.publicSamples.push({ input: '', output: '' })
}

function removePublicSample(index: number) {
  basicForm.value.publicSamples.splice(index, 1)
}

async function saveBasicInfo() {
  if (!basicForm.value.title.trim()) {
    message.warning('请填写题目标题')
    return
  }
  savingBasic.value = true
  try {
    await problemsApi.update(problemId.value, basicForm.value)
    message.success('基本信息已保存')
    await fetchProblem()
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  }
  finally {
    savingBasic.value = false
  }
}

async function saveContent() {
  savingContent.value = true
  try {
    await problemsApi.update(problemId.value, { content: contentForm.value.description })
    message.success('内容已保存')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  }
  finally {
    savingContent.value = false
  }
}

async function fetchTestCases() {
  loadingTestCases.value = true
  try {
    const res = await problemsApi.getTestCases(problemId.value)
    testCases.value = Array.isArray(res.data) ? res.data : []
  }
  catch {
    testCases.value = []
  }
  finally {
    loadingTestCases.value = false
  }
}

function onFileChange(data: { fileList: UploadFileInfo[] }) {
  const f = data.fileList[0]
  uploadFile.value = f?.file || null
}

async function handleUpload() {
  if (!uploadFile.value) return
  uploading.value = true
  try {
    await problemsApi.uploadTestData(problemId.value, uploadFile.value)
    message.success('测试数据上传成功')
    uploadFile.value = null
    await fetchTestCases()
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '上传失败')
  }
  finally {
    uploading.value = false
  }
}

async function removeTag(tagId: number) {
  try {
    await problemsApi.update(problemId.value, {
      tags: problemTags.value.filter(t => t.id !== tagId).map(t => t.id),
    })
    problemTags.value = problemTags.value.filter(t => t.id !== tagId)
    message.success('标签已移除')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '移除失败')
  }
}

async function addTag() {
  if (!selectedTagId.value) return
  addingTag.value = true
  try {
    const newTagIds = [...problemTags.value.map(t => t.id), selectedTagId.value]
    await problemsApi.update(problemId.value, { tags: newTagIds })
    const tag = allTags.value.find(t => t.id === selectedTagId.value)
    if (tag) problemTags.value.push(tag)
    selectedTagId.value = null
    message.success('标签已添加')
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || '添加失败')
  }
  finally {
    addingTag.value = false
  }
}

onMounted(() => {
  fetchProblem()
  fetchAllTags()
  fetchTestCases()
})

useHead(computed(() => ({ title: problem.value?.title ? `${problem.value.title}` : '题目编辑' })))
</script>

<style scoped>
.admin-problem-edit {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
}

.sample-editor { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sample-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: start; }
@media (max-width: 640px) { .sample-row { grid-template-columns: 1fr; } }
.content-editor-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.preview-wrapper {
  height: 500px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 40px;
}
</style>
