export interface SampleOutputDiffRow {
  kind: 'context' | 'removed' | 'added'
  line: number
  text: string
}

export interface SampleOutputDiff {
  equal: boolean
  line: number | null
  expected: string | null
  actual: string | null
  expectedContext: string
  actualContext: string
  rows: SampleOutputDiffRow[]
  truncated: boolean
}

const MAX_CONTEXT_CHARS = 12_000
const MAX_RENDERED_LINES = 160
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

/** Compare line-for-line in O(n + m) time and retain bounded presentation data. */
export function diffSampleOutput(expectedValue: string, actualValue: string): SampleOutputDiff {
  const expected = normalize(expectedValue)
  const actual = normalize(actualValue)
  if (expected === actual) {
    return { equal: true, line: null, expected: null, actual: null, expectedContext: '', actualContext: '', rows: [], truncated: false }
  }

  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const commonPrefixLimit = Math.min(expectedLines.length, actualLines.length)
  let prefix = 0
  while (prefix < commonPrefixLimit && expectedLines[prefix] === actualLines[prefix]) prefix++
  let suffix = 0
  while (suffix < expectedLines.length - prefix && suffix < actualLines.length - prefix
    && expectedLines[expectedLines.length - 1 - suffix] === actualLines[actualLines.length - 1 - suffix]) suffix++

  const firstExpected = expectedLines[prefix] ?? '(行结束)'
  const firstActual = actualLines[prefix] ?? '(行结束)'
  let column = 0
  while (column < firstExpected.length && column < firstActual.length && firstExpected[column] === firstActual[column]) column++
  const expectedContext = context(expectedLines, prefix, column)
  const actualContext = context(actualLines, prefix, column)
  const rows: SampleOutputDiffRow[] = []
  const contextStart = Math.max(0, prefix - CONTEXT_RADIUS)
  let truncated = contextStart > 0
  const append = (kind: SampleOutputDiffRow['kind'], line: number, text: string, nearColumn = 0) => {
    const start = text.length > 600 ? Math.max(0, Math.min(text.length - 600, nearColumn - 300)) : 0
    if (text.length > 600) truncated = true
    rows.push({ kind, line, text: `${start ? '…' : ''}${text.slice(start, start + 600)}${start + 600 < text.length ? '…' : ''}` })
  }
  for (let i = contextStart; i < prefix; i++) append('context', i + 1, expectedLines[i])
  const removedEnd = expectedLines.length - suffix
  const addedEnd = actualLines.length - suffix
  // Reserve space for both sides: a huge deletion must not hide every actual line.
  const suffixCount = Math.min(suffix, CONTEXT_RADIUS)
  const budget = MAX_RENDERED_LINES - rows.length - suffixCount
  const removedCount = Math.min(removedEnd - prefix, Math.floor(budget / 2))
  const addedCount = Math.min(addedEnd - prefix, budget - removedCount)
  for (let i = prefix; i < prefix + removedCount; i++) append('removed', i + 1, expectedLines[i], i === prefix ? column : 0)
  for (let i = prefix; i < prefix + addedCount; i++) append('added', i + 1, actualLines[i], i === prefix ? column : 0)
  for (let i = 0; i < suffixCount; i++) append('context', removedEnd + i + 1, expectedLines[removedEnd + i])
  truncated ||= removedCount < removedEnd - prefix || addedCount < addedEnd - prefix || suffixCount < suffix
  return {
    equal: false,
    line: prefix + 1,
    expected: firstExpected.slice(0, MAX_CONTEXT_CHARS),
    actual: firstActual.slice(0, MAX_CONTEXT_CHARS),
    expectedContext: expectedContext.text,
    actualContext: actualContext.text,
    rows,
    truncated,
  }
}
