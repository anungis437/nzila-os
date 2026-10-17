export const FRAMEWORK_ROLES = {
  gateway: 'ue_framework_gateway',
  identity: 'ue_framework_identity',
  admin: 'ue_framework_admin',
  workerGateway: 'ue_framework_worker_gateway',
  worker: 'ue_framework_worker',
  reader: 'ue_framework_authority_reader',
} as const

export const FRAMEWORK_MODEL_OWNERS: Record<string, string> = {
  auth_group: 'python:django.contrib.auth.models',
  auth_group_permissions: 'python:django.contrib.auth.models',
  auth_permission: 'python:django.contrib.auth.models',
  auth_user: 'python:django.contrib.auth.models',
  auth_user_groups: 'python:django.contrib.auth.models',
  auth_user_user_permissions: 'python:django.contrib.auth.models',
  django_admin_log: 'python:django.contrib.admin.models',
  django_content_type: 'python:django.contrib.contenttypes.models',
  django_session: 'python:django.contrib.sessions.models',
  django_celery_beat_clockedschedule: 'python:django_celery_beat.models',
  django_celery_beat_crontabschedule: 'python:django_celery_beat.models',
  django_celery_beat_intervalschedule: 'python:django_celery_beat.models',
  django_celery_beat_periodictask: 'python:django_celery_beat.models',
  django_celery_beat_periodictasks: 'python:django_celery_beat.models',
  django_celery_beat_solarschedule: 'python:django_celery_beat.models',
  django_celery_results_chordcounter: 'python:django_celery_results.models',
  django_celery_results_groupresult: 'python:django_celery_results.models',
  django_celery_results_taskresult: 'python:django_celery_results.models',
}

export const PLATFORM_METADATA_MODEL_OWNERS: Record<string, string> = {
  failed_login_attempts: 'apps/union-eyes/backend/core/models.py',
  rate_limit_events: 'apps/union-eyes/backend/core/models.py',
  clc_chart_of_accounts: 'apps/union-eyes/backend/billing/models.py',
}

export const DEDICATED_ADMIN_MODEL_OWNERS = {
  ...FRAMEWORK_MODEL_OWNERS,
  ...PLATFORM_METADATA_MODEL_OWNERS,
}

export const FRAMEWORK_MEMBERSHIPS: Record<string, readonly string[]> = {
  ue_framework_gateway: ['ue_framework_identity', 'ue_framework_admin'],
  ue_framework_worker_gateway: ['ue_framework_worker'],
}

export const FRAMEWORK_FUNCTIONS = [
  'ue_framework_actor_authorized',
  'ue_framework_admin_authorized',
] as const

export const FRAMEWORK_IDENTITY_PRIVILEGES: Record<string, readonly string[]> = {
  auth_user: ['SELECT', 'INSERT', 'UPDATE'],
  auth_user_groups: ['SELECT'],
  auth_user_user_permissions: ['SELECT'],
  auth_group: ['SELECT'],
  auth_group_permissions: ['SELECT'],
  auth_permission: ['SELECT'],
  django_content_type: ['SELECT'],
}

export const FRAMEWORK_IDENTITY_UPDATE_COLUMNS = [
  'email',
  'first_name',
  'last_name',
  'last_login',
  'is_staff',
]
export const FRAMEWORK_READER_COLUMNS = {
  users: ['user_id', 'is_active', 'lifecycle_state', 'is_system_admin'],
  user_sessions: ['user_id', 'organization_id', 'session_token_hash', 'is_active', 'expires_at'],
} as const

export const FRAMEWORK_ADMIN_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const
export const FRAMEWORK_WORKER_TABLES = Object.keys(FRAMEWORK_MODEL_OWNERS).filter((table) =>
  table.startsWith('django_celery_'),
)
