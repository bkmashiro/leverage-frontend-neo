<template>
  <div class="admin-problems">
    <div class="page-header">
      <NH2 style="margin: 0">题目管理</NH2>
      <NButton type="primary" @click="openCreateModal">
        + 新增题目
      </NButton>
    </div>

    <PaginatedTable
      :columns="columns"
      :data="(problems as any)"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :row-key="(row: any) => row.id"
      @page-change="onPageChange"
    />

    <!-- 新增/编辑弹窗 -->
    <NModal v-model:show="showModal" :title="editingId ? '编辑题目' : '新增题目'" preset="dialog" style="width: 640px">
      <NForm :model="form" label-placement="left" label-width="90px" style="margin-top: 12px">
        <NFormItem label="题目前缀">
          <NInput v-model:value="form.prefix" placeholder="如 P" />
        </NFormItem>
        <NFormItem label="题号">
          <NInputNumber v-model:value="form.logicId" :min="1" style="width: 100%" />
        </NFormItem>
        <NFormItem label="标题" required>
          <NInput v-model:value="form.title" placeholder="输入题目标题" />
        </NFormItem>
        <NFormItem label="题目描述" required>
          <NInput
            v-model:value="form.description"
            type="textarea"
            :rows="8"
            placeholder="支持 Markdown 格式"
          />
        </NFormItem>
        <NFormItem label="公开样例">
          <div class="sample-editor">
            <div v-for="(sample, index) in form.publicSamples ?? []" :key="index" class="sample-row">
              <NInput v-model:value="sample.input" type="textarea" :rows="3" placeholder="样例输入 stdin" :aria-label="`公开样例 ${index + 1} 输入`" />
              <NInput v-model:value="sample.output" type="textarea" :rows="3" placeholder="预期输出" :aria-label="`公开样例 ${index + 1} 输出`" />
              <NButton size="small" type="error" @click="removePublicSample(index)">删除</NButton>
            </div>
            <NButton size="small" @click="addPublicSample">添加公开样例</NButton>
            <NText depth="3">仅保存明确录入的 input/output，不从旧题面 HTML 推断。</NText>
          </div>
        </NFormItem>
        <NFormItem label="时间限制(ms)">
          <NInputNumber v-model:value="form.timeLimit" :min="100" :max="10000" style="width: 100%" />
        </NFormItem>
        <NFormItem label="内存限制(MB)">
          <NInputNumber v-model:value="form.memoryLimit" :min="16" :max="1024" style="width: 100%" />
        </NFormItem>
        <NFormItem label="隐藏">
          <NSwitch v-model:value="form.hidden" />
        </NFormItem>
      </NForm>

      <template #action>
        <NSpace justify="end">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 上传测试数据弹窗 -->
    <NModal v-model:show="showUploadModal" title="上传测试数据" preset="dialog" style="width: 400px">
      <div style="margin-top: 12px">
        <NText depth="3" style="margin-bottom: 12px; display: block">
          上传 ZIP 格式的测试数据文件（包含 .in 和 .out 文件对）
        </NText>
        <NUpload
          :max="1"
          accept=".zip"
          :default-upload="false"
          @change="onFileChange"
        >
          <NButton>点击选择 ZIP 文件</NButton>
        </NUpload>
      </div>

      <template #action>
        <NSpace justify="end">
          <NButton @click="showUploadModal = false">取消</NButton>
          <NButton type="primary" :loading="uploading" :disabled="!uploadFile" @click="handleUpload">上传</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h, ref } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import type { DataTableColumns, UploadFileInfo } from 'naive-ui'
import type { Problem } from '~/types'
import type { CreateProblemDto } from '~/composables/api/problems'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const problemsApi = useProblemsApi()
const message = useMessage()
const dialog = useDialog()

const problems = ref<Problem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const showModal = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

const showUploadModal = ref(false)
const uploadProblemId = ref<number | null>(null)
const uploading = ref(false)
const uploadFile = ref<File | null>(null)

const defaultForm = (): CreateProblemDto => ({
  logicId: 1,
  prefix: 'P',
  title: '',
  description: '',
  publicSamples: [],
  timeLimit: 1000,
  memoryLimit: 256,
  hidden: false,
})

const form = ref<CreateProblemDto>(defaultForm())

