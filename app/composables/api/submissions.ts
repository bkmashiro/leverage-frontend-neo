import { useApi } from '~/composables/useApi'
import type { Submission, OjLanguage } from '~/types'

export function useSubmissionsApi() {
  const api = useApi()
  return {
    list: (params: { page?: number; perPage?: number; userId?: number; problemId?: number; status?: number }) =>
      api.get<{ items: Submission[]; total: number }>('/submissions', { params }),
    get: (id: number) => api.get<Submission>(`/submissions/${id}`),
    create: (dto: { problemId: number; language: OjLanguage; code: string; contestId?: number; courseId?: number }) =>
      api.post<Submission>('/submissions', dto),
    getStatus: (id: number) => api.get<{ status: number }>(`/submissions/${id}/status`),
    rejudge: (id: number) => api.post(`/submissions/${id}/rejudge`),
    batchRejudge: (
      filters: {
        userId?: number
        problemId?: number
        idStart?: number
        idEnd?: number
        dateStart?: number
        dateEnd?: number
        contestId?: number
        courseId?: number
        status?: number
      },
      count = false,
    ) => api.post<number | { count: number }>('/submissions/batch-rejudge', filters, {
      params: count ? { count: true } : undefined,
    }),
    getCE: (id: number) => api.get<string>(`/submissions/ce/${id}`),
    userProblemStatusBatch: (userId: number, problemIds: number[]) =>
      api.get<Record<string, number>>('/submissions/user-problem-status/batch', {
        params: { userId, problemIds: problemIds.join(',') },
      }),
  }
}
