import { isRecord } from '@/lib/client/api-envelope';

export type SignInAnswer = { kind: 'signed-in' } | { kind: 'second-factor'; challengeToken: string } | { kind: 'unconfirmed' };

/** What a first-factor answer (`{ user, requiresMfa?, challengeToken? }`) establishes: a session, a second-factor challenge, or nothing. */
export function readSignInAnswer(answer: unknown): SignInAnswer {
  if (!isRecord(answer)) return { kind: 'unconfirmed' };
  if (answer.requiresMfa === true) {
    return typeof answer.challengeToken === 'string' && answer.challengeToken !== ''
      ? { kind: 'second-factor', challengeToken: answer.challengeToken }
      : { kind: 'unconfirmed' };
  }
  return isRecord(answer.user) && typeof answer.user.id === 'string' && answer.user.id !== '' ? { kind: 'signed-in' } : { kind: 'unconfirmed' };
}

/** A second-factor answer (`{ ok: true }`) signs a person in only when it says so. */
export const readChallengeAnswer = (answer: unknown): boolean => isRecord(answer) && answer.ok === true;
