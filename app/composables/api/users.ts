import { useApi } from '~/composables/useApi'
import type { User } from '~/types'

export interface UpdateUserDto {
  email?: string
  studentId?: string
  password?: string
  role?: User['role']
  status?: number
  remarks?: string | null
  statusEndsAt?: string | null
}

export function useUsersApi() {
  const api = useApi()
  return {
    list: (params?: { page?: number; perPage?: number; search?: string; role?: string; status?: number; orderBy?: string; order?: string; college?: string }) =>
      api.get<{ items: User[]; total: number }>('/users', { params }),
    ranking: (params: { page: number; perPage: number; grade?: string | number }) =>
      api.get<{ items: Array<{ id: number; username: string; accepts: number; submits: number; grade: string | null }>; total: number }>('/users/ranking', { params }),
    get: (id: number) => api.get<User>(`/users/${id}`),
    getByUsername: (username: string) => api.get<User>(`/users/by-username/${username}`),
    update: (id: number, dto: UpdateUserDto) => api.patch<User>(`/users/${id}`, dto),
    delete: (id: number) => api.delete(`/users/${id}`),
    getSubmissions: (id: number, params?: { page?: number; perPage?: number }) =>
      api.get(`/users/${id}/submissions`, { params }),
    getAcceptedProblems: (id: number) =>
      api.get<{ items: Array<{ id: number; logicId: string; prefix: string; title: string }> }>(`/users/${id}/accept`),
    getUserStats: (id: number) =>
      api.get<any>(`/users/${id}/stats`),
    banUser: (id: number, banned: boolean, reason?: string) =>
      api.post(`/users/${id}/ban`, { banned, reason }),
    changeUserPassword: (id: number, password: string) =>
      api.post(`/users/${id}/password`, { password }),
  }
}
