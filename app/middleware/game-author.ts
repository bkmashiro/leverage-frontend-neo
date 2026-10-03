export default defineNuxtRouteMiddleware(() => {
  if (!useAuthStore().isSupervisor) return navigateTo('/compete')
})
