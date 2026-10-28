import { z } from 'zod';

/**
 * Signer list policy for a document sent for signature.
 *
 * A signature states that a named person gave it, so the identity on a signer row must come from the platform, not from
 * the sender. A platform signer is an active member of the sending organization and is stored under the name and e-mail
 * address of that member's record; whatever the sender typed beside the user id is discarded. A signer without a user id
 * is external: they are identified by an e-mail address only, and cannot sign through a platform session.
 */
export const MAX_SIGNERS = 20;
export const MAX_SIGNING_FILE_BYTES = 15 * 1024 * 1024;

export const signerInputSchema = z
  .object({
    userId: z.string().min(1).max(255).optional(),
    email: z.string().trim().email().max(320),
    name: z.string().trim().min(1).max(200),
    role: z.string().max(100).optional(),
    signingOrder: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const signerListSchema = z.array(signerInputSchema).min(1).max(MAX_SIGNERS);

export type SignerInput = z.infer<typeof signerInputSchema>;

export interface MemberIdentity {
  userId: string;
  name: string | null;
  email: string | null;
}

export class SignerVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignerVerificationError';
  }
}

/**
 * Resolve every signer to a verified identity. `activeMembers` are the active members of the sending organization among
 * the listed user ids (the caller reads them under the organization's tenant context).
 */
export function verifySignerList(signers: SignerInput[], activeMembers: MemberIdentity[]): SignerInput[] {
  const byUserId = new Map(activeMembers.map((member) => [member.userId, member]));
  const seenUsers = new Set<string>();
  const seenEmails = new Set<string>();

  return signers.map((signer) => {
    let verified: SignerInput = { ...signer, email: signer.email.toLowerCase() };

    if (signer.userId) {
      const member = byUserId.get(signer.userId);
      if (!member) throw new SignerVerificationError('Every platform signer must be an active member of the organization');
      if (seenUsers.has(signer.userId)) throw new SignerVerificationError('A signer is listed more than once');
      seenUsers.add(signer.userId);
      // The member record, not the sender, says who this is.
      verified = {
        ...verified,
        name: member.name?.trim() || verified.name,
        email: (member.email?.trim() || verified.email).toLowerCase(),
      };
    }

    if (seenEmails.has(verified.email)) throw new SignerVerificationError('Two signers share an e-mail address');
    seenEmails.add(verified.email);
    return verified;
  });
}
