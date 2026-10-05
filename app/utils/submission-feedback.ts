import type { Submission } from '~/types'
import { normalizeExecutionMetadata, type ExecutionMetadata } from '~/utils/execution-metadata'

export interface JudgeCase {
  id: string | number
  verdict: string
  time: number | null
  memory: number | null
  runtime?: 'wasmtime'
  fuelConsumed: number | null
  fuelLimit: number | null
  limitReason?: 'fuel' | 'wall' | 'memory'
  executionMetadata?: ExecutionMetadata
  message?: string
  actualOutput?: string
}

const VERDICTS: Record<string, string> = {
  Accepted: 'AC', WrongAnswer: 'WA', PresentationError: 'PE',
  TimeLimitExceeded: 'TLE', MemoryLimitExceeded: 'MLE',
  OutpuLimitExceeded: 'OLE', OutputLimitExceeded: 'OLE', RuntimeError: 'RE',
  CompileError: 'CE', CompileTimeLimitExceeded: 'CRLE', CompileMemoryLimitExceed: 'CRLE',
  CompileFileLimitExceed: 'CRLE', SystemError: 'SE', SystemTimeLimitExceed: 'SE',
  SystemMemoryLimitExceed: 'SE', SystemOutpuLimitExceeded: 'SE', SystemRuntimeError: 'SE',
  SystemCompileError: 'SE', Unjudged: '?',
}

export function normalizeJudgeCases(raw: unknown): JudgeCase[] {
  let value = raw
  if (typeof value === 'string') {
    try { value = JSON.parse(value) }
    catch { return [] }
  }
  const rows = Array.isArray(value) ? value
    : value && typeof value === 'object' && 'testcases' in value && Array.isArray(value.testcases) ? value.testcases : []
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object').map((row, index) => {
    const verdict = String(row.verdict ?? row.kind ?? 'Unjudged')
    return {
      id: typeof row.id === 'string' || typeof row.id === 'number' ? row.id : index + 1,
      verdict: VERDICTS[verdict] ?? verdict,
      time: typeof row.time === 'number' && Number.isFinite(row.time) ? row.time : null,
      memory: typeof row.memory === 'number' && Number.isFinite(row.memory) ? row.memory : null,
      runtime: row.runtime === 'wasmtime' ? 'wasmtime' : undefined,
      fuelConsumed: typeof row.fuelConsumed === 'number' && Number.isSafeInteger(row.fuelConsumed) && row.fuelConsumed >= 0 ? row.fuelConsumed : null,
      fuelLimit: typeof row.fuelLimit === 'number' && Number.isSafeInteger(row.fuelLimit) && row.fuelLimit > 0 ? row.fuelLimit : null,
      limitReason: row.runtime === 'wasmtime' && (row.limitReason === 'fuel' || row.limitReason === 'wall' || row.limitReason === 'memory') ? row.limitReason : undefined,
      executionMetadata: normalizeExecutionMetadata(row.executionMetadata) ?? undefined,
      message: typeof row.message === 'string' ? row.message : typeof row.extraMessage === 'string' ? row.extraMessage : undefined,
      actualOutput: typeof row.actualOutput === 'string' ? row.actualOutput : undefined,
    }
  })
}

export function formatFuel(value: number | null): string {
  if (value === null || !Number.isSafeInteger(value) || value < 0) return '—'
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function limitReasonLabel(reason: JudgeCase['limitReason']): string {
  if (reason === 'fuel') return '燃料耗尽'
  if (reason === 'wall') return '运行超时'
  if (reason === 'memory') return '内存超限'
  return ''
}

export function submissionText(submission: Submission | null, field: 'code' | 'compileErrorMsg'): string {
  const value = submission?.misc?.[field] ?? submission?.[field]
  return typeof value === 'string' ? value : ''
}

export function responseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined
  const response = error.response
  return response && typeof response === 'object' && 'status' in response && typeof response.status === 'number' ? response.status : undefined
}

export interface SubmissionFeedbackView {
  id: number | null
  status?: number
  phase: 'idle' | 'loading' | 'fetching' | 'waiting' | 'reconnecting' | 'offline' | 'stopped' | 'complete'
  message: string
  stalled: boolean
  cases: JudgeCase[]
  total: number
  completed: number
  compileError: string
}
