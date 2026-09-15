export interface InternalMatterLike {
  id: string;
  caseNumber?: string | null;
  title?: string | null;
  subject?: string | null;
  status?: string | null;
  step?: string | null;
  filedDate?: Date | string | null;
  responseDeadline?: Date | string | null;
  description?: string | null;
  summary?: string | null;
}

export interface ExternalMatterProjection {
  id: string;
  caseNumber: string | null;
  title: string | null;
  status: string | null;
  step: string | null;
  filedDate: string | null;
  responseDeadline: string | null;
  summary: string | null;
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function toExternalMatterProjection(matter: InternalMatterLike): ExternalMatterProjection {
  return {
    id: matter.id,
    caseNumber: matter.caseNumber ?? null,
    title: matter.title ?? matter.subject ?? null,
    status: matter.status ?? null,
    step: matter.step ?? null,
    filedDate: isoOrNull(matter.filedDate),
    responseDeadline: isoOrNull(matter.responseDeadline),
    summary: matter.summary ?? matter.description ?? null,
  };
}
