/** PostgreSQL's own parser (libpg-query, compiled to WebAssembly): the same grammar the server uses, so a statement parses here exactly when the server would parse it. */
import { loadModule, parse } from 'libpg-query'

// The parse tree is JSON whose node types are the dozens PostgreSQL's grammar defines: it is read by node name, not typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParseNode = Record<string, any>

let ready: Promise<void> | null = null

export type ParseOutcome = { ok: true; statements: ParseNode[]; /** The text of each statement, as PREPARE needs it. */ texts: string[] } | { ok: false; message: string; position?: number }

export async function parseSql(text: string): Promise<ParseOutcome> {
  ready ??= loadModule()
  await ready
  try {
    const result = (await parse(text)) as { stmts?: Array<{ stmt: ParseNode; stmt_location?: number; stmt_len?: number }> }
    const bytes = Buffer.from(text, 'utf8')
    const entries = result.stmts ?? []
    return {
      ok: true,
      statements: entries.map((entry) => entry.stmt),
      // Offsets are in bytes of the UTF-8 text.
      texts: entries.map((entry) => {
        const start = entry.stmt_location ?? 0
        const length = entry.stmt_len ?? 0
        return bytes.subarray(start, length ? start + length : undefined).toString('utf8').trim()
      }),
    }
  } catch (error) {
    const failure = error as { message?: string; cursorPosition?: number }
    return { ok: false, message: failure.message ?? String(error), position: failure.cursorPosition }
  }
}
