/**
 * Claim Notification Service
 * 
 * Handles sending email notifications for claim status changes
 * @server-only
 */

import 'server-only';
import { sendEmail, EmailRecipient } from './email-service';
import { render } from '@react-email/render';
import { ClaimStatusNotificationEmail } from './email-templates';
import { db } from '../db/db';
import { claims } from '../db/schema/claims-schema';
import { eq, and } from 'drizzle-orm';
import { ClaimStatus } from './workflow-engine';
import * as React from 'react';
import { clerkClient } from '@clerk/nextjs/server';
import { deadlines } from '../db/schema/deadlines-schema';

interface ClaimNotificationData {
  claimId: string;
  claimTitle: string;
  claimType: string;
  previousStatus?: string;
  newStatus: string;
  notes?: string;
  humanMessage?: string; // SPRINT 7: Human-readable status explanation
  daysInState?: number; // SPRINT 7: Context for timeline message
  // deadline?: Date; // Not yet implemented in claims schema
  // daysRemaining?: number; // Not yet implemented in claims schema
  memberEmail: string;
  memberName: string;
  assignedStewardEmail?: string;
  assignedStewardName?: string;
  organizationId: string;
}

/**
 * Send notification email when claim status changes
 */
export async function sendClaimStatusNotification(
  claimId: string,
  previousStatus: string | undefined,
  newStatus: ClaimStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get claim details
    const [claim] = await db
      .select({
        claimId: claims.claimId,
        claimType: claims.claimType,
        description: claims.description,
        memberId: claims.memberId,
        assignedTo: claims.assignedTo,
        organizationId: claims.organizationId,
      })
      .from(claims)
      .where(eq(claims.claimId, claimId))
      .limit(1);

    if (!claim) {
      return { success: false, error: 'Claim not found' };
    }

    // Get member details from Clerk
    const member = await (await clerkClient()).users.getUser(claim.memberId);

    if (!member || !member.emailAddresses?.[0]?.emailAddress) {
      return { success: false, error: 'Member email not found' };
    }
    
    const memberEmail = member.emailAddresses[0].emailAddress;
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member';

    // Get assigned steward details if assigned
    let assignedStewardEmail: string | undefined;
    let assignedStewardName: string | undefined;
    if (claim.assignedTo) {
      try {
        const steward = await (await clerkClient()).users.getUser(claim.assignedTo);
        if (steward?.emailAddresses?.[0]?.emailAddress) {
          assignedStewardEmail = steward.emailAddresses[0].emailAddress;
          assignedStewardName = `${steward.firstName || ''} ${steward.lastName || ''}`.trim() || 'Steward';
        }
      } catch (_error) {
}
    }

    // SPRINT 7: Generate human-readable status update message
    // Uses compassionate, context-aware language from timeline builder
    const daysInState = 0; // Just changed, so 0 days in new state
    const _priority = 'medium'; // Default priority (can be enhanced with actual priority later)
    const humanMessage = `Your claim status has been updated to ${newStatus}.`;

    // Build notification data (deadline support not implemented in schema yet)
    const notificationData: ClaimNotificationData = {
      claimId: claim.claimId,
      claimTitle: `${claim.claimType} Claim`,
      claimType: claim.claimType,
      previousStatus,
      newStatus,
      notes,
      humanMessage,
      daysInState,
      memberEmail,
      memberName,
      assignedStewardEmail,
      assignedStewardName,
      organizationId: claim.organizationId,
    };

    // Send notification
    return await sendClaimNotificationEmail(notificationData);
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send the actual email notification
 */
async function sendClaimNotificationEmail(
  data: ClaimNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Build claim URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const claimUrl = `${baseUrl}/dashboard/claims/${data.claimId}`;

    // Determine recipients
    const recipients: EmailRecipient[] = [
      {
        email: data.memberEmail,
        name: data.memberName,
      },
    ];

    // Add assigned steward to recipients for certain status changes
    const stewardNotificationStatuses = [
      'assigned',
      'investigation',
      'pending_documentation',
      'resolved',
    ];
    if (
      data.assignedStewardEmail &&
      data.assignedStewardName &&
      stewardNotificationStatuses.includes(data.newStatus)
    ) {
      recipients.push({
        email: data.assignedStewardEmail,
        name: data.assignedStewardName,
      });
    }

    // Generate email HTML with human-readable message (SPRINT 7)
    const emailHtml = await render(
      React.createElement(ClaimStatusNotificationEmail, {
        claimId: data.claimId,
        claimTitle: data.claimTitle,
        claimType: data.claimType,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        memberName: data.memberName,
        notes: data.notes,
        humanMessage: data.humanMessage, // Context-aware compassionate message
        // deadline: undefined, // Not yet implemented in claims schema
        // daysRemaining: undefined, // Not yet implemented in claims schema
        assignedStewardName: data.assignedStewardName,
        claimUrl,
      })
    );

    // Build subject line
    const subject = getEmailSubject(data.newStatus, data.claimTitle, data.previousStatus);

    // Send email
    const result = await sendEmail({
      to: recipients,
      subject,
      html: emailHtml,
    });

    if (result.success) {
}

    return result;
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate email subject line based on status
 */
function getEmailSubject(
  newStatus: string,
  claimTitle: string,
  previousStatus?: string
): string {
  const statusNames: Record<string, string> = {
    submitted: 'Claim Submitted',
    under_review: 'Claim Under Review',
    assigned: 'Claim Assigned',
    investigation: 'Claim Under Investigation',
    pending_documentation: 'Documentation Required',
    resolved: 'Claim Resolved',
    rejected: 'Claim Rejected',
    closed: 'Claim Closed',
  };

  const statusName = statusNames[newStatus] || 'Status Update';
  const isInitial = !previousStatus || previousStatus === 'submitted';

  if (isInitial) {
    return `${statusName}: ${claimTitle}`;
  }

  return `${statusName} - ${claimTitle}`;
}

/**
 * Send notification for overdue claims
 * NOTE: Deadline tracking not yet implemented in schema
 * This function is a placeholder for future implementation
 */
export async function sendOverdueClaimNotification(
  claimId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [claim] = await db
      .select({
        claimId: claims.claimId,
        claimType: claims.claimType,
        description: claims.description,
        memberId: claims.memberId,
        assignedTo: claims.assignedTo,
        organizationId: claims.organizationId,
      })
      .from(claims)
      .where(eq(claims.claimId, claimId))
      .limit(1);

    if (!claim) {
      return { success: false, error: 'Claim not found' };
    }

    const overdueDeadlines = await db
      .select({
        deadlineName: deadlines.deadlineName,
        dueDate: deadlines.dueDate,
        status: deadlines.status,
        priority: deadlines.priority,
      })
      .from(deadlines)
      .where(
        and(
          eq(deadlines.claimId, claimId),
          eq(deadlines.status, 'pending'),
          eq(deadlines.isOverdue, true)
        )
      );

    if (overdueDeadlines.length === 0) {
      return { success: false, error: 'No overdue deadlines found' };
    }

    const member = await (await clerkClient()).users.getUser(claim.memberId);
    const memberEmail = member?.emailAddresses?.[0]?.emailAddress;
    if (!memberEmail) {
      return { success: false, error: 'Member email not found' };
    }
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member';

    let assignedStewardEmail: string | undefined;
    let assignedStewardName: string | undefined;
    if (claim.assignedTo) {
      try {
        const steward = await (await clerkClient()).users.getUser(claim.assignedTo);
        if (steward?.emailAddresses?.[0]?.emailAddress) {
          assignedStewardEmail = steward.emailAddresses[0].emailAddress;
          assignedStewardName = `${steward.firstName || ''} ${steward.lastName || ''}`.trim() || 'Steward';
        }
      } catch (_error) {
}
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const claimUrl = `${baseUrl}/dashboard/claims/${claimId}`;

    const recipients: EmailRecipient[] = [
      { email: memberEmail, name: memberName },
    ];
    if (assignedStewardEmail && assignedStewardName) {
      recipients.push({ email: assignedStewardEmail, name: assignedStewardName });
    }

    const deadlineListHtml = overdueDeadlines
      .map(
        (deadline) =>
          `<li><strong>${deadline.deadlineName}</strong> (due ${new Date(deadline.dueDate).toLocaleDateString()})</li>`
      )
      .join('');

    const subject = `Overdue Claim Deadlines: ${claim.claimType} Claim`;
    const html = `
      <p>One or more deadlines are overdue for claim <strong>${claim.claimType}</strong>.</p>
      <ul>${deadlineListHtml}</ul>
      <p><a href="${claimUrl}">View claim details</a></p>
    `;

    const result = await sendEmail({
      to: recipients,
      subject,
      html,
    });

    return result;
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  /* IMPLEMENTATION PENDING - Requires deadline field in claims schema
  try {
    // Get claim and member details
    const [claim] = await db
      .select({
        claimId: claims.claimId,
        claimType: claims.claimType,
        status: claims.status,
        memberId: claims.memberId,
        assignedTo: claims.assignedTo,
        // deadline: claims.deadline, // Field doesn&apos;t exist yet
      })
      .from(claims)
      .where(eq(claims.claimId, claimId))
      .limit(1);

    if (!claim) {
      return { success: false, error: 'Claim not found' };
    }

    // Get member from Clerk
    const member = await clerkClient.users.getUser(claim.memberId);
    if (!member?.emailAddresses?.[0]?.emailAddress) {
      return { success: false, error: 'Member email not found' };
    }
    
    const memberEmail = member.emailAddresses[0].emailAddress;
    const memberName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Member';

    // Get assigned steward if exists
    let stewardEmail: string | undefined;
    let stewardName: string | undefined;
    if (claim.assignedTo) {
      try {
        const steward = await clerkClient.users.getUser(claim.assignedTo);
        if (steward?.emailAddresses?.[0]?.emailAddress) {
          stewardEmail = steward.emailAddresses[0].emailAddress;
          stewardName = `${steward.firstName || ''} ${steward.lastName || ''}`.trim() || 'Steward';
        }
      } catch (error) {
}
    }

    // Send to member and steward
    const recipients: EmailRecipient[] = [
      {
        email: memberEmail,
        name: memberName,
      },
    ];

    if (stewardEmail && stewardName) {
      recipients.push({
        email: stewardEmail,
        name: stewardName,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const claimUrl = `${baseUrl}/dashboard/claims/${claim.claimId}`;

    // Simple HTML for overdue notification
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1>Claim Overdue</h1>
        </div>
        <div style="padding: 32px;">
          <p>This is a reminder that your claim is now overdue:</p>
          <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p><strong>Claim ID:</strong> ${claim.claimId}</p>
            <p><strong>Type:</strong> ${claim.claimType}</p>
            <p><strong>Status:</strong> ${claim.status}</p>
          </div>
          <p>Please take action on this claim as soon as possible to avoid further delays.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${claimUrl}" style="background-color: #dc2626; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block;">View Claim</a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
          <p>This is an automated notification from the Union Claims Portal.</p>
        </div>
      </div>
    `;

    return await sendEmail({
      to: recipients,
      subject: `âš ï¸ Claim Overdue: ${claim.claimType} Claim`,
      html,
    });
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  */
}

