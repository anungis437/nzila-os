import { z } from 'zod'

/**
 * Zod 4 applies `.default()` inside `.partial()`, so a PATCH body that omits a field would silently reset it to its
 * creation default. Update schemas must keep zod 3 semantics: an omitted field stays omitted. This builds the partial
 * from the creation schema with every top-level default removed.
 */
export type PartialWithoutDefaults<S extends z.ZodRawShape> = z.ZodObject<{
  [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K]>
}>

export function partialWithoutDefaults<S extends z.ZodRawShape>(schema: z.ZodObject<S>): PartialWithoutDefaults<S> {
  const shape: Record<string, z.ZodType> = {}
  for (const [key, field] of Object.entries(schema.shape)) {
    const type = field as z.ZodType
    shape[key] =
      type instanceof z.ZodDefault
        ? (type.removeDefault() as z.ZodType)
        : type instanceof z.ZodOptional && type.unwrap() instanceof z.ZodDefault
          ? ((type.unwrap() as z.ZodDefault).removeDefault() as z.ZodType).optional()
          : type
  }
  return schema.safeExtend(shape as never).partial() as unknown as PartialWithoutDefaults<S>
}
