import { useApi } from '~/composables/useApi'
import type { User } from '~/types'

export function useAuthApi() {
  const api = useApi()
  return {
    login: (username: string, password: string) =>
      api.post<{ accessToken: string; refreshToken: string }>('/auth/login', { username, password }),
    register: (dto: { username: string; password: string; certifiedName?: string; email?: string }) =>
      api.post<{ id: number; username: string; certifiedName?: string | null; authority: string; createdAt: string }>('/auth/register', dto),
    loginContest: (contestId: number, username: string, password: string) =>
      api.post<{ accessToken: string }>('/auth/login/contest', { contestId, username, password }),
    refresh: (refreshToken: string) =>
      api.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
    getProfile: () => api.get<User>('/auth/profile'),
    logout: () => api.post('/auth/logout'),
    changePassword: (userId: number, oldPassword: string, newPassword: string) =>
      api.post(`/users/${userId}/password`, { oldPassword, newPassword }),
  }
}
