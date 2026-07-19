import { getIncidentVisibilityPolicy } from '@/lib/visibility';
import type { AbrRole } from '@/lib/rbac';

import type { CourtLensMatter } from './courtlens';
import type { CourtLensRiskFlags } from './courtlens';
import { buildMatterDetailView } from './matter-service';
import type { IncidentDetail } from './types';

export const REVIEW_PACKET_SCHEMA_VERSION = 'courtlens.review-packet.v1';
export const REVIEW_PACKET_PROJECTION_VERSION = 'v1';

export const SUPPORTED_REVIEW_PACKET_FORMATS = ['json', 'markdown'] as const;
export type ReviewPacketFormat = (typeof SUPPORTED_REVIEW_PACKET_FORMATS)[number];

export const SUPPORTED_REVIEW_PACKET_LOCALES = ['en-CA', 'fr-CA'] as const;
export type ReviewPacketLocale = (typeof SUPPORTED_REVIEW_PACKET_LOCALES)[number];

const LEGAL_BOUNDARY_NOTICE: Record<ReviewPacketLocale, string> = {
  'en-CA':
    'AI-generated content in this review packet is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.',
  'fr-CA':
    'Le contenu généré par IA dans ce dossier est un brouillon et exige une approbation humaine avant tout usage externe. Cette plateforme ne fournit pas d\'avis juridique.',
};

export interface ReviewPacketTimelineItem {
  happenedAt: string;
  type: string;
  description: string;
}

export interface ReviewPacketNoteItem {
  createdAt: string;
  visibilityScope: string;
  content: string;
}

export interface CourtLensReviewPacket {
  schemaVersion: typeof REVIEW_PACKET_SCHEMA_VERSION;
  projectionVersion: typeof REVIEW_PACKET_PROJECTION_VERSION;
  locale: ReviewPacketLocale;
  packetGeneratedAt: string;
  packet: {
    matterId: string;
    orgId?: string;
    statusLabel: string;
    title: string;
    practiceArea: string;
    subIssue: string | null;
    urgencyLabel: string;
    assignedTo: string | null;
    openedAt: string;
    dueAt: string | null;
    intakeFacts: {
      clientGoal: string | null;
      hearingDate: string | null;
      deadlineDate: string | null;
        riskFlags: CourtLensRiskFlags | null;
      clientProfile: {
        clientName: string | null;
        householdSize: number | null;
        consentStatus: string;
      } | null;
    };
    documentReadiness: {
      aiSummaryStatus: string;
      referralStatus: string;
      isPacketExternalizable: boolean;
      hasReviewerNotes: boolean;
      hasTimelineEvents: boolean;
    };
    reviewerNotes: ReviewPacketNoteItem[];
    timeline: ReviewPacketTimelineItem[];
    legalBoundaryNotice: string;
  };
  trace: {
    sourceState: {
      eventCount: number;
      noteCount: number;
      timelineCount: number;
      incidentUpdatedAt: string;
    };
  };
}

export function normalizeReviewPacketLocale(input: string | null | undefined): ReviewPacketLocale {
  if (input === 'fr-CA') return 'fr-CA';
  return 'en-CA';
}

export function isReviewPacketLocale(input: string | null | undefined): input is ReviewPacketLocale {
  return typeof input === 'string' && (SUPPORTED_REVIEW_PACKET_LOCALES as readonly string[]).includes(input);
}

export function isReviewPacketFormat(input: string | null | undefined): input is ReviewPacketFormat {
  return typeof input === 'string' && (SUPPORTED_REVIEW_PACKET_FORMATS as readonly string[]).includes(input);
}

export function buildCourtLensReviewPacket(
  matter: CourtLensMatter,
  detail: IncidentDetail,
  role: AbrRole,
  locale: ReviewPacketLocale,
): CourtLensReviewPacket {
  const view = buildMatterDetailView(matter, detail, role);
  const visibility = getIncidentVisibilityPolicy(role);

  const reviewerNotes: ReviewPacketNoteItem[] = view.notes.map((note) => ({
    createdAt: note.createdAt,
    visibilityScope: note.visibilityScope,
    content: note.content,
  }));

  const timeline: ReviewPacketTimelineItem[] = view.timeline.map((item) => ({
    happenedAt: item.happenedAt,
    type: item.type,
    description: item.description,
  }));

  return {
    schemaVersion: REVIEW_PACKET_SCHEMA_VERSION,
    projectionVersion: REVIEW_PACKET_PROJECTION_VERSION,
    locale,
    packetGeneratedAt: new Date().toISOString(),
    packet: {
      matterId: view.id,
      ...(visibility.canSeeAggregateOnly ? {} : { orgId: view.orgId }),
      statusLabel: view.statusLabel,
      title: view.title,
      practiceArea: view.practiceArea,
      subIssue: view.subIssue,
      urgencyLabel: view.urgencyLabel,
      assignedTo: view.assignedTo,
      openedAt: view.openedAt,
      dueAt: view.dueAt,
      intakeFacts: {
        clientGoal: view.clientGoal,
        hearingDate: view.hearingDate,
        deadlineDate: view.deadlineDate,
        riskFlags: view.riskFlags,
        clientProfile: view.clientProfile
          ? {
              clientName: view.clientProfile.clientName,
              householdSize: view.clientProfile.householdSize,
              consentStatus: view.clientProfile.consentStatus,
            }
          : null,
      },
      documentReadiness: {
        aiSummaryStatus: view.aiSummaryStatus,
        referralStatus: view.referralStatus,
        isPacketExternalizable: view.isPacketExternalizable,
        hasReviewerNotes: reviewerNotes.length > 0,
        hasTimelineEvents: timeline.length > 0,
      },
      reviewerNotes,
      timeline,
      legalBoundaryNotice: LEGAL_BOUNDARY_NOTICE[locale],
    },
    trace: {
      sourceState: {
        eventCount: detail.events.length,
        noteCount: detail.notes.length,
        timelineCount: detail.timeline.length,
        incidentUpdatedAt: detail.incident.updatedAt,
      },
    },
  };
}

