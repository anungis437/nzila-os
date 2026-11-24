import { z } from 'zod';

export type SignInAnswer = { kind: 'signed-in' } | { kind: 'second-factor'; challengeToken: string } | { kind: 'unconfirmed' };

const firstFactorAnswer = z.object({
  requiresMfa: z.boolean().optional(),
  challengeToken: z.string().optional(),
  user: z.object({ id: z.string() }).optional(),
});

const challengeAnswer = z.object({ ok: z.boolean() });

/** What a first-factor answer (`{ user, requiresMfa?, challengeToken? }`) establishes: a session, a second-factor challenge, or nothing. */
export function readSignInAnswer(answer: unknown): SignInAnswer {
  const parsed = firstFactorAnswer.safeParse(answer);
  if (!parsed.success) return { kind: 'unconfirmed' };
  const { requiresMfa, challengeToken, user } = parsed.data;
  if (requiresMfa === true) {
    return challengeToken ? { kind: 'second-factor', challengeToken } : { kind: 'unconfirmed' };
  }
  return user && user.id !== '' ? { kind: 'signed-in' } : { kind: 'unconfirmed' };
}

/** A second-factor answer (`{ ok: true }`) signs a person in only when it says so. */
export const readChallengeAnswer = (answer: unknown): boolean => {
  const parsed = challengeAnswer.safeParse(answer);
  return parsed.success && parsed.data.ok;
};
