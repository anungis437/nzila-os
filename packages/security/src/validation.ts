import { z, type ZodType } from "zod";

/**
 * Input-validation helpers using Zod.
 *
 * Provides consistent error formatting for API boundary validation.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validate unknown input against a Zod schema.
 * Returns a structured result (never throws).
 */
export function validateInput<T>(
  schema: ZodType<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Strict validation — throws on invalid input.
 */
export function strictValidate<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}

// ── Common reusable schemas ─────────────────────────────────

export const UUIDSchema = z.string().uuid();

export const OrgIdSchema = z.string().min(1).max(128);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const SortSchema = z.object({
  sortBy: z.string().min(1),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
