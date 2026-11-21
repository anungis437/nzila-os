/** Selected current SQL source + real actor/RBAC/context/record producers. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCfoSourceDatabase } from './fixtures/cfo-source-database'
const port = vi.hoisted(() => ({
  db: null as unknown,
  actor: 'creator',
  role: 'viewer',
  firmRole: 'firm_owner',
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => ({
    userId: port.actor,
    orgId: null,
    sessionClaims: { publicMetadata: { nzilaRole: port.role, firmRole: port.firmRole } },
  }),
  currentUser: async () => ({
    id: port.actor,
    primaryEmailAddress: { emailAddress: 'component@example.invalid' },
  }),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: new Proxy(
    {},
    {
      get(_target, key) {
        if (!port.db) throw new Error('Owned source database required')
        const value = Reflect.get(port.db as object, key)
        return typeof value === 'function' ? value.bind(port.db) : value
      },
    },
  ),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import {
  createWorkflowTemplate,
  getWorkflowTemplate,
  startWorkflowInstance,
  getWorkflowInstance,
  listWorkflowInstances,
  approveWorkflowStep,
  rejectWorkflowStep,
} from '../workflow-actions'
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
const config = {
  name: 'Existing review',
  trigger: 'manual' as const,
  steps: [
    {
      name: 'Review',
      assigneeRole: 'accountant' as const,
      actionType: 'review' as const,
      dueHours: 24,
    },
    {
      name: 'Approve',
      assigneeRole: 'manager' as const,
      actionType: 'approve' as const,
      dueHours: 24,
    },
  ],
}
let fixture: Awaited<ReturnType<typeof createCfoSourceDatabase>>
const query = <T>(sql: string, params: unknown[] = []) => fixture.db.query<T>(sql, params)
const owner = (sql: string, params: unknown[] = []) => fixture.operator(sql, params)
async function create() {
  expect(await createWorkflowTemplate({ ...config, organizationId: a })).toEqual({ success: true })
  return (
    await query<{ id: string }>(
      "SELECT id FROM audit_log WHERE action='workflow.registered' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0].id
}
async function start(id: string) {
  const result = await startWorkflowInstance(id)
  expect(result.success).toBe(true)
  expect(result.instanceId).toEqual(expect.any(String))
  return result.instanceId!
}
beforeAll(async () => {
  fixture = await createCfoSourceDatabase()
  port.db = fixture.database
})
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  port.actor = 'creator'
  port.role = 'viewer'
  port.firmRole = 'firm_owner'
  await owner('DROP TRIGGER IF EXISTS cfo_workflow_failure ON public.audit_events')
  await owner('DROP FUNCTION IF EXISTS public.cfo_workflow_failure()')
  await owner(
    'TRUNCATE public.audit_events,public.audit_log,public.org_members,public.orgs CASCADE',
  )
  await owner(
    "INSERT INTO orgs(id,legal_name,jurisdiction,policy_config) VALUES($1,'Own','CA-ON','{}'),($2,'Foreign','CA-QC','{}')",
    [a, b],
  )
  await owner(
    "INSERT INTO org_members(org_id,user_id,role,status) VALUES($1,'creator','org_admin','active'),($1,'colleague','org_viewer','active'),($2,'foreign','org_admin','active')",
    [a, b],
  )
  fixture.statements.length = 0
})
describe('CFO existing workflow parent/authority/transaction family (SQL-engine component)', () => {
  it('preserves create/start/two-step approval for a real current same-tenant collaborator', async () => {
    const templateId = await create(),
      id = await start(templateId)
    expect(id).not.toBe(templateId)
    port.actor = 'colleague'
    expect(await getWorkflowTemplate(templateId)).toMatchObject({
      id: templateId,
      name: config.name,
      steps: config.steps,
    })
    expect(await getWorkflowInstance(id)).toMatchObject({
      id,
      templateId,
      status: 'in-progress',
      currentStep: 0,
    })
    expect(await approveWorkflowStep(id, 'Reviewed')).toEqual({ success: true })
    expect(await getWorkflowInstance(id)).toMatchObject({
      status: 'in-progress',
      currentStep: 1,
      steps: [
        { status: 'completed', completedBy: 'colleague', comment: 'Reviewed' },
        { status: 'pending' },
      ],
    })
    expect(await approveWorkflowStep(id)).toEqual({ success: true })
    expect(await getWorkflowInstance(id)).toMatchObject({ status: 'completed', currentStep: 1 })
    expect(await approveWorkflowStep(id)).toEqual({ success: false })
    const roots = (
      await query<{ org_id: string; actor_id: string; id: string }>(
        "SELECT org_id,actor_id,id FROM audit_log WHERE action IN('workflow.registered','workflow.instance.created')",
      )
    ).rows
    expect(roots.map((r) => r.org_id)).toEqual([a, a])
    expect(roots.map((r) => r.actor_id)).toEqual(['creator', 'creator'])
    expect(
      (await query("SELECT metadata FROM audit_log WHERE action='workflow.registered'")).rows,
    ).toMatchObject([{ metadata: { runCount: 1 } }])
    expect(
      (
        await query(
          "SELECT org_id,actor_user_id FROM audit_events WHERE action='cfo.workflow.step.approved'",
        )
      ).rows,
    ).toEqual([
      { org_id: a, actor_user_id: 'colleague' },
      { org_id: a, actor_user_id: 'colleague' },
    ])
  })
  it('denies foreign IDs before payload or effects even with privileged firm metadata', async () => {
    const templateId = await create(),
      id = await start(templateId)
    port.actor = 'foreign'
    fixture.statements.length = 0
    for (const operation of [
      () => getWorkflowTemplate(templateId),
      () => getWorkflowInstance(id),
      () => startWorkflowInstance(templateId),
      () => approveWorkflowStep(id),
      () => rejectWorkflowStep(id, 'Must not write'),
    ])
      await expect(operation()).rejects.toMatchObject({ status: 403 })
    expect(await listWorkflowInstances()).toEqual([])
    expect(fixture.statements.some((s) => s.startsWith('insert ') || s.startsWith('update '))).toBe(
      false,
    )
    expect(fixture.statements.some((s) => s.startsWith('select "id", "metadata" from'))).toBe(false)
  })
  it('rereads revocation and keeps configured step labels separate from existing live permission policy', async () => {
    const templateId = await create(),
      id = await start(templateId)
    port.actor = 'colleague'
    port.firmRole = 'staff_accountant'
    await expect(approveWorkflowStep(id)).rejects.toMatchObject({ status: 403 })
    port.firmRole = 'firm_owner'
    expect(await getWorkflowInstance(id)).toMatchObject({ id })
    await owner("UPDATE org_members SET status='removed' WHERE user_id='colleague'")
    await expect(approveWorkflowStep(id)).rejects.toMatchObject({ status: 403 })
  })
  it('binds a child to the actual verified parent and refuses fabricated same-org parent/actor substitutions', async () => {
    const templateId = await create(),
      id = await start(templateId),
      otherId = await create()
    await owner(
      "UPDATE audit_log SET metadata=jsonb_set(metadata,'{templateId}',to_jsonb($2::text)) WHERE id=$1",
      [id, otherId],
    )
    await expect(getWorkflowInstance(id)).rejects.toMatchObject({ status: 403 })
    await owner(
      "UPDATE audit_log SET metadata=jsonb_set(metadata,'{templateId}',to_jsonb($2::text)) WHERE id=$1",
      [id, templateId],
    )
    await owner("UPDATE audit_log SET actor_id='colleague' WHERE id=$1", [templateId])
    await expect(getWorkflowInstance(id)).rejects.toMatchObject({ status: 403 })
    expect(
      (await query("SELECT count(*)::int AS n FROM audit_log WHERE action LIKE 'workflow.step.%'"))
        .rows,
    ).toEqual([{ n: 0 }])
  })
  it('preserves personal historical templates/instances and their old labels without tenant adoption', async () => {
    const parent = (
      await owner(
        "INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('workflow.registered','creator','workflow',NULL,$1::jsonb) RETURNING id",
        [JSON.stringify({ ...config, status: 'active', runCount: 0, lastRun: null })],
      )
    ).rows[0] as { id: string }
    const id = await start(parent.id)
    expect(await getWorkflowInstance(id)).toMatchObject({ id, templateId: parent.id })
    expect((await query('SELECT org_id FROM audit_log WHERE id=$1', [id])).rows).toEqual([
      { org_id: null },
    ])
    expect((await query('SELECT id FROM audit_events')).rows).toHaveLength(0)
    port.actor = 'colleague'
    await expect(getWorkflowInstance(id)).rejects.toMatchObject({ status: 403 })
    port.actor = 'creator'
    expect(await rejectWorkflowStep(id, 'Personal rejection')).toEqual({ success: true })
    expect(
      (await query("SELECT org_id,metadata FROM audit_log WHERE action='workflow.step.rejected'"))
        .rows,
    ).toMatchObject([{ org_id: null, metadata: { workflowRecordId: id, templateId: parent.id } }])
  })
  it('does not reinterpret an old forged scope marker as collaborative institutional workflow authority', async () => {
    const parent = (
      await owner(
        "INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('workflow.registered','creator','workflow',$1,$2::jsonb) RETURNING id",
        [a, JSON.stringify({ ...config, status: 'active', _cfoOrigin: 'cfo.record-origin.v1' })],
      )
    ).rows[0] as { id: string }
    await expect(startWorkflowInstance(parent.id)).rejects.toMatchObject({ status: 403 })
    expect(
      (await query("SELECT id FROM audit_log WHERE action='workflow.instance.created'")).rows,
    ).toHaveLength(0)
  })
  it('rolls the fresh child, origin and template counter back when the later mandatory audit fails', async () => {
    const parent = await create()
    await owner(
      "CREATE FUNCTION public.cfo_workflow_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='cfo.workflow.started' THEN RAISE EXCEPTION 'synthetic later audit outage'; END IF; RETURN NEW; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_workflow_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.cfo_workflow_failure()',
    )
    expect(await startWorkflowInstance(parent)).toEqual({ success: false })
    expect((await query('SELECT id FROM audit_log')).rows).toHaveLength(1)
    expect((await query('SELECT id FROM audit_events')).rows).toHaveLength(1)
    expect(
      (await query('SELECT metadata FROM audit_log WHERE id=$1', [parent])).rows,
    ).toMatchObject([{ metadata: { runCount: 0, lastRun: null } }])
  })
  it('rolls state, step receipt and primary audit together on actual step-audit failure', async () => {
    const parent = await create(),
      id = await start(parent)
    await owner(
      "CREATE FUNCTION public.cfo_workflow_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='cfo.workflow.step.approved' THEN RAISE EXCEPTION 'synthetic step audit outage'; END IF; RETURN NEW; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_workflow_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.cfo_workflow_failure()',
    )
    expect(await approveWorkflowStep(id)).toEqual({ success: false })
    expect(await getWorkflowInstance(id)).toMatchObject({
      currentStep: 0,
      status: 'in-progress',
      steps: [{ status: 'pending' }, { status: 'pending' }],
    })
    expect(
      (await query("SELECT id FROM audit_log WHERE action='workflow.step.approved'")).rows,
    ).toEqual([])
  })
  it('batches list authority facts/parents before projection rather than per-row verdict queries', async () => {
    const parent = await create()
    for (let i = 0; i < 4; i++) await start(parent)
    fixture.statements.length = 0
    expect(await listWorkflowInstances()).toHaveLength(4)
    const first = fixture.statements.length
    await start(parent)
    fixture.statements.length = 0
    expect(await listWorkflowInstances()).toHaveLength(5)
    expect(fixture.statements.length).toBe(first)
  })
})