function formatTimestampForFilename(isoTimestamp: string): string {
  return isoTimestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace(/[^0-9TZ]/g, '');
}

function sanitizeIdentifier(value: string): string {
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, '');
  const withoutPathSeparators = withoutControl.replace(/[\\/]/g, '-');
  const withoutTraversal = withoutPathSeparators.replace(/\.\.+/g, '-');
  const sanitized = withoutTraversal.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return sanitized.slice(0, 64) || 'matter';
}

function sanitizeInline(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const stripped = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  if (!stripped) return 'n/a';

  return stripped
    .replace(/\\/g, '\\\\')
    .replace(/([*_`~\[\]<>#|])/g, '\\$1');
}

function renderTextBlock(value: string | null | undefined): string {
  if (!value) return '    n/a';
  const lines = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return '    n/a';
  return lines.map((line) => `    ${line}`).join('\n');
}

export function buildReviewPacketFilename(packet: CourtLensReviewPacket, format: ReviewPacketFormat): string {
  const ext = format === 'json' ? 'json' : 'md';
  const matterId = sanitizeIdentifier(packet.packet.matterId);
  const timestamp = formatTimestampForFilename(packet.packetGeneratedAt);
  return `courtlens-review-packet-${matterId}-${timestamp}.${ext}`;
}

export function serializeReviewPacketJson(packet: CourtLensReviewPacket): string {
  return `${JSON.stringify(packet, null, 2)}\n`;
}

export function serializeReviewPacketMarkdown(packet: CourtLensReviewPacket): string {
  const lines: string[] = [];
  lines.push('# CourtLens Review Packet');
  lines.push('');
  lines.push(`- Packet Version: ${sanitizeInline(packet.schemaVersion)}`);
  lines.push(`- Projection Version: ${sanitizeInline(packet.projectionVersion)}`);
  lines.push(`- Locale: ${sanitizeInline(packet.locale)}`);
  lines.push(`- Generated At: ${sanitizeInline(packet.packetGeneratedAt)}`);
  lines.push(`- Matter ID: ${sanitizeInline(packet.packet.matterId)}`);
  if (packet.packet.orgId) lines.push(`- Organization ID: ${sanitizeInline(packet.packet.orgId)}`);
  lines.push(`- Status: ${sanitizeInline(packet.packet.statusLabel)}`);
  lines.push(`- Practice Area: ${sanitizeInline(packet.packet.practiceArea)}`);
  lines.push(`- Sub-Issue: ${sanitizeInline(packet.packet.subIssue)}`);
  lines.push(`- Urgency: ${sanitizeInline(packet.packet.urgencyLabel)}`);
  lines.push('');
  lines.push('## Intake Facts');
  lines.push(`- Client Goal: ${sanitizeInline(packet.packet.intakeFacts.clientGoal)}`);
  lines.push(`- Hearing Date: ${sanitizeInline(packet.packet.intakeFacts.hearingDate)}`);
  lines.push(`- Deadline Date: ${sanitizeInline(packet.packet.intakeFacts.deadlineDate)}`);
  lines.push(`- Consent Status: ${sanitizeInline(packet.packet.intakeFacts.clientProfile?.consentStatus)}`);
  lines.push('');
  lines.push('## Document Readiness');
  lines.push(`- AI Summary Status: ${sanitizeInline(packet.packet.documentReadiness.aiSummaryStatus)}`);
  lines.push(`- Referral Status: ${sanitizeInline(packet.packet.documentReadiness.referralStatus)}`);
  lines.push(`- Externalizable: ${packet.packet.documentReadiness.isPacketExternalizable ? 'yes' : 'no'}`);
  lines.push(`- Reviewer Notes Present: ${packet.packet.documentReadiness.hasReviewerNotes ? 'yes' : 'no'}`);
  lines.push(`- Timeline Events Present: ${packet.packet.documentReadiness.hasTimelineEvents ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Reviewer Notes');
  if (packet.packet.reviewerNotes.length === 0) {
    lines.push('- none');
  } else {
    for (const note of packet.packet.reviewerNotes) {
      lines.push(`- [${sanitizeInline(note.createdAt)}] (${sanitizeInline(note.visibilityScope)})`);
      lines.push(renderTextBlock(note.content));
    }
  }
  lines.push('');
  lines.push('## Timeline');
  if (packet.packet.timeline.length === 0) {
    lines.push('- none');
  } else {
    for (const item of packet.packet.timeline) {
      lines.push(`- [${sanitizeInline(item.happenedAt)}] ${sanitizeInline(item.type)}:`);
      lines.push(renderTextBlock(item.description));
    }
  }
  lines.push('');
  lines.push('## Legal Boundary Notice');
  lines.push(renderTextBlock(packet.packet.legalBoundaryNotice));
  lines.push('');
  lines.push('## Trace');
  lines.push(`- Event Count: ${packet.trace.sourceState.eventCount}`);
  lines.push(`- Note Count: ${packet.trace.sourceState.noteCount}`);
  lines.push(`- Timeline Count: ${packet.trace.sourceState.timelineCount}`);
  lines.push(`- Incident Updated At: ${sanitizeInline(packet.trace.sourceState.incidentUpdatedAt)}`);
  lines.push('');

  return `${lines.join('\n')}\n`;
}
