const fs = require('fs')
const file = 'lib/report-executor.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sub = (from, to) => {
  if (!t.includes(from)) throw new Error('missing: ' + from.slice(0, 70))
  t = t.replace(from, to)
}

// Registry: name only physical columns.
sub("{ id: 'outcome', name: 'Outcome', column: 'outcome',", "{ id: 'outcome', name: 'Outcome', column: 'resolution_outcome',")
sub("joinable: ['organization_members', 'claim_deadlines', 'claim_notes'],", "joinable: ['organization_members', 'claim_deadlines'],")
sub(
  "      { id: 'first_name', name: 'First Name', column: 'first_name', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },\n      { id: 'last_name', name: 'Last Name', column: 'last_name', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },\n",
  "      { id: 'name', name: 'Name', column: 'name', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },\n",
)
sub("{ id: 'current_deadline', name: 'Deadline Date', column: 'current_deadline',", "{ id: 'current_deadline', name: 'Deadline Date', column: 'due_date',")

// Result kind.
sub("  error?: string;\n  sql?: string; // For debugging\n}", "  error?: string;\n  /** `invalid` when the configuration was refused before any query ran; `failed` when the query itself failed. */\n  kind?: 'invalid' | 'failed';\n  sql?: string; // For debugging\n}")

// execute(): separate refusal from failure.
const start = t.indexOf('    try {\n      // Validate configuration\n      this.validateConfig(config);')
const end = t.indexOf('  /**\n   * Validate report configuration')
if (start < 0 || end < 0) throw new Error('execute markers')
const replacement = `    let query: ReturnType<ReportExecutor['buildQuery']>;
    try {
      this.validateConfig(config);
      query = this.buildQuery(config);
    } catch (error) {
      return {
        success: false,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error && error.message ? error.message : 'Invalid report configuration',
        kind: 'invalid',
      };
    }

    try {
      const results = await db.execute(query);
      return {
        success: true,
        data: results as unknown as Record<string, unknown>[],
        rowCount: results.length,
        executionTimeMs: Date.now() - startTime,
        sql: query.queryChunks.join(' '), // For debugging
      };
    } catch {
      // The database message can name tables and columns; the caller is told only that the report failed.
      return { success: false, executionTimeMs: Date.now() - startTime, error: 'Report execution failed', kind: 'failed' };
    }
  }

`
t = t.slice(0, start) + replacement + t.slice(end)
fs.writeFileSync(file, t)
console.log('ok')
