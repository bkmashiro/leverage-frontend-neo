<template>
  <div class="paginated-table">
    <slot name="content">
    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :row-key="rowKey"
      v-bind="$attrs"
    >
      <template #empty>
        <NEmpty description="暂无数据" style="padding: 24px 0" />
      </template>
    </NDataTable>
    </slot>
    <div v-if="total > 0" class="pagination-wrapper">
      <NPagination
        v-model:page="currentPage"
        v-model:page-size="currentPageSize"
        :item-count="total"
        :page-sizes="pageSizes"
        :simple="compact"
        :size="compact ? 'small' : 'medium'"
        :show-size-picker="!compact"
        :show-quick-jumper="!compact"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
      <NSelect
        v-if="compact"
        class="mobile-page-size"
        aria-label="每页数量"
        size="small"
        :value="currentPageSize"
        :options="sizeOptions"
        @update:value="onPageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'

const props = withDefaults(defineProps<{
  columns: DataTableColumns<any>
  data: Record<string, unknown>[]
  loading?: boolean
  total?: number
  page?: number
  pageSize?: number
  pageSizes?: number[]
  rowKey?: (row: Record<string, unknown>) => string | number
}>(), {
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  pageSizes: () => [10, 20, 50, 100],
})

const emit = defineEmits<{
  'update:page': [number]
  'update:pageSize': [number]
  'page-change': [{ page: number; pageSize: number }]
}>()

const currentPage = ref(props.page)
const currentPageSize = ref(props.pageSize)
const { width } = useWindowSize()
const compact = computed(() => width.value < 768)
const sizeOptions = computed(() => props.pageSizes.map(size => ({ label: `${size} 条/页`, value: size })))

watch(() => props.page, val => (currentPage.value = val))
watch(() => props.pageSize, val => (currentPageSize.value = val))

function onPageChange(page: number) {
  emit('update:page', page)
  emit('page-change', { page, pageSize: currentPageSize.value })
}

function onPageSizeChange(size: number) {
  currentPage.value = 1
  currentPageSize.value = size
  emit('update:pageSize', size)
  emit('page-change', { page: 1, pageSize: size })
}
</script>

<style scoped>
.paginated-table {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pagination-wrapper {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 767px) {
  .pagination-wrapper { justify-content: flex-start; align-items: center; flex-wrap: wrap; gap: 12px; }
  .pagination-wrapper :deep(.n-pagination) { flex-wrap: wrap; }
  .mobile-page-size { width: 110px; flex: none; }
}
</style>
