import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireVerifiedOrgAccess, requireVerifiedPermission, withRequestContext } from '@/lib/api-guards';
import { logAuditEvent } from '@/lib/audit-log';
import { getMatterDetail } from '@/modules/incidents/matter-service';
import {
  buildCourtLensReviewPacket,
  buildReviewPacketFilename,
  isReviewPacketFormat,
  isReviewPacketLocale,
  normalizeReviewPacketLocale,
  serializeReviewPacketJson,
  serializeReviewPacketMarkdown,
  type ReviewPacketFormat,
  SUPPORTED_REVIEW_PACKET_LOCALES,
  SUPPORTED_REVIEW_PACKET_FORMATS,
} from '@/modules/incidents/courtlens-review-packet';

function contentTypeForFormat(format: ReviewPacketFormat): string {
  return format === 'json'
    ? 'application/json; charset=utf-8'
    : 'text/markdown; charset=utf-8';
}

async function tryLogAuditEvent(event: Parameters<typeof logAuditEvent>[0]): Promise<{ ok: true } | { ok: false }> {
  try {
    await logAuditEvent(event);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function auditWriteFailureResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Review packet export is temporarily unavailable',
      code: 'AUDIT_WRITE_FAILED',
    },
    { status: 503 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matterId: string }> },
): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const searchParams = new URL(request.url).searchParams;
    const authz = await requireVerifiedOrgAccess(request);
    if (!authz.ok) return authz.response;

    const permission = requireVerifiedPermission(authz.context, 'export.read');
    if (!permission.ok) {
      const auditResult = await tryLogAuditEvent({
        action: 'courtlens.review_packet.export_denied',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId: (await params).matterId,
          reason: 'insufficient_permission',
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
          requestedFormat: searchParams.get('format') ?? null,
          locale: normalizeReviewPacketLocale(searchParams.get('locale')),
        },
      });
      if (!auditResult.ok) {
        return auditWriteFailureResponse();
      }
      return permission.response;
    }

    const { matterId } = await params;
    if (!matterId || typeof matterId !== 'string') {
      return NextResponse.json(
        { error: 'Missing matter ID', code: 'MISSING_MATTER_ID' },
        { status: 400 },
      );
    }

    const rawFormat = searchParams.get('format');
    if (!isReviewPacketFormat(rawFormat)) {
      const auditResult = await tryLogAuditEvent({
        action: 'courtlens.review_packet.export_denied',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId,
          reason: 'invalid_format',
          requestedFormat: rawFormat,
          locale: normalizeReviewPacketLocale(searchParams.get('locale')),
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
        },
      });
      if (!auditResult.ok) {
        return auditWriteFailureResponse();
      }
      return NextResponse.json(
        {
          error: 'Invalid review packet format',
          code: 'INVALID_REVIEW_PACKET_FORMAT',
          allowed: SUPPORTED_REVIEW_PACKET_FORMATS,
        },
        { status: 400 },
      );
    }

    const rawLocale = searchParams.get('locale');
    if (rawLocale !== null && !isReviewPacketLocale(rawLocale)) {
      const auditResult = await tryLogAuditEvent({
        action: 'courtlens.review_packet.export_denied',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId,
          reason: 'invalid_locale',
          requestedFormat: rawFormat,
          requestedLocale: rawLocale,
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
        },
      });
      if (!auditResult.ok) {
        return auditWriteFailureResponse();
      }

      return NextResponse.json(
        {
          error: 'Invalid review packet locale',
          code: 'INVALID_REVIEW_PACKET_LOCALE',
          allowed: SUPPORTED_REVIEW_PACKET_LOCALES,
        },
        { status: 400 },
      );
    }

    const locale = normalizeReviewPacketLocale(rawLocale);

    const result = await getMatterDetail(authz.context.orgId, matterId, {
      role: authz.context.role,
      includeSensitiveNotes: true,
    });

    if (!result) {
      const auditResult = await tryLogAuditEvent({
        action: 'courtlens.review_packet.export_denied',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId,
          reason: 'matter_not_found',
          requestedFormat: rawFormat,
          locale,
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
        },
      });
      if (!auditResult.ok) {
        return auditWriteFailureResponse();
      }
      return NextResponse.json(
        { error: 'Matter not found', code: 'MATTER_NOT_FOUND' },
        { status: 404 },
      );
    }

    const packet = buildCourtLensReviewPacket(
      result.matter,
      result.detail!,
      authz.context.role,
      locale,
    );

    if (!packet.packet.documentReadiness.isPacketExternalizable) {
      const auditResult = await tryLogAuditEvent({
        action: 'courtlens.review_packet.export_denied',
        actorUserId: authz.context.userId,
        orgId: authz.context.orgId,
        entityType: 'matter',
        details: {
          matterId,
          reason: 'packet_not_externalizable',
          requestedFormat: rawFormat,
          locale,
          role: authz.context.role,
          membershipSource: authz.context.membershipSource,
          isPacketExternalizable: false,
          packetSchemaVersion: packet.schemaVersion,
        },
      });
      if (!auditResult.ok) {
        return auditWriteFailureResponse();
      }
      return NextResponse.json(
        {
          error: 'Review packet is not available for export',
          code: 'REVIEW_PACKET_NOT_EXTERNALIZABLE',
        },
        { status: 409 },
      );
    }

    const serialized = rawFormat === 'json'
      ? serializeReviewPacketJson(packet)
      : serializeReviewPacketMarkdown(packet);

    const filename = buildReviewPacketFilename(packet, rawFormat);
    const byteCount = new TextEncoder().encode(serialized).length;
    const contentHash = createHash('sha256').update(serialized, 'utf8').digest('hex');

    const auditResult = await tryLogAuditEvent({
      action: 'courtlens.review_packet.exported',
      actorUserId: authz.context.userId,
      orgId: authz.context.orgId,
      entityType: 'matter',
      details: {
        matterId,
        format: rawFormat,
        locale,
        role: authz.context.role,
        membershipSource: authz.context.membershipSource,
        isPacketExternalizable: true,
        packetSchemaVersion: packet.schemaVersion,
        packetProjectionVersion: packet.projectionVersion,
        bytes: byteCount,
        contentSha256: contentHash,
      },
    });

    if (!auditResult.ok) {
      return auditWriteFailureResponse();
    }

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        'content-type': contentTypeForFormat(rawFormat),
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
}
