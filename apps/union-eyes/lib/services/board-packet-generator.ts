/**
 * Board Packet Distribution Service
 *
 * Distributes a finalized board packet: the recipients, the move to 'distributed' and the audit record commit together, and the PDF is rendered from the
 * packet's own certified content. A packet's content is supplied and finalized through /api/governance/board-packets (lib/governance/board-packet-lifecycle.ts).
 * The generator this module once held derived a packet's sections from other tables, read a relation the database never had and filled the financial
 * summary with placeholder zeros and the compliance section with an unconditional "all requirements met"; nothing called it and it was removed in the
 * mismatch census (UE-CONV-H-017). The class keeps its name because the route manifest and the caller inventory refer to this path and export.
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { Document, Page, StyleSheet, Text, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import {
  boardPackets,
  boardPacketDistributions,
} from '@/db/schema/board-packet-schema';
import { organizationMembers } from '@/db/schema-organizations';
import { getEmailService } from '@/lib/services/messaging/email-service';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { boardPacketCertificationIntact } from '@/lib/governance/board-packet-lifecycle';

type BoardPacketRow = typeof boardPackets.$inferSelect;

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Text placed in an HTML email: the packet title and the recipient's name are data, not markup. */
const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);

const asText = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

/** A section's summary, then each further detail it carries, so nothing an officer wrote is dropped from the document. */
function sectionLines(label: string, section: unknown): string[] {
  if (section === null || section === undefined) return [];
  const { summary, ...detail } = (typeof section === 'object' ? section : {}) as Record<string, unknown>;
  return [
    `${label}: ${typeof summary === 'string' && summary.trim() ? summary : 'N/A'}`,
    ...Object.entries(detail).map(([key, value]) => `    ${key}: ${asText(value)}`),
  ];
}

function actionItemLines(items: unknown): string[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return [
    'Action items:',
    ...items.map((entry) => {
      const { item, owner, deadline, status } = (entry ?? {}) as Record<string, unknown>;
      const facts = [owner && `owner ${asText(owner)}`, deadline && `due ${asText(deadline)}`, status && asText(status)].filter(Boolean);
      return `    - ${asText(item)}${facts.length ? ` (${facts.join(', ')})` : ''}`;
    }),
  ];
}

