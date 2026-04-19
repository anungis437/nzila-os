import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';

import { Card } from '@nzila/ui';
import { getIncidentDetail } from '@/modules/incidents/service';

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { id } = await params;
  const orgId = process.env.ABR_DEMO_ORG_ID ?? 'metro-university';
  const detail = await getIncidentDetail(orgId, id, true);

  if (!detail) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="font-poppins text-xl font-semibold text-navy">Incident not found</h2>
      </div>
    );
  }

  const { incident, actions, notes, timeline } = detail;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-navy">{incident.title}</h2>
        <p className="mt-1 text-slate-600">{incident.summary}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><div className="p-5"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-semibold text-navy">{incident.status}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Severity</p><p className="mt-1 font-semibold text-navy">{incident.severity}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Owner</p><p className="mt-1 font-semibold text-navy">{incident.assignedTo ?? 'Unassigned'}</p></div></Card>
        <Card><div className="p-5"><p className="text-xs text-slate-500">Due</p><p className="mt-1 font-semibold text-navy">{incident.dueAt ? new Date(incident.dueAt).toLocaleDateString() : 'Not set'}</p></div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">Timeline</h3>
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-navy">{item.description}</p>
                  <p className="text-xs text-slate-500">{new Date(item.happenedAt).toLocaleString()} • {item.actorId}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3 p-6">
            <h3 className="font-poppins text-lg font-semibold text-navy">Remediation Actions</h3>
            <div className="space-y-3">
              {actions.map((action) => (
                <div key={action.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-navy">{action.description}</p>
                  <p className="text-xs text-slate-500">Owner: {action.ownerId} • Due {new Date(action.dueDate).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">Status: {action.status}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-3 p-6">
          <h3 className="font-poppins text-lg font-semibold text-navy">Notes</h3>
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm text-slate-700">{note.content}</p>
                <p className="text-xs text-slate-500">{note.visibilityScope} • {note.authorId} • {new Date(note.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-2 p-6">
          <h3 className="font-poppins text-lg font-semibold text-navy">Attachments and Closure Controls</h3>
          <p className="text-sm text-slate-600">Attachment storage and closure approvals are wired through API workflows in this sprint. UI controls can now be bound directly to assign, transition, and action endpoints.</p>
        </div>
      </Card>
    </div>
  );
}
