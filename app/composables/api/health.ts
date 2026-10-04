import { useApi } from '~/composables/useApi'

export interface HealthStatus {
  status: string
  info?: {
    database?: { status: string; message?: string }
    redis?: { status: string; message?: string }
    [key: string]: { status: string; message?: string } | undefined
  }
  error?: Record<string, any>
  details?: Record<string, any>
}

export interface QueueHealth {
  queues?: Array<{
    name: string
    waiting: number
    active: number
    failed: number
    completed?: number
    paused?: number
  }>
  [key: string]: any
}

export interface JudgeHealth {
  status: 'up' | 'down' | 'unknown'
  workers: number
  lastHeartbeatAt: number | null
  lastCompletedAt: number | null
  memory: { measured: number; missing: number }
  timestamp: string
}

export interface SystemInfo {
  process: { pid: number; uptime: string; uptimeSec: number; nodeVersion: string; platform: string; arch: string }
  memory: { heapUsed: string; heapTotal: string; rss: string; external: string; heapUsedBytes: number; rssBytes: number }
  cpu: { userMs: number; systemMs: number }
  latency: { dbMs: number; redisMs: number }
  env: string
  timestamp: string
}

export function useHealthApi() {
  const api = useApi()
  return {
    get: () => api.get<HealthStatus>('/health', {
      validateStatus: status => status >= 200 && status < 600,
    }),
    getQueues: () => api.get<QueueHealth>('/health/queues'),
    getJudge: () => api.get<JudgeHealth>('/health/judge', { validateStatus: status => status >= 200 && status < 600 }),
    getSystem: () => api.get<SystemInfo>('/health/system'),
  }
}
