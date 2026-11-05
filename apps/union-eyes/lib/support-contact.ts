/**
 * The mailbox the product owns for support: where replies to outgoing email go, and the address a person is told to write to.
 * One place, so a screen or a template never invents an address of its own.
 */
export const DEFAULT_SUPPORT_EMAIL = 'support@unioneyes.app';

export function supportEmail(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || DEFAULT_SUPPORT_EMAIL;
}