async function fetchProblems() {
  loading.value = true
  try {
    const res = await problemsApi.list({ page: page.value, perPage: pageSize.value })
    problems.value = res.data.items
    total.value = res.data.total
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchProblems)

function onPageChange({ page: p, pageSize: ps }: { page: number; pageSize: number }) {
  page.value = p
  pageSize.value = ps
  fetchProblems()
}

function openCreateModal() {
  editingId.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEditModal(row: Problem) {
  editingId.value = row.id
  form.value = {
    logicId: row.logicId,
    prefix: row.prefix,
    title: row.title,
    description: row.description,
    publicSamples: (row.publicSamples ?? []).map(sample => ({ ...sample })),
    timeLimit: row.timeLimit,
    memoryLimit: row.memoryLimit,
    hidden: row.hidden,
  }
  showModal.value = true
}

function addPublicSample() {
  form.value.publicSamples ??= []
  form.value.publicSamples.push({ input: '', output: '' })
}

function removePublicSample(index: number) {
  form.value.publicSamples?.splice(index, 1)
}

async function handleSave() {
  if (!form.value.title.trim()) {
    message.warning('请填写题目标题')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await problemsApi.update(editingId.value, form.value)
      message.success('编辑成功')
    }
    else {
      await problemsApi.create(form.value)
      message.success('创建成功')
    }
    showModal.value = false
    fetchProblems()
  }
  catch (e: any) {
    message.error(e?.message || '操作失败')
  }
  finally {
    saving.value = false
  }
}

async function handleFork(row: Problem) {
  try {
    const res = await problemsApi.fork(row.id)
    const newProblem = (res as any).data ?? res
    message.success(`Fork 成功！新题目 ID: ${newProblem.id}，logicId: ${newProblem.logicId}`)
    fetchProblems()
  }
  catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || 'Fork 失败')
  }
}

function handleDelete(row: Problem) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除题目「${row.title}」吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await problemsApi.delete(row.id)
        message.success('删除成功')
        fetchProblems()
      }
      catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    },
  })
}

function openUploadModal(row: Problem) {
  uploadProblemId.value = row.id
  uploadFile.value = null
  showUploadModal.value = true
}

function onFileChange(data: { fileList: UploadFileInfo[] }) {
  const f = data.fileList[0]
  if (f?.file) {
    uploadFile.value = f.file
  }
}

async function handleUpload() {
  if (!uploadFile.value || !uploadProblemId.value) return
  uploading.value = true
  try {
    await problemsApi.uploadTestData(uploadProblemId.value, uploadFile.value)
    message.success('上传成功')
    showUploadModal.value = false
  }
  catch (e: any) {
    message.error(e?.message || '上传失败')
  }
  finally {
    uploading.value = false
  }
}

const columns: DataTableColumns<Problem> = [
  {
    title: '题号',
    key: 'logicId',
    width: 100,
    render(row) {
      return h(
        'a',
        {
          style: 'font-weight: 600; color: #2080f0; cursor: pointer; text-decoration: none;',
          onClick: () => navigateTo(`/admin/problems/${row.id}`),
        },
        `${row.prefix}${row.logicId}`,
      )
    },
  },
  {
    title: '标题',
    key: 'title',
    render(row) {
      return h(
        'a',
        {
          style: 'color: inherit; cursor: pointer; text-decoration: none;',
          onClick: () => navigateTo(`/admin/problems/${row.id}`),
        },
        row.title,
      )
    },
  },
  {
    title: '时限(ms)',
    key: 'timeLimit',
    width: 100,
  },
  {
    title: '内存(MB)',
    key: 'memoryLimit',
    width: 100,
  },
  {
    title: '状态',
    key: 'hidden',
    width: 80,
    render(row) {
      return h(
        NTag,
        {
          type: row.hidden ? 'default' : 'success',
          size: 'small',
          bordered: false,
        },
        { default: () => row.hidden ? '隐藏' : '公开' },
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 260,
    render(row) {
      return h(
        NSpace,
        { size: 'small' },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                type: 'info',
                ghost: true,
                onClick: () => navigateTo(`/problems/${row.id}`),
              },
              { default: () => '查看' },
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'primary',
                ghost: true,
                onClick: () => openEditModal(row),
              },
              { default: () => '编辑' },
            ),
            h(
              NButton,
              {
                size: 'small',
                ghost: true,
                onClick: () => openUploadModal(row),
              },
              { default: () => '上传数据' },
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'warning',
                ghost: true,
                onClick: () => handleFork(row),
              },
              { default: () => 'Fork' },
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'error',
                ghost: true,
                onClick: () => handleDelete(row),
              },
              { default: () => '删除' },
            ),
          ],
        },
      )
    },
  },
]

useHead({ title: '题目管理' })
</script>

<style scoped>
.admin-problems {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sample-editor { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sample-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: start; }
@media (max-width: 640px) { .sample-row { grid-template-columns: 1fr; } }
</style>