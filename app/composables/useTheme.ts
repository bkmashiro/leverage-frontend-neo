// 页面样式目前仅支持浅色；不要让系统偏好或旧 localStorage 值切换部分组件到深色。
export const useTheme = () => {
  const isDark = computed(() => false)
  return { isDark }
}
