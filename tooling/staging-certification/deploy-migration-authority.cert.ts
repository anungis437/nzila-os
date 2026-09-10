/**
 * Migration Authority Separation Certification (Round 59C)
 *
 * Structural proof that django-backend's persistent runtime container
 * never receives migration-admin database authority, and that Django
 * migrations are applied exclusively by a dedicated, ephemeral deployment
 * job that runs before the application revision is deployed.
 *
 * Defect this guards against: a compromise of the long-running
 * django-backend container (RCE, dependency compromise, debug shell,
 * arbitrary subprocess execution) must not be able to recover a DB
 * migration/admin credential from its own runtime environment.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

const deployWf = read(join(ROOT, '.github', 'workflows', 'deploy-union-eyes.yml'))
const dockerfile = read(join(ROOT, 'apps', 'union-eyes', 'backend', 'Dockerfile'))

describe('CERT — Migration Authority Separation (Round 59C)', () => {
  it('a dedicated apply-django-migrations job exists', () => {
    expect(deployWf).toContain('apply-django-migrations:')
    expect(deployWf).toContain('Apply Django Migrations (ephemeral migration authority)')
  })

  it('the deploy job depends on apply-django-migrations completing first', () => {
    const needsLine = deployWf
      .split('\n')
      .find((line) => line.includes('needs: [plan, pre-deploy-gates, build-push'))
    expect(needsLine).toBeTruthy()
    expect(needsLine).toContain('apply-django-migrations')
  })

  it('the migration job runs manage.py migrate against the digest-pinned backend image', () => {
    expect(deployWf).toContain('manage.py migrate --noinput')
    expect(deployWf).toContain('manage.py migrate --check')
    expect(deployWf).toContain('${{ env.BACKEND_IMAGE }}@${{ needs.build-push.outputs.backend_digest }}')
  })

  it('the migration job fails closed if the migration-admin secret is missing', () => {
    const migrationJobStart = deployWf.indexOf('apply-django-migrations:')
    const deployJobStart = deployWf.indexOf('\n  deploy:')
    expect(migrationJobStart).toBeGreaterThan(-1)
    expect(deployJobStart).toBeGreaterThan(migrationJobStart)
    const jobBody = deployWf.slice(migrationJobStart, deployJobStart)
    expect(jobBody).toContain('union-eyes-migration-admin-database-url')
    expect(jobBody).toMatch(/exit 1/)
  })

  it('the "Update Container App" django-backend step never wires PGADMIN_* or a migration-admin secretRef', () => {
    const stepStart = deployWf.indexOf('- name: Update Container App (frontend + backend sidecar)')
    expect(stepStart).toBeGreaterThan(-1)
    const nextStepStart = deployWf.indexOf('\n      - name:', stepStart + 1)
    const stepBody = deployWf.slice(stepStart, nextStepStart === -1 ? undefined : nextStepStart)
    expect(stepBody).not.toContain('PGADMIN_USER')
    expect(stepBody).not.toContain('PGADMIN_PASSWORD')
    expect(stepBody).not.toContain('db-admin-password')
    expect(stepBody).not.toContain('MIGRATION_ADMIN_URL')
    // The runtime credential must still be wired (regression guard for the
    // underlying Round 59B fix — django-backend must keep using PGUSER/
    // PGPASSWORD, not fall back to nzilaadmin).
    expect(stepBody).toContain('"PGUSER=$PGUSER_VAL"')
    expect(stepBody).toContain('"PGPASSWORD=secretref:$PGPASSWORD_SECRET"')
  })

  it('the workflow never creates a db-admin-password Container App secret', () => {
    expect(deployWf).not.toContain('db-admin-password')
  })

  it('the Dockerfile CMD does not invoke manage.py migrate on ordinary container startup', () => {
    const cmdLine = dockerfile.split('\n').find((line) => line.trim().startsWith('CMD '))
    expect(cmdLine).toBeTruthy()
    expect(cmdLine).not.toContain('manage.py migrate')
    expect(cmdLine).not.toContain('PGADMIN_USER')
    expect(cmdLine).not.toContain('PGADMIN_PASSWORD')
    expect(cmdLine).toContain('gunicorn')
  })

  it('the Dockerfile does not reference any migration-admin credential anywhere', () => {
    expect(dockerfile).not.toContain('PGADMIN_USER')
    expect(dockerfile).not.toContain('PGADMIN_PASSWORD')
    expect(dockerfile).not.toContain('DJANGO_SKIP_MIGRATIONS')
  })
})
