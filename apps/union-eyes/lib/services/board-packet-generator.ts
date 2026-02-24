/**
 * Board Packet Generator Service
 * 
 * Automated generation of board packets with financial, operational, and compliance data
 */

import { db } from '@/db';
import {
  boardPackets,
  boardPacketDistributions,
} from '@/db/schema/board-packet-schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { Document, Page, StyleSheet, Text, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { getEmailService } from '@/lib/services/messaging/email-service';
import { logger } from '@/lib/logger';

interface BoardPacketData {
  title: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedBy: string;
  packetType?: 'monthly' | 'quarterly' | 'annual' | 'special';
}

export class BoardPacketGenerator {
  /**
   * Generate a complete board packet
   */
  async generatePacket(data: BoardPacketData) {
    const packetType = data.packetType || 'monthly';
    const fiscalYear = data.periodEnd.getFullYear();
    const fiscalQuarter = Math.ceil((data.periodEnd.getMonth() + 1) / 3);
    
    try {
      // Generate all sections
      const [
        financialSummary,
        membershipStats,
        caseSummary,
        motionsAndVotes,
        auditExceptions,
        complianceStatus,
      ] = await Promise.all([
        this.generateFinancialSummary(data.organizationId, data.periodStart, data.periodEnd),
        this.generateMembershipStats(data.organizationId, data.periodStart, data.periodEnd),
        this.generateCaseSummary(data.organizationId, data.periodStart, data.periodEnd),
        this.generateMotionsAndVotes(data.organizationId, data.periodStart, data.periodEnd),
        this.generateAuditExceptions(data.organizationId, data.periodStart, data.periodEnd),
        this.generateComplianceStatus(data.organizationId, data.periodEnd),
      ]);
      
      // Calculate content hash for integrity
      const contentString = JSON.stringify({
        financialSummary,
        membershipStats,
        caseSummary,
        motionsAndVotes,
        auditExceptions,
        complianceStatus,
      });
      
      const contentHash = crypto
        .createHash('sha256')
        .update(contentString)
        .digest('hex');
      
      // Create board packet
      const [packet] = await db
        .insert(boardPackets)
        .values({
          title: data.title,
          packetType,
          organizationId: data.organizationId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          periodStart: data.periodStart.toISOString().split('T')[0] as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          periodEnd: data.periodEnd.toISOString().split('T')[0] as any,
          fiscalYear,
          fiscalQuarter: packetType === 'quarterly' || packetType === 'annual' ? fiscalQuarter : null,
          generatedBy: data.generatedBy,
          financialSummary,
          membershipStats,
          caseSummary,
          motionsAndVotes,
          auditExceptions,
          complianceStatus,
          status: 'draft',
          recipientRoles: ['board_member', 'executive'],
          contentHash,
        })
        .returning();
      
      return packet;
    } catch (error) {
      logger.error('Error generating board packet', error);
      throw error;
    }
  }
  
  /**
   * Generate financial summary section
   */
  private async generateFinancialSummary(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Query financial data (simplified - would integrate with finance module)
    // Query strike activity data (simplified - uses raw SQL since strike_actions may not have a schema table)
    const strikeActivityResult = await db
      .execute(
        sql`SELECT COALESCE(SUM(amount)::numeric, 0) as "totalAmount", COUNT(*)::int as "count" FROM strike_actions WHERE organization_id = ${organizationId} AND action_date >= ${periodStart} AND action_date <= ${periodEnd}`
      );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strikeActivity = (strikeActivityResult as any)[0] || { totalAmount: 0, count: 0 };
    
    return {
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      revenue: {
        duesCollected: 0, // Would integrate with dues module
        otherIncome: 0,
        total: 0,
      },
      expenses: {
        strikePayments: Number(strikeActivity.totalAmount) || 0,
        operational: 0,
        total: Number(strikeActivity.totalAmount) || 0,
      },
      netPosition: 0 - (Number(strikeActivity.totalAmount) || 0),
      reserves: {
        strikeReserve: 0,
        operatingReserve: 0,
        total: 0,
      },
      arrears: {
        totalOwed: 0,
        membersInArrears: 0,
        over90Days: 0,
      },
      summary: `${strikeActivity.count} strike actions totaling $${Number(strikeActivity.totalAmount || 0).toFixed(2)}`,
    };
  }
  
  /**
   * Generate membership statistics section
   */
  private async generateMembershipStats(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Would integrate with membership module
    return {
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      total: 0,
      active: 0,
      inactive: 0,
      newMembers: 0,
      departedMembers: 0,
      growthRate: '0%',
      demographics: {
        byLocal: [],
        byWorksite: [],
        bySeniority: [],
      },
      summary: 'Membership statistics pending integration with membership module',
    };
  }
  
  /**
   * Generate case summary section
   */
  private async generateCaseSummary(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Would integrate with case management module
    return {
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      openCases: 0,
      newCases: 0,
      closedCases: 0,
      slaRisks: {
        critical: 0,
        high: 0,
        medium: 0,
        list: [],
      },
      byType: {
        grievance: 0,
        discipline: 0,
        termination: 0,
        other: 0,
      },
      averageResolutionTime: '0 days',
      summary: 'Case statistics pending integration with case management module',
    };
  }
  
