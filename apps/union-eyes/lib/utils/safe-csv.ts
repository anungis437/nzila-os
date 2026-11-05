/**
 * CSV serialisation for downloads that open in a spreadsheet.
 *
 * Quotes any cell holding a delimiter, quote or line break, and neutralises a cell that a spreadsheet would run as a
 * formula: a leading `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe. Numbers and dates the
 * caller passes as non-strings are stringified first, so a legitimately negative number is not altered.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value == null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && FORMULA_LEAD.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toSafeCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(','));
  return lines.join('\n');
}
