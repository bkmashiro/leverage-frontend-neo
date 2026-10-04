export interface SampleOutputDiff {
  equal: boolean
  line: number | null
  expected: string | null
  actual: string | null
  expectedContext: string
  actualContext: string
  truncated: boolean
}

const MAX_CONTEXT_CHARS = 12_000
const CONTEXT_RADIUS = 2

function normalize(value: string): string {
  return value.split('\n').map(line => line.trimEnd()).join('\n').trimEnd()
}

function context(lines: string[], at: number, column: number): { text: string; truncated: boolean } {
  const start = Math.max(0, at - CONTEXT_RADIUS)
  const end = Math.min(lines.length, at + CONTEXT_RADIUS + 1)
  let truncated = start > 0 || end < lines.length
  const text = lines.slice(start, end).map((line, offset) => {
    const left = start + offset === at ? Math.max(0, column - 240) : 0
    const right = Math.min(line.length, left + 600)
    truncated ||= left > 0 || right < line.length
    return `${left ? '…' : ''}${line.slice(left, right)}${right < line.length ? '…' : ''}`
  }).join('\n')
  return { text, truncated }
}

/** Compare public sample output in linear time; retain only bounded UI context. */
export function diffSampleOutput(expectedValue: string, actualValue: string): SampleOutputDiff {
  const expected = normalize(expectedValue)
  const actual = normalize(actualValue)
  if (expected === actual) {
    return { equal: true, line: null, expected: null, actual: null, expectedContext: '', actualContext: '', truncated: false }
  }

  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const count = Math.min(expectedLines.length, actualLines.length)
  let index = 0
  while (index < count && expectedLines[index] === actualLines[index]) index++
  const first = index < count ? index : count
  const expectedAt = expectedLines[first] ?? '(行结束)'
  const actualAt = actualLines[first] ?? '(行结束)'
  let column = 0
  while (column < expectedAt.length && column < actualAt.length && expectedAt[column] === actualAt[column]) column++
  const expectedContext = context(expectedLines, first, column)
  const actualContext = context(actualLines, first, column)
  const truncated = expectedContext.truncated || actualContext.truncated
  return {
    equal: false,
    line: first + 1,
    expected: expectedAt.slice(0, MAX_CONTEXT_CHARS),
    actual: actualAt.slice(0, MAX_CONTEXT_CHARS),
    expectedContext: expectedContext.text,
    actualContext: actualContext.text,
    truncated,
  }
}
