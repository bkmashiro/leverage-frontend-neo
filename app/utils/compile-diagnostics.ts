export interface CompileDiagnostic { line: number; column: number; message: string; sourceLine: string }

/** Only accept diagnostics explicitly attributed to the supported user translation unit. */
export function parseCompileDiagnostics(output: string): CompileDiagnostic[] {
  const result: CompileDiagnostic[] = []
  for (const sourceLine of output.split(/\r?\n/)) {
    const match = /^\s*(main\.(?:cpp|c)):(\d+):(\d+):\s*(?:(?:fatal\s+)?error):\s*(.*)$/i.exec(sourceLine)
    if (!match) continue
    const line = Number(match[2]); const column = Number(match[3])
    if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) continue
    result.push({ line, column, message: match[4], sourceLine })
  }
  return result
}
