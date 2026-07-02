import { db } from '@nzila/db';
import { sql } from 'drizzle-orm';

import { applyIncidentRedaction } from '@/lib/visibility';
import { normalizeRole } from '@/lib/rbac';

import {
  DEMO_ACTIONS,
  DEMO_EVENTS,
  DEMO_INCIDENTS,
  DEMO_NOTES,
  DEMO_ORGS,
  DEMO_USERS,
} from './demo-seed';
import { assertValidTransition } from './fsm';
import type {
  AbrDashboardSummary,
  AbrUserRecord,
  IncidentAssignInput,
  IncidentCreateInput,
  IncidentDetail,
  IncidentDetailOptions,
  IncidentEventRecord,
  IncidentEventType,
  IncidentNoteRecord,
  IncidentRecord,
  IncidentTransitionInput,
  IncidentUpdateInput,
  NoteVisibilityScope,
  RemediationActionCreateInput,
  RemediationActionRecord,
  RemediationStatus,
} from './types';

const DEFAULT_ORG = process.env.ABR_DEMO_ORG_ID ?? 'metro-university';

const memory = {
  orgs: [...DEMO_ORGS],
  users: [...DEMO_USERS],
  incidents: [...DEMO_INCIDENTS],
  events: [...DEMO_EVENTS],
  actions: [...DEMO_ACTIONS],
  notes: [...DEMO_NOTES],
  seededOrgs: new Set<string>(DEMO_ORGS.map((org) => org.id)),
};

