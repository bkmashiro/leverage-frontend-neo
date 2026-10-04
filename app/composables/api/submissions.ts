import { useApi } from '~/composables/useApi'
import type { Submission, OjLanguage } from '~/types'

export function useSubmissionsApi() {
  const api = useApi()
  return {
    list: (params: { page?: number; perPage?: number; userId?: number; problemId?: number; status?: number }) =>
      api.get<{ items: Submission[]; total: number }>('/submissions', { params }),
    get: (id: number, signal?: AbortSignal) => api.get<Submission>(`/submissions/${id}`, { signal, timeout: 30000 }),
    findByRequest: (requestId: string, signal?: AbortSignal) => api.get<Pick<Submission, 'id' | 'problemId' | 'courseId' | 'contestId' | 'status' | 'language'>>(`/submissions/by-request/${encodeURIComponent(requestId)}`, { signal, timeout: 30000 }),
    create: (dto: { problemId: number; language: OjLanguage; code: string; contestId?: number; courseId?: number; requestId?: string }, signal?: AbortSignal) =>
      api.post<Submission>('/submissions', dto, { signal, timeout: 30000 }),
    getStatus: (id: number) => api.get<{ status: number }>(`/submissions/${id}/status`),
    waitStatus: (id: number, signal?: AbortSignal, after = '') => api.get<{ status: number; version: string; progress?: { completed: number; total: number; testcases: Array<{ id: string | number; verdict: string; time?: number; memory?: number }> } }>(`/submissions/${id}/status/wait`, { params: { wait: 20000, after }, timeout: 30000, signal }),
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
    getCE: (id: number, signal?: AbortSignal) => api.get<string | {
      id?: number
      misc?: { compileErrorMsg?: string | null } | null
      compileErrorMsg?: string | null
    }>(`/submissions/ce/${id}`, { signal, timeout: 30000 }),
    userProblemStatusBatch: (userId: number, problemIds: number[]) =>
      api.get<Record<string, number>>('/submissions/user-problem-status/batch', {
        params: { userId, problemIds: problemIds.join(',') },
      }),
  }
}
