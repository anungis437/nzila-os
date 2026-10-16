export const environments: string[]
export const environmentCodes: Record<string, string>
export const requiredTags: string[]
export function validateRuntimeInputs(input: unknown): void
export function validateCompiledFoundation(templates: Record<string, unknown>): void
export function validateLegacyCompiled(template: unknown): void