export class BoardPacketGenerator {
  /**
   * Distribute a finalized board packet to recipients.
   *
   * The distribution records, the move to 'distributed' and the audit record commit together, and only active members of
   * the packet's own organization can receive it (their name and address are taken from their membership record, never from the
   * request). Email delivery happens after that commit; a failed delivery is reported and recorded, and does not
   * undo the recorded distribution.
   */
  async distributePacket(
    packetId: string,
    recipients: Array<{ recipientId: string; recipientRole: string }>,
    context: { organizationId: string; userId: string }
  ) {
    const { organizationId, userId } = context;
    try {
      const packet = await withRLSContext({ organizationId }, async (tx) => {
        const [row] = await tx
          .select()
          .from(boardPackets)
          .where(and(eq(boardPackets.id, packetId), eq(boardPackets.organizationId, organizationId)))
          .limit(1);
        return row;
      });

      if (!packet) {
        throw ApiError.notFound('Board packet');
      }
      if (packet.status !== 'finalized' && packet.status !== 'distributed') {
        throw ApiError.conflict('Only a finalized board packet can be distributed');
      }
      if (!boardPacketCertificationIntact(packet)) {
        throw ApiError.conflict("The board packet's content does not match its certification: reopen it as a draft and finalize it again");
      }

      const pdfResult = await this.generatePDF(packet);

      const distributions = await withRLSContext({ organizationId }, async (tx) => {
        const members = await tx
          .select({ userId: organizationMembers.userId, name: organizationMembers.name, email: organizationMembers.email })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              inArray(organizationMembers.userId, recipients.map((recipient) => recipient.recipientId)),
              eq(organizationMembers.status, 'active'),
              isNull(organizationMembers.deletedAt)
            )
          );
        const memberById = new Map(members.map((member) => [member.userId, member]));
        const verified = recipients.map((recipient) => {
          const member = memberById.get(recipient.recipientId);
          if (!member) {
            throw ApiError.badRequest('Every recipient must be an active member of the organization');
          }
          return { ...recipient, recipientName: member.name, recipientEmail: member.email };
        });

        const rows = await tx
          .insert(boardPacketDistributions)
          .values(
            verified.map((recipient) => ({
              packetId,
              ...recipient,
              deliveryMethod: 'email',
              sentAt: new Date(),
            }))
          )
          .returning();

        // The predicate keeps a concurrent archive, or a reopen and a new certification, from being overwritten by what was rendered above.
        const [updated] = await tx
          .update(boardPackets)
          .set({
            status: 'distributed',
            distributedAt: new Date(),
            distributionList: verified,
            pdfUrl: pdfResult.pdfUrl,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(boardPackets.id, packetId),
              eq(boardPackets.organizationId, organizationId),
              inArray(boardPackets.status, ['finalized', 'distributed']),
              eq(boardPackets.contentHash, packet.contentHash!)
            )
          )
          .returning({ id: boardPackets.id });
        if (!updated) throw ApiError.conflict('The board packet changed and can no longer be distributed');

        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'board_packet.distribute',
          resourceType: 'board_packets',
          resourceId: packetId,
          details: {
            recipientIds: verified.map((recipient) => recipient.recipientId),
            deliveryMethod: 'email',
            contentHash: packet.contentHash,
          },
        });
        return rows;
      });

      const emailService = getEmailService();
      const attachmentName = `${packet.title.replace(/[^\p{L}\p{N}._-]+/gu, '_')}.pdf`;
      const outcomes = await Promise.allSettled(
        distributions.map((recipient) =>
          emailService.send({
            to: recipient.recipientEmail,
            subject: `Board Packet: ${packet.title}`,
            body: `Board Packet: ${packet.title} - Period: ${packet.periodStart} to ${packet.periodEnd}`,
            html: `
            <h2>${escapeHtml(packet.title)}</h2>
            <p>Hello ${escapeHtml(recipient.recipientName)},</p>
            <p>The latest board packet has been distributed.</p>
            <p>Period: ${escapeHtml(String(packet.periodStart))} to ${escapeHtml(String(packet.periodEnd))}</p>
          `,
            attachments: [
              {
                filename: attachmentName,
                content: pdfResult.pdfBuffer,
                contentType: 'application/pdf',
              },
            ],
          })
        )
      );

      const failedRecipientIds = distributions
        .filter((_, index) => outcomes[index].status === 'rejected')
        .map((recipient) => recipient.recipientId);
      if (failedRecipientIds.length > 0) {
        logger.error('Board packet email delivery failed for some recipients', { packetId, failedRecipientIds });
        await withRLSContext({ organizationId }, (tx) =>
          persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'board_packet.distribute.delivery_failed',
            resourceType: 'board_packets',
            resourceId: packetId,
            details: { failedRecipientIds },
          })
        ).catch((error) => logger.error('Board packet delivery failure could not be audited', { packetId, error }));
      }

      return {
        distributions,
        delivered: distributions.length - failedRecipientIds.length,
        failed: failedRecipientIds.length,
      };
    } catch (error) {
      logger.error('Error distributing board packet', error);
      throw error;
    }
  }

  private async generatePDF(packet: BoardPacketRow): Promise<{ pdfBuffer: Buffer; pdfUrl: string }> {
    const styles = StyleSheet.create({
      page: { padding: 32, fontSize: 12 },
      title: { fontSize: 18, marginBottom: 12 },
      section: { marginBottom: 8 },
    });

    const lines = [
      `Period: ${packet.periodStart} to ${packet.periodEnd}`,
      `Status: ${packet.status}`,
      `Certified: ${packet.finalizedAt?.toISOString() ?? 'N/A'} by ${packet.signedBy ?? 'N/A'} (SHA-256 ${packet.contentHash ?? 'N/A'})`,
      ...sectionLines('Financial Summary', packet.financialSummary),
      ...sectionLines('Membership Summary', packet.membershipStats),
      ...sectionLines('Case Summary', packet.caseSummary),
      ...sectionLines('Motions and Votes', packet.motionsAndVotes),
      ...sectionLines('Audit Exceptions', packet.auditExceptions),
      ...sectionLines('Compliance Summary', packet.complianceStatus),
      ...actionItemLines(packet.actionItems),
    ];

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, packet.title),
        ...lines.map((line, index) => React.createElement(Text, { key: index, style: styles.section }, line))
      )
    );

    const pdfBuffer = await renderToBuffer(doc);
    const pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    return { pdfBuffer, pdfUrl };
  }
}

// Export singleton instance
export const boardPacketGenerator = new BoardPacketGenerator();
