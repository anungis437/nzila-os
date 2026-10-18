import { platformDb } from '@nzila/db/platform'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

export async function findAiAction(actionId: string) {
  const [action] = await platformDb.select().from(aiActions)
    .where(eq(aiActions.id, actionId)).limit(1)
  return action
}

export async function updateAiAction(
  actionId: string,
  values: Partial<typeof aiActions.$inferInsert>,
) {
  await platformDb.update(aiActions).set(values).where(eq(aiActions.id, actionId))
}
