export interface ExecutionMetadata {
  runtime: 'native' | 'wasmtime'
  timing?: {
    source: 'trusted_program_wall' | 'host_observed_wall'
    scope: 'program_start_to_exit' | 'ready_to_exit'
    wallMs: number
  }
  memory?: {
    kind: 'wasm_linear_memory_peak' | 'process_peak_rss' | 'docker_stats'
    peakBytes: number
    limitBytes?: number
  }
  fuel?: { consumed?: number; limit: number }
  engine?: { name: 'wasmtime'; version?: string }
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const isFiniteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isNonNegativeInteger = (value: unknown): value is number => isFiniteNonNegative(value) && Number.isSafeInteger(value)

/** Project only documented metadata fields; arbitrary backend payload is never rendered. */
export function normalizeExecutionMetadata(value: unknown): ExecutionMetadata | null {
  if (!isRecord(value) || (value.runtime !== 'native' && value.runtime !== 'wasmtime')) return null
  const result: ExecutionMetadata = { runtime: value.runtime }
  if (isRecord(value.timing)
    && ((value.timing.source === 'trusted_program_wall' && value.timing.scope === 'program_start_to_exit')
      || (value.timing.source === 'host_observed_wall' && value.timing.scope === 'ready_to_exit'))
    && isFiniteNonNegative(value.timing.wallMs)) {
    result.timing = { source: value.timing.source, scope: value.timing.scope, wallMs: value.timing.wallMs }
  }
  if (isRecord(value.memory)
    && (value.memory.kind === 'wasm_linear_memory_peak' || value.memory.kind === 'process_peak_rss' || value.memory.kind === 'docker_stats')
    && (value.runtime === 'wasmtime' ? value.memory.kind === 'wasm_linear_memory_peak' : value.memory.kind === 'process_peak_rss' || value.memory.kind === 'docker_stats')
    && isNonNegativeInteger(value.memory.peakBytes)
    && (value.memory.limitBytes === undefined || (isNonNegativeInteger(value.memory.limitBytes) && value.memory.limitBytes > 0 && value.memory.peakBytes <= value.memory.limitBytes))) {
    result.memory = { kind: value.memory.kind, peakBytes: value.memory.peakBytes }
    if (isNonNegativeInteger(value.memory.limitBytes)) result.memory.limitBytes = value.memory.limitBytes
  }
  if (value.runtime === 'wasmtime' && isRecord(value.fuel) && isNonNegativeInteger(value.fuel.limit) && value.fuel.limit > 0) {
    result.fuel = { limit: value.fuel.limit }
    if (isNonNegativeInteger(value.fuel.consumed) && value.fuel.consumed <= value.fuel.limit) result.fuel.consumed = value.fuel.consumed
  }
  if (value.runtime === 'wasmtime' && isRecord(value.engine) && value.engine.name === 'wasmtime') {
    result.engine = { name: 'wasmtime' }
    if (typeof value.engine.version === 'string' && value.engine.version.length <= 64 && /^[\w.+-]+$/.test(value.engine.version)) {
      result.engine.version = value.engine.version
    }
  }
  if (!result.timing && !result.memory && !result.fuel && !result.engine) return null
  return result
}

export function formatMetadataBytes(value: number): string {
  if (value === 0) return '0 B'
  if (value < 1024) return `${value} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let amount = value / 1024
  let unit = units[0]
  for (let index = 1; amount >= 1024 && index < units.length; index++) {
    amount /= 1024
    unit = units[index]
  }
  return `${amount.toFixed(1)} ${unit}`
}

export function executionMetadataJson(value: unknown): string {
  const normalized = normalizeExecutionMetadata(value)
  return normalized ? JSON.stringify(normalized, null, 2) : ''
}
