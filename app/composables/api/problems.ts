import { useApi } from '~/composables/useApi'
import type { Problem, PublicSample } from '~/types'

export interface CreateProblemDto {
  logicId: number
  prefix: string
  title: string
  description: string
  content?: string
  publicSamples?: PublicSample[]
  timeLimit: number
  memoryLimit: number
  tags?: number[]
  hidden?: boolean
}

export function useProblemsApi() {
  const api = useApi()
  return {
    list: (params: { page?: number; perPage?: number; search?: string; tagId?: number }) =>
      api.get<{ items: Problem[]; total: number }>('/problems', { params }),
    get: (id: number) => api.get<Problem>(`/problems/${id}`),
    create: (dto: CreateProblemDto) => api.post<Problem>('/problems', dto),
    update: (id: number, dto: Partial<CreateProblemDto>) => api.patch<Problem>(`/problems/${id}`, dto),
    delete: (id: number) => api.delete(`/problems/${id}`),
    fork: (id: number) => api.post(`/problems/${id}/fork`),
    uploadTestData: (id: number, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post(`/problems/${id}/test-data`, form)
    },
    getTestCases: (id: number) =>
      api.get<{ name: string; size: number }[]>(`/problems/${id}/test-cases`),
  }
}
