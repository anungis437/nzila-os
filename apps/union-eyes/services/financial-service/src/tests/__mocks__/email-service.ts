// Test stub for '@/lib/email-service'. The financial-service package references
// this module, which only physically exists in the parent union-eyes app. When
// the package is unit-tested in isolation the import must still resolve, so the
// vitest config aliases '@/lib/email-service' to this stub. Tests use vi.mock to
// override these exports with controllable spies.
export function getFromEmail(_brand?: string): string {
  return "noreply@unioneyes.test";
}

export async function sendResendEmail(
  _message: unknown,
  _meta?: unknown,
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}