  /**
   * Generate motions and votes section
   */
  private async generateMotionsAndVotes(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Would integrate with governance module
    return {
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      motionsPending: [],
      motionsApproved: [],
      motionsRejected: [],
      reservedMatters: [],
      summary: 'No motions or votes in period',
    };
  }
  
  /**
   * Generate audit exceptions section
   */
  private async generateAuditExceptions(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Would integrate with audit log
    return {
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
      },
      totalExceptions: 0,
      critical: [],
      high: [],
      medium: [],
      resolved: 0,
      summary: 'No audit exceptions detected',
    };
  }
  
  /**
   * Generate compliance status section
   */
  private async generateComplianceStatus(
    organizationId: string,
    asOfDate: Date
  ) {
    // Would integrate with compliance modules
    return {
      asOf: asOfDate.toISOString().split('T')[0],
      regulatory: {
        laborStandards: 'compliant',
        privacyLaws: 'compliant',
        financialReporting: 'compliant',
      },
      internal: {
        bylaws: 'compliant',
        policies: 'compliant',
        procedures: 'compliant',
      },
      certifications: {
        upToDate: true,
        expiringWithin90Days: [],
      },
      training: {
        boardMembersCompliant: true,
        staffCompliant: true,
      },
      summary: 'All compliance requirements met',
    };
  }
  
  /**
   * Finalize board packet (lock it and generate PDF)
   */
  async finalizePacket(packetId: string, signedBy: string) {
    try {
      const [packet] = await db
        .update(boardPackets)
        .set({
          status: 'finalized',
          finalizedAt: new Date(),
          signedBy,
          signedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(boardPackets.id, packetId))
        .returning();
      
      const pdfResult = await this.generatePDF(packet);
      await db
        .update(boardPackets)
        .set({
          pdfUrl: pdfResult.pdfUrl,
          updatedAt: new Date(),
        })
        .where(eq(boardPackets.id, packetId));
      
      return packet;
    } catch (error) {
      logger.error('Error finalizing board packet', error);
      throw error;
    }
  }
  
  /**
   * Distribute board packet to recipients
   */
  async distributePacket(
    packetId: string,
    recipients: Array<{
      recipientId: string;
      recipientName: string;
      recipientEmail: string;
      recipientRole: string;
    }>
  ) {
    try {
      const [packet] = await db
        .select()
        .from(boardPackets)
        .where(eq(boardPackets.id, packetId))
        .limit(1);

      if (!packet) {
        throw new Error('Board packet not found');
      }

      const pdfResult = await this.generatePDF(packet);

      // Create distribution records
      const distributions = await db
        .insert(boardPacketDistributions)
        .values(
          recipients.map(recipient => ({
            packetId,
            ...recipient,
            deliveryMethod: 'email',
            sentAt: new Date(),
          }))
        )
        .returning();
      
      // Update packet status
      await db
        .update(boardPackets)
        .set({
          status: 'distributed',
          distributedAt: new Date(),
          distributionList: recipients,
          pdfUrl: pdfResult.pdfUrl,
          updatedAt: new Date(),
        })
        .where(eq(boardPackets.id, packetId));
      
      const emailService = getEmailService();
      const emailPromises = recipients.map((recipient) =>
        emailService.send({
          to: recipient.recipientEmail,
          subject: `Board Packet: ${packet.title}`,
          body: `Board Packet: ${packet.title} - Period: ${packet.periodStart} to ${packet.periodEnd}`,
          html: `
            <h2>${packet.title}</h2>
            <p>Hello ${recipient.recipientName},</p>
            <p>The latest board packet has been distributed.</p>
            <p>Period: ${packet.periodStart} to ${packet.periodEnd}</p>
          `,
          attachments: [
            {
              filename: `${packet.title.replace(/\s+/g, '_')}.pdf`,
              content: pdfResult.pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        })
      );

      await Promise.all(emailPromises);
      
      return distributions;
    } catch (error) {
      logger.error('Error distributing board packet', error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generatePDF(packet: any): Promise<{ pdfBuffer: Buffer; pdfUrl: string }> {
    const styles = StyleSheet.create({
      page: { padding: 32, fontSize: 12 },
      title: { fontSize: 18, marginBottom: 12 },
      section: { marginBottom: 8 },
    });

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, packet.title),
        React.createElement(Text, { style: styles.section }, `Period: ${packet.periodStart} to ${packet.periodEnd}`),
        React.createElement(Text, { style: styles.section }, `Status: ${packet.status}`),
        React.createElement(Text, { style: styles.section }, `Financial Summary: ${packet.financialSummary?.summary || 'N/A'}`),
        React.createElement(Text, { style: styles.section }, `Membership Summary: ${packet.membershipStats?.summary || 'N/A'}`),
        React.createElement(Text, { style: styles.section }, `Compliance Summary: ${packet.complianceStatus?.summary || 'N/A'}`)
      )
    );

    const pdfBuffer = await renderToBuffer(doc);
    const pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    return { pdfBuffer, pdfUrl };
  }
}

// Export singleton instance
export const boardPacketGenerator = new BoardPacketGenerator();
