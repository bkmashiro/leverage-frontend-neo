import { useApi } from '~/composables/useApi'
import type { OjLanguage } from '~/types'
import type { ExecutionMetadata } from '~/utils/execution-metadata'

export type RunStatus = 'queued' | 'running' | 'completed' | 'cancelled'
export type RunResultStatus = 'OK' | 'CE' | 'RE' | 'TLE' | 'MLE' | 'OLE' | 'SE' | 'CANCELLED'
export interface OjRunResult {
  status: RunResultStatus
  stdout: string
  stderr: string
  exitCode: number | null
  timeMs?: number
  memoryBytes?: number
  runtime?: 'wasmtime'
  fuelConsumed?: number
  fuelLimit?: number
  limitReason?: 'fuel' | 'wall' | 'memory'
  executionMetadata?: ExecutionMetadata
  outputTruncated: boolean
}
export interface OjRun {
  id: string
  status: RunStatus
  createdAt: number
  expiresAt: number
  result?: OjRunResult
}

export function useRunsApi() {
  const api = useApi()
  return {
    create: (body: { language: OjLanguage; code: string; stdin: string }, signal?: AbortSignal) => api.post<OjRun>('/runs', body, { timeout: 30000, signal }),
    get: (id: string, signal?: AbortSignal) => api.get<OjRun>(`/runs/${encodeURIComponent(id)}`, { timeout: 30000, signal }),
    wait: (id: string, signal?: AbortSignal) => api.get<OjRun>(`/runs/${encodeURIComponent(id)}/wait`, { timeout: 30000, signal }),
    cancel: (id: string, signal?: AbortSignal) => api.delete<OjRun>(`/runs/${encodeURIComponent(id)}`, { timeout: 30000, signal }),
  }
}
