/**
 * EC-007-06 — synthetic demo persona seeds.
 *
 * Identities are sandbox-only. Password values are never stored here and
 * are never printed by the load guide. Operators place them in a local
 * env vault under the named variables. Do not email them and do not issue
 * them to real counterparts.
 */

export const DEMO_PERSONA_DOMAIN = 'persona.demo.invalid';

export const SANDBOX_PERSONA_IDS = {
  externalSpecialist: 'external_specialist',
  institutionalAdmin: 'institutional_admin',
  unionViewer: 'union_viewer',
  member: 'member',
} as const;

export type SandboxPersonaId = (typeof SANDBOX_PERSONA_IDS)[keyof typeof SANDBOX_PERSONA_IDS];

export interface SandboxPersona {
  id: SandboxPersonaId;
  roleLabel: string;
  displayName: string;
  email: string;
  userId: string;
  /** Env var name only. The value is not in source control. */
  passwordEnvVar: string;
}

export const SANDBOX_USER_IDS = {
  externalSpecialist: '00700000-0000-4000-8000-000000000011',
  institutionalAdmin: '00700000-0000-4000-8000-000000000012',
  unionViewer: '00700000-0000-4000-8000-000000000013',
  member: '00700000-0000-4000-8000-000000000014',
} as const;

export const SANDBOX_PERSONAS: readonly SandboxPersona[] = [
  {
    id: SANDBOX_PERSONA_IDS.externalSpecialist,
    roleLabel: 'External specialist',
    displayName: 'Patel Rowan',
    email: `patel.rowan@${DEMO_PERSONA_DOMAIN}`,
    userId: SANDBOX_USER_IDS.externalSpecialist,
    passwordEnvVar: 'DEMO_SANDBOX_EXTERNAL_SPECIALIST_PASSWORD',
  },
  {
    id: SANDBOX_PERSONA_IDS.institutionalAdmin,
    roleLabel: 'Institutional admin',
    displayName: 'Morgan Ellis',
    email: `morgan.ellis@${DEMO_PERSONA_DOMAIN}`,
    userId: SANDBOX_USER_IDS.institutionalAdmin,
    passwordEnvVar: 'DEMO_SANDBOX_INSTITUTIONAL_ADMIN_PASSWORD',
  },
  {
    id: SANDBOX_PERSONA_IDS.unionViewer,
    roleLabel: 'Union viewer',
    displayName: 'Casey Nguyen',
    email: `casey.nguyen@${DEMO_PERSONA_DOMAIN}`,
    userId: SANDBOX_USER_IDS.unionViewer,
    passwordEnvVar: 'DEMO_SANDBOX_UNION_VIEWER_PASSWORD',
  },
  {
    id: SANDBOX_PERSONA_IDS.member,
    roleLabel: 'Member',
    displayName: 'Jordan Blake',
    email: `jordan.blake@${DEMO_PERSONA_DOMAIN}`,
    userId: SANDBOX_USER_IDS.member,
    passwordEnvVar: 'DEMO_SANDBOX_MEMBER_PASSWORD',
  },
] as const;

export function personaById(id: SandboxPersonaId): SandboxPersona {
  const persona = SANDBOX_PERSONAS.find((item) => item.id === id);
  if (!persona) {
    throw new Error(`Unknown sandbox persona: ${id}`);
  }
  return persona;
}

/**
 * How to load the four personas locally.
 * Prints env var names only. Never includes secret values and never sends mail.
 */
export function formatPersonaLoadGuide(): string {
  const lines = [
    'NZ-007 synthetic persona load guide',
    'AUTH_START_WORKAID=NO',
    'WORKAID_STARTED=NO',
    'Credential issuance to real counterparts: NO',
    'Fleet external send: NO',
    '',
    'These identities are synthetic. Emails use the reserved demo domain',
    `@${DEMO_PERSONA_DOMAIN} and cannot be delivered.`,
    'Password values belong in a local demo vault or shell environment.',
    'Do not email passwords. Do not print password values. This guide lists variable names only.',
    '',
    'Load (idempotent — fixed user ids, safe to repeat):',
    '  pnpm exec tsx apps/union-eyes-demo/scripts/load-sandbox-personas.ts',
    '',
    'Personas:',
  ];

  for (const persona of SANDBOX_PERSONAS) {
    lines.push(
      `  - ${persona.roleLabel}: ${persona.displayName} <${persona.email}> userId=${persona.userId} passwordEnv=${persona.passwordEnvVar}`,
    );
  }

  lines.push(
    '',
    'If a password env var is unset, the sandbox still renders the journey.',
    'It does not invent a password and it does not send one.',
  );

  return lines.join('\n');
}
