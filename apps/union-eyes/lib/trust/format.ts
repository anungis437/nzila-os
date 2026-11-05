/**
 * A table list for a sentence or a line of a report: the first names, then how many more there are. The row-level-security measurement lists every
 * protected table, which is hundreds of names; the count stays exact in the metric, the text stays readable.
 */
export function formatTableList(tables: readonly string[], limit = 12): string {
  if (tables.length === 0) return 'None reported';
  if (tables.length <= limit) return tables.join(', ');
  return `${tables.slice(0, limit).join(', ')} and ${tables.length - limit} more`;
}
