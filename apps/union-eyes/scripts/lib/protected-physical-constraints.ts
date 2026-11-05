/**
 * Physical foreign keys that must survive a Drizzle declaration retirement.
 * Removing `.references()` from a pgTable is not authorization to drop the
 * constraint that already exists in PostgreSQL.
 */
export const PROTECTED_PHYSICAL_CONSTRAINTS = [
  {
    name: 'signature_documents_template_id_signature_templates_id_fk',
    table: 'signature_documents',
    column: 'template_id',
    reason: 'signature_templates left the union-eyes schema barrel. The column and the physical foreign key stay. Django still owns signature_templates.',
  },
] as const

export function protectedConstraintDrop(sql: string): string | null {
  for (const item of PROTECTED_PHYSICAL_CONSTRAINTS) {
    const drop = new RegExp(
      `drop\\s+constraint(?:\\s+if\\s+exists)?\\s+"?${item.name}"?`,
      'i',
    )
    if (drop.test(sql)) return item.name
  }
  return null
}

export function assertNoProtectedConstraintDrop(sql: string): void {
  const name = protectedConstraintDrop(sql)
  if (name) throw new Error(`protected physical constraint must not be dropped: ${name}`)
}
