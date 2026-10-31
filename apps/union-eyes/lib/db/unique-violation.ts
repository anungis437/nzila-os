export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string }; message?: string } | null | undefined
  return (
    candidate?.code === '23505' ||
    candidate?.cause?.code === '23505' ||
    /duplicate key value violates unique constraint/i.test(String(candidate?.message ?? ''))
  )
}

/** A CHECK constraint, or a trigger raising check_violation (23514), refused the write. */
export function isCheckViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } } | null | undefined
  return candidate?.code === '23514' || candidate?.cause?.code === '23514'
}