let tablesReady = false;

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asIncident(row: Record<string, unknown>): IncidentRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    category: row.category as IncidentRecord['category'],
    severity: row.severity as IncidentRecord['severity'],
    status: row.status as IncidentRecord['status'],
    intakeChannel: row.intake_channel as IncidentRecord['intakeChannel'],
    createdBy: String(row.created_by),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    openedAt: String(row.opened_at),
    dueAt: row.due_at ? String(row.due_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    summary: String(row.summary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asEvent(row: Record<string, unknown>): IncidentEventRecord {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    actorId: String(row.actor_id),
    type: row.type as IncidentEventType,
    payloadJson: (row.payload_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function asAction(row: Record<string, unknown>): RemediationActionRecord {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    ownerId: String(row.owner_id),
    description: String(row.description),
    remediationType: row.remediation_type as RemediationActionRecord['remediationType'],
    dueDate: String(row.due_date),
    status: row.status as RemediationStatus,
    completionEvidence: row.completion_evidence ? String(row.completion_evidence) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asNote(row: Record<string, unknown>): IncidentNoteRecord {
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    authorId: String(row.author_id),
    visibilityScope: row.visibility_scope as NoteVisibilityScope,
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

async function ensureTables(): Promise<void> {
  if (!hasDatabase() || tablesReady) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_organizations (
      id text PRIMARY KEY,
      name text NOT NULL,
      sector text NOT NULL,
      region text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_users (
      id text PRIMARY KEY,
      org_id text NOT NULL,
      role text NOT NULL,
      email text NOT NULL,
      name text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_incidents (
      id text PRIMARY KEY,
      org_id text NOT NULL,
      title text NOT NULL,
      category text NOT NULL,
      severity text NOT NULL,
      status text NOT NULL,
      intake_channel text NOT NULL,
      created_by text NOT NULL,
      assigned_to text,
      opened_at timestamptz NOT NULL,
      due_at timestamptz,
      closed_at timestamptz,
      summary text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_incident_events (
      id text PRIMARY KEY,
      incident_id text NOT NULL,
      actor_id text NOT NULL,
      type text NOT NULL,
      payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_remediation_actions (
      id text PRIMARY KEY,
      incident_id text NOT NULL,
      owner_id text NOT NULL,
      description text NOT NULL,
      remediation_type text NOT NULL,
      due_date timestamptz NOT NULL,
      status text NOT NULL,
      completion_evidence text,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_notes (
      id text PRIMARY KEY,
      incident_id text NOT NULL,
      author_id text NOT NULL,
      visibility_scope text NOT NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_learning_assignments (
      id text PRIMARY KEY,
      org_id text NOT NULL,
      user_id text NOT NULL,
      course_id text NOT NULL,
      status text NOT NULL,
      due_date timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_metrics_daily (
      id text PRIMARY KEY,
      org_id text NOT NULL,
      metric_date date NOT NULL,
      open_incidents integer NOT NULL,
      overdue_actions integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  tablesReady = true;
}

async function ensureDemoData(orgId: string): Promise<void> {
  if (hasDatabase()) {
    await ensureTables();
    const found = (await db.execute(sql`
      SELECT id FROM abr_incidents
      WHERE org_id = ${orgId}
      LIMIT 1
    `)) as Array<Record<string, unknown>>;

    if (found.length > 0) return;

    const org = DEMO_ORGS.find((item) => item.id === orgId) ?? DEMO_ORGS[0];
    await db.execute(sql`
      INSERT INTO abr_organizations (id, name, sector, region)
      VALUES (${org.id}, ${org.name}, ${org.sector}, ${org.region})
      ON CONFLICT (id) DO NOTHING
    `);

    for (const user of DEMO_USERS.filter((item) => item.orgId === org.id)) {
      await db.execute(sql`
        INSERT INTO abr_users (id, org_id, role, email, name, active)
        VALUES (${user.id}, ${user.orgId}, ${user.role}, ${user.email}, ${user.name}, ${user.active})
        ON CONFLICT (id) DO NOTHING
      `);
    }

    for (const incident of DEMO_INCIDENTS.filter((item) => item.orgId === org.id)) {
      await db.execute(sql`
        INSERT INTO abr_incidents (
          id, org_id, title, category, severity, status, intake_channel, created_by,
          assigned_to, opened_at, due_at, closed_at, summary, created_at, updated_at
        ) VALUES (
          ${incident.id}, ${incident.orgId}, ${incident.title}, ${incident.category}, ${incident.severity},
          ${incident.status}, ${incident.intakeChannel}, ${incident.createdBy}, ${incident.assignedTo},
          ${incident.openedAt}::timestamptz, ${incident.dueAt}::timestamptz, ${incident.closedAt}::timestamptz,
          ${incident.summary}, ${incident.createdAt}::timestamptz, ${incident.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    for (const event of DEMO_EVENTS) {
      await db.execute(sql`
        INSERT INTO abr_incident_events (id, incident_id, actor_id, type, payload_json, created_at)
        VALUES (${event.id}, ${event.incidentId}, ${event.actorId}, ${event.type}, ${JSON.stringify(event.payloadJson)}::jsonb, ${event.createdAt}::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `);
    }

    for (const action of DEMO_ACTIONS) {
      await db.execute(sql`
        INSERT INTO abr_remediation_actions (
          id, incident_id, owner_id, description, remediation_type, due_date, status,
          completion_evidence, completed_at, created_at, updated_at
        ) VALUES (
          ${action.id}, ${action.incidentId}, ${action.ownerId}, ${action.description}, ${action.remediationType},
          ${action.dueDate}::timestamptz, ${action.status}, ${action.completionEvidence},
          ${action.completedAt}::timestamptz, ${action.createdAt}::timestamptz, ${action.updatedAt}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    for (const note of DEMO_NOTES) {
      await db.execute(sql`
        INSERT INTO abr_notes (id, incident_id, author_id, visibility_scope, content, created_at)
        VALUES (${note.id}, ${note.incidentId}, ${note.authorId}, ${note.visibilityScope}, ${note.content}, ${note.createdAt}::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `);
    }

    return;
  }

  if (memory.seededOrgs.has(orgId)) return;
  memory.seededOrgs.add(orgId);
}

async function appendEvent(
  incidentId: string,
  actorId: string,
  type: IncidentEventType,
  payloadJson: Record<string, unknown>,
): Promise<void> {
  const id = genId('evt');
  const createdAt = nowIso();

  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_incident_events (id, incident_id, actor_id, type, payload_json, created_at)
      VALUES (${id}, ${incidentId}, ${actorId}, ${type}, ${JSON.stringify(payloadJson)}::jsonb, ${createdAt}::timestamptz)
    `);
    return;
  }

  memory.events.push({ id, incidentId, actorId, type, payloadJson, createdAt });
}

/**
 * Exported event append primitive for CourtLens and other thin adapters.
 * Writes a typed event into the incident event stream.
 * Reuses the same in-memory and DB paths as internal ABR event writes.
 */
export async function appendIncidentEvent(
  incidentId: string,
  actorId: string,
  type: IncidentEventType,
  payloadJson: Record<string, unknown>,
): Promise<void> {
  return appendEvent(incidentId, actorId, type, payloadJson);
}

function buildTimeline(
  events: IncidentEventRecord[],
  notes: IncidentNoteRecord[],
  actions: RemediationActionRecord[],
) {
  const eventItems = events.map((event) => ({
    id: event.id,
    incidentId: event.incidentId,
    happenedAt: event.createdAt,
    actorId: event.actorId,
    type: event.type,
    description: event.type.replaceAll('_', ' '),
    data: event.payloadJson,
  }));

  const noteItems = notes.map((note) => ({
    id: note.id,
    incidentId: note.incidentId,
    happenedAt: note.createdAt,
    actorId: note.authorId,
    type: 'note_added' as const,
    description: 'note added',
    data: { visibilityScope: note.visibilityScope },
  }));

  const actionItems = actions.map((action) => ({
    id: action.id,
    incidentId: action.incidentId,
    happenedAt: action.updatedAt,
    actorId: action.ownerId,
    type: 'remediation_status_changed' as const,
    description: `remediation ${action.status}`,
    data: { remediationType: action.remediationType, dueDate: action.dueDate },
  }));

  return [...eventItems, ...noteItems, ...actionItems].sort((a, b) =>
    a.happenedAt.localeCompare(b.happenedAt),
  );
}

function normalizeDetailOptions(
  options?: boolean | IncidentDetailOptions,
): Required<IncidentDetailOptions> {
  if (typeof options === 'boolean') {
    return {
      includeSensitiveNotes: options,
      role: 'investigator',
    };
  }

  return {
    includeSensitiveNotes: options?.includeSensitiveNotes ?? true,
    role: options?.role ?? 'investigator',
  };
}

function finalizeIncidentDetail(
  detail: IncidentDetail,
  options?: boolean | IncidentDetailOptions,
): IncidentDetail {
  const normalized = normalizeDetailOptions(options);
  const role = normalizeRole(normalized.role);
  const scopeFiltered = normalized.includeSensitiveNotes
    ? detail
    : {
        ...detail,
        notes: detail.notes.filter((note) => note.visibilityScope === 'executive_safe'),
        timeline: buildTimeline(
          detail.events,
          detail.notes.filter((note) => note.visibilityScope === 'executive_safe'),
          detail.actions,
        ),
      };

  return applyIncidentRedaction(scopeFiltered, role);
}

export async function listIncidentUsers(orgId: string): Promise<AbrUserRecord[]> {
  await ensureDemoData(orgId);

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT id, org_id, role, email, name, active
      FROM abr_users
      WHERE org_id = ${orgId}
      ORDER BY name ASC
    `)) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id),
      orgId: String(row.org_id),
      role: String(row.role),
      email: String(row.email),
      name: String(row.name),
      active: Boolean(row.active),
    }));
  }

  return memory.users.filter((user) => user.orgId === orgId);
}

export async function listIncidents(orgId: string): Promise<IncidentRecord[]> {
  await ensureDemoData(orgId);

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT *
      FROM abr_incidents
      WHERE org_id = ${orgId}
      ORDER BY updated_at DESC
    `)) as Array<Record<string, unknown>>;

    return rows.map(asIncident);
  }

  return memory.incidents
    .filter((item) => item.orgId === orgId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createIncident(
  orgId: string,
  actorId: string,
  input: IncidentCreateInput,
): Promise<IncidentRecord> {
  await ensureDemoData(orgId);

  const id = genId('inc');
  const createdAt = nowIso();
  const record: IncidentRecord = {
    id,
    orgId,
    title: input.title,
    category: input.category,
    severity: input.severity,
    status: 'new',
    intakeChannel: input.intakeChannel,
    createdBy: actorId,
    assignedTo: null,
    openedAt: createdAt,
    dueAt: input.dueAt ?? null,
    closedAt: null,
    summary: input.summary,
    createdAt,
    updatedAt: createdAt,
  };

  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_incidents (
        id, org_id, title, category, severity, status, intake_channel, created_by,
        assigned_to, opened_at, due_at, closed_at, summary, created_at, updated_at
      ) VALUES (
        ${record.id}, ${record.orgId}, ${record.title}, ${record.category}, ${record.severity}, ${record.status},
        ${record.intakeChannel}, ${record.createdBy}, ${record.assignedTo}, ${record.openedAt}::timestamptz,
        ${record.dueAt}::timestamptz, ${record.closedAt}::timestamptz, ${record.summary},
        ${record.createdAt}::timestamptz, ${record.updatedAt}::timestamptz
      )
    `);
  } else {
    memory.incidents.push(record);
  }

  await appendEvent(record.id, actorId, 'created', { status: 'new', title: record.title });
  return record;
}

export async function getIncidentDetail(
  orgId: string,
  incidentId: string,
  options: boolean | IncidentDetailOptions = true,
): Promise<IncidentDetail | null> {
  await ensureDemoData(orgId);

  if (hasDatabase()) {
    const incidents = (await db.execute(sql`
      SELECT *
      FROM abr_incidents
      WHERE id = ${incidentId} AND org_id = ${orgId}
      LIMIT 1
    `)) as Array<Record<string, unknown>>;

    if (incidents.length === 0) return null;

    const eventsRows = (await db.execute(sql`
      SELECT * FROM abr_incident_events
      WHERE incident_id = ${incidentId}
      ORDER BY created_at ASC
    `)) as Array<Record<string, unknown>>;

    const actionsRows = (await db.execute(sql`
      SELECT * FROM abr_remediation_actions
      WHERE incident_id = ${incidentId}
      ORDER BY due_date ASC
    `)) as Array<Record<string, unknown>>;

    const notesRows = (await db.execute(sql`
      SELECT * FROM abr_notes
      WHERE incident_id = ${incidentId}
      ORDER BY created_at ASC
    `)) as Array<Record<string, unknown>>;

    const events = eventsRows.map(asEvent);
    const actions = actionsRows.map(asAction);
    const notes = notesRows.map(asNote);
    const detail: IncidentDetail = {
      incident: asIncident(incidents[0]),
      events,
      actions,
      notes,
      timeline: buildTimeline(events, notes, actions),
    };

    return finalizeIncidentDetail(detail, options);
  }

  const incident = memory.incidents.find((item) => item.id === incidentId && item.orgId === orgId);
  if (!incident) return null;

  const events = memory.events.filter((item) => item.incidentId === incidentId);
  const actions = memory.actions.filter((item) => item.incidentId === incidentId);
  const notes = memory.notes.filter((item) => item.incidentId === incidentId);

  return finalizeIncidentDetail(
    {
      incident,
      events,
      actions,
      notes,
      timeline: buildTimeline(events, notes, actions),
    },
    options,
  );
}

export async function updateIncident(
  orgId: string,
  incidentId: string,
  actorId: string,
  input: IncidentUpdateInput,
): Promise<IncidentRecord | null> {
  const detail = await getIncidentDetail(orgId, incidentId, true);
  if (!detail) return null;

  const next: IncidentRecord = {
    ...detail.incident,
    ...input,
    updatedAt: nowIso(),
  };

  if (hasDatabase()) {
    await db.execute(sql`
      UPDATE abr_incidents
      SET title = ${next.title},
          category = ${next.category},
          severity = ${next.severity},
          due_at = ${next.dueAt}::timestamptz,
          summary = ${next.summary},
          updated_at = ${next.updatedAt}::timestamptz
      WHERE id = ${incidentId} AND org_id = ${orgId}
    `);
  } else {
    const idx = memory.incidents.findIndex((item) => item.id === incidentId && item.orgId === orgId);
    memory.incidents[idx] = next;
  }

  await appendEvent(incidentId, actorId, 'due_date_changed', {
    dueAt: next.dueAt,
    severity: next.severity,
  });

  return next;
}

export async function assignIncident(
  orgId: string,
  incidentId: string,
  actorId: string,
  input: IncidentAssignInput,
): Promise<IncidentRecord | null> {
  const detail = await getIncidentDetail(orgId, incidentId, true);
  if (!detail) return null;

  const next: IncidentRecord = {
    ...detail.incident,
    assignedTo: input.assignedTo,
    dueAt: input.dueAt ?? detail.incident.dueAt,
    updatedAt: nowIso(),
    status:
      detail.incident.status === 'new' || detail.incident.status === 'triage'
        ? 'assigned'
        : detail.incident.status,
  };

  if (hasDatabase()) {
    await db.execute(sql`
      UPDATE abr_incidents
      SET assigned_to = ${next.assignedTo},
          due_at = ${next.dueAt}::timestamptz,
          status = ${next.status},
          updated_at = ${next.updatedAt}::timestamptz
      WHERE id = ${incidentId} AND org_id = ${orgId}
    `);
  } else {
    const idx = memory.incidents.findIndex((item) => item.id === incidentId && item.orgId === orgId);
    memory.incidents[idx] = next;
  }

  await appendEvent(incidentId, actorId, 'assignment_changed', {
    assignedTo: input.assignedTo,
    reason: input.reason,
    dueAt: next.dueAt,
  });

  return next;
}

export async function transitionIncident(
  orgId: string,
  incidentId: string,
  actorId: string,
  input: IncidentTransitionInput,
): Promise<IncidentRecord | null> {
  const detail = await getIncidentDetail(orgId, incidentId, true);
  if (!detail) return null;

  const from = detail.incident.status;
  assertValidTransition(from, input.to);

  const closedAt = input.to === 'closed' ? nowIso() : detail.incident.closedAt;
  const next: IncidentRecord = {
    ...detail.incident,
    status: input.to,
    closedAt,
    updatedAt: nowIso(),
  };

  if (hasDatabase()) {
    await db.execute(sql`
      UPDATE abr_incidents
      SET status = ${next.status},
          closed_at = ${next.closedAt}::timestamptz,
          updated_at = ${next.updatedAt}::timestamptz
      WHERE id = ${incidentId} AND org_id = ${orgId}
    `);
  } else {
    const idx = memory.incidents.findIndex((item) => item.id === incidentId && item.orgId === orgId);
    memory.incidents[idx] = next;
  }

  await appendEvent(incidentId, actorId, 'status_changed', {
    from,
    to: input.to,
    reason: input.reason,
  });

  if (input.to === 'closed') {
    await appendEvent(incidentId, actorId, 'closed', { reason: input.reason });
  }

  return next;
}

export async function addIncidentAction(
  orgId: string,
  incidentId: string,
  actorId: string,
  input: RemediationActionCreateInput,
): Promise<RemediationActionRecord | null> {
  const detail = await getIncidentDetail(orgId, incidentId, true);
  if (!detail) return null;

  const id = genId('act');
  const createdAt = nowIso();
  const action: RemediationActionRecord = {
    id,
    incidentId,
    ownerId: input.ownerId,
    description: input.description,
    remediationType: input.remediationType,
    dueDate: input.dueDate,
    status: 'open',
    completionEvidence: null,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_remediation_actions (
        id, incident_id, owner_id, description, remediation_type,
        due_date, status, completion_evidence, completed_at, created_at, updated_at
      ) VALUES (
        ${action.id}, ${action.incidentId}, ${action.ownerId}, ${action.description}, ${action.remediationType},
        ${action.dueDate}::timestamptz, ${action.status}, ${action.completionEvidence},
        ${action.completedAt}::timestamptz, ${action.createdAt}::timestamptz, ${action.updatedAt}::timestamptz
      )
    `);
  } else {
    memory.actions.push(action);
  }

  await appendEvent(incidentId, actorId, 'remediation_created', {
    actionId: action.id,
    ownerId: action.ownerId,
    dueDate: action.dueDate,
  });

  return action;
}

export async function addIncidentNote(
  orgId: string,
  incidentId: string,
  actorId: string,
  visibilityScope: NoteVisibilityScope,
  content: string,
): Promise<IncidentNoteRecord | null> {
  const detail = await getIncidentDetail(orgId, incidentId, true);
  if (!detail) return null;

  const note: IncidentNoteRecord = {
    id: genId('note'),
    incidentId,
    authorId: actorId,
    visibilityScope,
    content,
    createdAt: nowIso(),
  };

  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_notes (id, incident_id, author_id, visibility_scope, content, created_at)
      VALUES (${note.id}, ${note.incidentId}, ${note.authorId}, ${note.visibilityScope}, ${note.content}, ${note.createdAt}::timestamptz)
    `);
  } else {
    memory.notes.push(note);
  }

  await appendEvent(incidentId, actorId, 'note_added', { visibilityScope });
  return note;
}

export async function getDashboardSummary(orgId: string): Promise<AbrDashboardSummary> {
  await ensureDemoData(orgId);
  const incidents = await listIncidents(orgId);

  const detailBundles = await Promise.all(
    incidents.map((item) => getIncidentDetail(orgId, item.id, true)),
  );
  const actions = detailBundles.flatMap((item) => item?.actions ?? []);

  const now = Date.now();
  const openIncidents = incidents.filter((item) => !['closed', 'archived'].includes(item.status)).length;
  const overdueInvestigations = incidents.filter((item) => {
    if (!item.dueAt) return false;
    return new Date(item.dueAt).getTime() < now && !['resolved', 'closed', 'archived'].includes(item.status);
  }).length;
  const overdueActions = actions.filter((action) =>
    action.status !== 'completed' && new Date(action.dueDate).getTime() < now,
  ).length;

  const daysOpenValues = incidents
    .filter((item) => !['archived'].includes(item.status))
    .map((item) => {
      const opened = new Date(item.openedAt).getTime();
      const closed = item.closedAt ? new Date(item.closedAt).getTime() : now;
      return Math.max(1, Math.round((closed - opened) / (24 * 60 * 60 * 1000)));
    });
  const avgDaysOpen =
    daysOpenValues.length > 0
      ? Math.round(daysOpenValues.reduce((sum, value) => sum + value, 0) / daysOpenValues.length)
      : 0;

  const incidentsByCategory = {
    hiring: 0,
    promotion: 0,
    discipline: 0,
    service_delivery: 0,
    policy: 0,
  } as AbrDashboardSummary['incidentsByCategory'];
  incidents.forEach((item) => {
    incidentsByCategory[item.category] += 1;
  });

  const ownerCounts = new Map<string, number>();
  incidents.forEach((item) => {
    if (!item.assignedTo || ['resolved', 'closed', 'archived'].includes(item.status)) return;
    ownerCounts.set(item.assignedTo, (ownerCounts.get(item.assignedTo) ?? 0) + 1);
  });

  const trend90d = Array.from({ length: 13 }).map((_, index) => {
    const bucketStart = new Date(Date.now() - (12 - index) * 7 * 24 * 60 * 60 * 1000);
    const bucketEnd = new Date(bucketStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const opened = incidents.filter((item) => {
      const timestamp = new Date(item.openedAt).getTime();
      return timestamp >= bucketStart.getTime() && timestamp < bucketEnd.getTime();
    }).length;
    const closed = incidents.filter((item) => {
      if (!item.closedAt) return false;
      const timestamp = new Date(item.closedAt).getTime();
      return timestamp >= bucketStart.getTime() && timestamp < bucketEnd.getTime();
    }).length;
    return {
      date: bucketStart.toISOString().slice(0, 10),
      opened,
      closed,
    };
  });

  return {
    orgId,
    generatedAt: nowIso(),
    openIncidents,
    overdueInvestigations,
    overdueActions,
    avgDaysOpen,
    incidentsByCategory,
    trainingCompletionPct: 84,
    unresolvedHotspots: Object.values(incidentsByCategory).filter((value) => value >= 2).length,
    ownerWorkload: Array.from(ownerCounts.entries()).map(([ownerId, openCount]) => ({ ownerId, openCount })),
    trend90d,
  };
}

export async function exportIncidentSummaryJson(
  orgId: string,
): Promise<{ generatedAt: string; incidents: IncidentRecord[] }> {
  return {
    generatedAt: nowIso(),
    incidents: await listIncidents(orgId),
  };
}

export async function exportIncidentSummaryCsv(orgId: string): Promise<string> {
  const incidents = await listIncidents(orgId);
  const header = 'id,title,category,severity,status,assigned_to,due_at,opened_at';
  const lines = incidents.map((item) =>
    [
      item.id,
      item.title.replaceAll(',', ' '),
      item.category,
      item.severity,
      item.status,
      item.assignedTo ?? '',
      item.dueAt ?? '',
      item.openedAt,
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

export async function exportDashboardCsv(orgId: string): Promise<string> {
  const summary = await getDashboardSummary(orgId);
  const rows = [
    'metric,value',
    `open_incidents,${summary.openIncidents}`,
    `overdue_investigations,${summary.overdueInvestigations}`,
    `overdue_actions,${summary.overdueActions}`,
    `avg_days_open,${summary.avgDaysOpen}`,
    `training_completion_pct,${summary.trainingCompletionPct}`,
    `unresolved_hotspots,${summary.unresolvedHotspots}`,
  ];
  return rows.join('\n');
}

export function getDefaultOrgId(): string {
  return DEFAULT_ORG;
}
