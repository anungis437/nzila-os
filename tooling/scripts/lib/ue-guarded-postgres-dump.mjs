/** Convert a trusted, hash-verified pg_dump to SQL for a protocol-only driver.
 * The driver cannot run psql commands; refuse every command except one matched
 * restrict/unrestrict pair. No SQL statements or function bodies are rewritten.
 */
export function sqlFromGuardedDump(dump) {
  if (typeof dump !== 'string' || dump.includes('\r')) throw new Error('UE_DUMP_LF_REQUIRED')
  const lines = dump.split('\n')
  let token
  let opened = false
  let closed = false
  const sql = []
  for (const line of lines) {
    if (/^\s*\\/.test(line)) {
      const start = line.match(/^\\restrict (\S+)$/)
      const end = line.match(/^\\unrestrict (\S+)$/)
      if (start && !opened && !closed) { token = start[1]; opened = true; continue }
      if (end && opened && !closed && end[1] === token) { closed = true; continue }
      throw new Error('UE_DUMP_CLIENT_COMMAND_DENIED')
    }
    if (!opened && line.trim() && !line.startsWith('--')) throw new Error('UE_DUMP_SQL_BEFORE_GUARD_DENIED')
    if (closed && line.trim() && !line.startsWith('--')) throw new Error('UE_DUMP_SQL_AFTER_GUARD_DENIED')
    sql.push(line)
  }
  if (!opened || !closed) throw new Error('UE_DUMP_GUARD_PAIR_REQUIRED')
  return sql.join('\n')
}
