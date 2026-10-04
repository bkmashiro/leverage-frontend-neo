<template>
  <div class="ranklist-page">
    <div class="page-header">
      <NH1>全站排行榜</NH1>
    </div>

    <!-- 年级筛选 -->
    <div class="filter-bar">
      <NSelect
        v-model:value="gradeFilter"
        placeholder="按年级筛选"
        clearable
        :options="gradeOptions"
        style="width: 200px"
        @update:value="onGradeChange"
      />
    </div>

    <NCard>
      <NAlert v-if="loadError" type="error" title="排行榜加载失败" style="margin-bottom: 12px">请稍后重试。</NAlert>
      <NDataTable
        :columns="columns"
        :data="users"
        :loading="loading"
        :pagination="pagination"
        remote
        :row-key="(row: any) => row.id"
        @update:page="onPageChange"
      />
      <div v-if="!loading && users.length === 0" style="display: flex; justify-content: center; padding: 40px 0">
        <NEmpty description="暂无排行数据" />
      </div>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton } from 'naive-ui'

definePageMeta({
  layout: 'default',
})

const usersApi = useUsersApi()

const page = ref(1)
const pageSize = 50
interface RankingUser { id: number; username: string; accepts: number; submits: number; grade: string | null }
const users = ref<RankingUser[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref(false)
const gradeFilter = ref<string | null>(null)

// 生成年级选项（最近6年）
const currentYear = new Date().getFullYear()
const maxGrade = new Date().getMonth() >= 8 ? currentYear : currentYear - 1
const gradeOptions = Array.from({ length: 6 }, (_, i) => ({
  label: `${maxGrade - i} 级`,
  value: String(maxGrade - i),
}))

const pagination = computed(() => ({
  page: page.value,
  pageSize,
  pageCount: Math.ceil(total.value / pageSize),
  itemCount: total.value,
  showSizePicker: false,
}))

function getRankLabel(globalRank: number) {
  if (globalRank === 1) return '🥇'
  if (globalRank === 2) return '🥈'
  if (globalRank === 3) return '🥉'
  return `${globalRank}`
}

const columns: DataTableColumns<RankingUser> = [
  {
    title: '排名', key: 'rank', width: 90,
    render: (_row, idx) => getRankLabel((page.value - 1) * pageSize + idx + 1),
  },
  {
    title: '用户名', key: 'username',
    render: row => h(NButton, { text: true, type: 'primary', onClick: () => navigateTo(`/users/${row.id}`) }, () => row.username),
  },
  { title: '年级', key: 'grade', width: 100, render: row => row.grade || '-' },
  { title: 'AC 数', key: 'accepts', width: 100, render: row => h('span', { style: 'font-weight: 600; color: #18a058;' }, String(row.accepts ?? 0)) },
  { title: '提交数', key: 'submits', width: 100, render: row => row.submits ?? 0 },
]

async function fetchUsers() {
  loading.value = true
  loadError.value = false
  try {
    const params: { page: number; perPage: number; grade?: string } = { page: page.value, perPage: pageSize }
    if (gradeFilter.value) params.grade = gradeFilter.value
    const res = await usersApi.ranking(params)
    users.value = res.data.items
    total.value = res.data.total
  }
  catch (e) {
    console.error(e)
    users.value = []
    total.value = 0
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchUsers()
}

function onGradeChange() {
  page.value = 1
  fetchUsers()
}

onMounted(fetchUsers)

useHead({ title: '排行榜 — Leverage OJ' })
</script>

<style scoped>
.ranklist-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  text-align: center;
}

.filter-bar {
  display: flex;
  justify-content: flex-end;
}
</style>
