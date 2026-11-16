export type InvitationLocale = 'en-CA' | 'fr-CA'
export function invitationLocale(value: string | null | undefined): InvitationLocale | null {
  const normalized = value?.toLowerCase()
  return normalized === 'fr-ca' || normalized === 'fr' ? 'fr-CA' : normalized === 'en-ca' || normalized === 'en' ? 'en-CA' : null
}

export const invitationCopy = {
  'en-CA': {
    language: 'Language / Langue', title: 'Accept your invitation', verifyDescription: 'Verify your identity to finish signing in.',
    description: 'Confirm your details to join the organization.', missing: 'Missing invite token.', firstName: 'First name', lastName: 'Last name',
    authenticator: 'Authenticator code', recovery: 'Recovery code', useRecovery: 'Use a recovery code', working: 'Working…', verify: 'Verify identity', accept: 'Accept invitation',
    failed: 'Could not accept invite', unconfirmed: 'Sign-in could not be confirmed. Please try again.', verificationFailed: 'Verification could not be started. Please sign in again.',
    network: 'Something went wrong. Please try again.',
  },
  'fr-CA': {
    language: 'Langue / Language', title: 'Accepter votre invitation', verifyDescription: 'Vérifiez votre identité pour terminer la connexion.',
    description: 'Confirmez vos renseignements pour rejoindre l’organisation.', missing: 'Le jeton d’invitation est manquant.', firstName: 'Prénom', lastName: 'Nom',
    authenticator: 'Code de l’application d’authentification', recovery: 'Code de récupération', useRecovery: 'Utiliser un code de récupération', working: 'Traitement…', verify: 'Vérifier l’identité', accept: 'Accepter l’invitation',
    failed: 'Impossible d’accepter l’invitation.', unconfirmed: 'La connexion n’a pas pu être confirmée. Veuillez réessayer.', verificationFailed: 'La vérification n’a pas pu démarrer. Veuillez vous reconnecter.',
    network: 'Une erreur s’est produite. Veuillez réessayer.',
  },
} as const

export const frenchInvitationErrors: Readonly<Record<string, string>> = {
  'Invalid or expired invite': 'Invitation invalide ou expirée. Demandez une nouvelle invitation à votre syndicat.',
  'Invalid invite role': 'Le rôle de cette invitation n’est pas accepté. Communiquez avec votre syndicat.',
  'Invalid code': 'Code invalide. Vérifiez votre code et réessayez.',
  'Invalid or expired challenge': 'Vérification invalide ou expirée. Recommencez la connexion.',
  'Too many attempts — request a new sign-in': 'Trop de tentatives. Recommencez la connexion.',
  'Code must be 6 digits': 'Le code doit comporter six chiffres.',
  'Code or recovery code required': 'Saisissez un code d’authentification ou de récupération.',
  'Provide either a 6-digit code or a recovery code': 'Saisissez un code à six chiffres ou un code de récupération.',
  'MFA not enabled for this account': 'L’authentification à deux facteurs n’est pas activée pour ce compte. Communiquez avec votre syndicat.',
  'Challenge token missing': 'La vérification est manquante. Recommencez la connexion.',
  'Internal server error': 'La connexion est momentanément indisponible. Veuillez réessayer.',
}
