export const ABR_ROLES = [
  'super_admin',
  'organization_admin',
  'investigator',
  'hr_lead',
  'dei_lead',
  'legal_counsel',
  'executive_viewer',
  'learner',
  'auditor',
] as const;

export type AbrRole = (typeof ABR_ROLES)[number];

const ROLE_WEIGHTS: Record<AbrRole, number> = {
  super_admin: 100,
  organization_admin: 90,
  investigator: 70,
  hr_lead: 70,
  dei_lead: 65,
  legal_counsel: 65,
  executive_viewer: 50,
  learner: 20,
  auditor: 40,
};

export type AbrPermission =
  | 'incident.read'
  | 'incident.create'
  | 'incident.update'
  | 'incident.assign'
  | 'incident.transition'
  | 'incident.note.write'
  | 'incident.actions.manage'
  | 'dashboard.read'
  | 'dashboard.read.sensitive'
  | 'export.read';

const ROLE_PERMISSIONS: Record<AbrRole, AbrPermission[]> = {
  super_admin: [
    'incident.read',
    'incident.create',
    'incident.update',
    'incident.assign',
    'incident.transition',
    'incident.note.write',
    'incident.actions.manage',
    'dashboard.read',
    'dashboard.read.sensitive',
    'export.read',
  ],
  organization_admin: [
    'incident.read',
    'incident.create',
    'incident.update',
    'incident.assign',
    'incident.transition',
    'incident.note.write',
    'incident.actions.manage',
    'dashboard.read',
    'dashboard.read.sensitive',
    'export.read',
  ],
  investigator: [
    'incident.read',
    'incident.update',
    'incident.assign',
    'incident.transition',
    'incident.note.write',
    'incident.actions.manage',
    'dashboard.read',
    'export.read',
  ],
  hr_lead: [
    'incident.read',
    'incident.create',
    'incident.update',
    'incident.assign',
    'incident.transition',
    'incident.note.write',
    'incident.actions.manage',
    'dashboard.read',
    'dashboard.read.sensitive',
    'export.read',
  ],
  dei_lead: [
    'incident.read',
    'incident.create',
    'incident.update',
    'incident.assign',
    'incident.transition',
    'incident.note.write',
    'incident.actions.manage',
    'dashboard.read',
    'export.read',
  ],
  legal_counsel: [
    'incident.read',
    'incident.update',
    'incident.transition',
    'incident.note.write',
    'dashboard.read',
    'dashboard.read.sensitive',
    'export.read',
  ],
  executive_viewer: ['incident.read', 'dashboard.read', 'dashboard.read.sensitive', 'export.read'],
  learner: ['dashboard.read'],
  auditor: ['incident.read', 'dashboard.read', 'export.read'],
};

export interface RoleCheckResult {
  ok: boolean;
  required: AbrRole;
  actual: AbrRole;
}

export function normalizeRole(input?: string | null): AbrRole {
  if (!input) return 'learner';
  const candidate = input.trim().toLowerCase();
  const match = ABR_ROLES.find((role) => role === candidate);
  return match ?? 'learner';
}

export function hasMinimumRole(actual: AbrRole, required: AbrRole): boolean {
  return ROLE_WEIGHTS[actual] >= ROLE_WEIGHTS[required];
}

export function checkRole(actual: AbrRole, required: AbrRole): RoleCheckResult {
  return {
    ok: hasMinimumRole(actual, required),
    required,
    actual,
  };
}

export function hasPermission(role: AbrRole, permission: AbrPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function listRolePermissions(role: AbrRole): AbrPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}
