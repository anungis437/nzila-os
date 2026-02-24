/**
 * Marketing Growth Engine Notification Templates
 * 
 * SPRINT 7: Notification System Integration
 * 
 * Email templates for marketing-related events:
 * - Pilot application approvals/rejections
 * - Consent change confirmations
 * - Testimonial approvals (optional - respectful)
 * - Case study publications (internal)
 * 
 * Philosophy: "Celebrate wins, respect decisions, maintain transparency"
 */

import { getNotificationService } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';

/**
 * Send pilot application approval email
 * 
 * Celebrates the approval, explains next steps, provides contact information
 */
export async function sendPilotApprovalNotification(
  organizationId: string,
  applicantEmail: string,
  applicantName: string,
  organizationName: string,
  pilotId: string,
  approverNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const body = `Dear ${applicantName},

Great news! Your pilot application for ${organizationName} has been approved.

We&apos;re excited to have you join the Union Eyes pilot program. Here's what happens next:

**Next Steps:**
1. Our implementation team will contact you within 3-5 business days
2. We&apos;ll schedule an onboarding call to discuss your organization's specific needs
3. You&apos;ll receive access credentials and setup documentation
4. We&apos;ll assign a dedicated support contact for your pilot

${approverNotes ? `\n**Additional Notes:**\n${approverNotes}\n` : ''}

**What to Expect:**
- Personalized onboarding session
- Ongoing support throughout the pilot
- Regular check-ins to ensure success
- Opportunity to provide feedback that shapes the platform

We&apos;re committed to making Union Eyes work for your members. If you have any questions in the meantime, please don&apos;t hesitate to reach out.

In solidarity,
The Union Eyes Team`;

    await notificationService.send({
      organizationId,
      recipientEmail: applicantEmail,
      type: 'email',
      priority: 'high',
      subject: `Union Eyes Pilot Application Approved - ${organizationName}`,
      title: 'Pilot Application Approved',
      body,
      actionUrl: `/pilot/${pilotId}`,
      actionLabel: 'View Pilot Dashboard',
      metadata: {
        type: 'pilot_approved',
        pilotId,
        organizationName,
      },
    });

    logger.info('Pilot approval notification sent', {
      organizationId,
      pilotId,
      applicantEmail: applicantEmail.substring(0, 10) + '***',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send pilot approval notification', {
      error,
      organizationId,
      pilotId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send pilot application rejection email
 * 
 * Respectful, explains decision (if notes provided), offers alternatives
 */
export async function sendPilotRejectionNotification(
  organizationId: string,
  applicantEmail: string,
  applicantName: string,
  organizationName: string,
  pilotId: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const body = `Dear ${applicantName},

Thank you for your interest in the Union Eyes pilot program for ${organizationName}.

After careful review, we&apos;re unable to move forward with your pilot application at this time${
      rejectionReason ? `. ${rejectionReason}` : ''
    }

**What This Means:**
This decision doesn&apos;t reflect on your organization's needs or mission. We have limited pilot capacity and must prioritize applications that align with current program goals.

**Alternative Options:**
- Join our waitlist for the next pilot cohort
- Subscribe to product updates to stay informed about general availability
- Explore our case studies to see how other unions are using the platform
- Contact us to discuss customized implementation pathways

We deeply appreciate your interest and remain committed to supporting labor organizing. We encourage you to reapply when the next pilot cohort opens.

In solidarity,
The Union Eyes Team`;

    await notificationService.send({
      organizationId,
      recipientEmail: applicantEmail,
      type: 'email',
      priority: 'normal',
      subject: `Union Eyes Pilot Application Update - ${organizationName}`,
      title: 'Pilot Application Update',
      body,
      actionUrl: '/case-studies',
      actionLabel: 'View Case Studies',
      metadata: {
        type: 'pilot_rejected',
        pilotId,
        organizationName,
      },
    });

    logger.info('Pilot rejection notification sent', {
      organizationId,
      pilotId,
      applicantEmail: applicantEmail.substring(0, 10) + '***',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send pilot rejection notification', {
      error,
      organizationId,
      pilotId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send data sharing consent granted confirmation
 * 
 * Thanks user, explains what data is shared, emphasizes privacy protections
 */
export async function sendConsentGrantedNotification(
  organizationId: string,
  userId: string,
  userEmail: string,
  userName: string,
  dataTypes: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const dataTypeDescriptions: Record<string, string> = {
      impact_metrics: 'Impact metrics (resolution times, win rates)',
      resolution_times: 'Resolution time data (anonymized)',
      demographics: 'Demographic data for your organization (aggregated only)',
      industry_insights: 'Industry-specific trends',
      legislative_data: 'Legislative advocacy data',
    };

    const sharedDataList = dataTypes
      .map((type) => `- ${dataTypeDescriptions[type] || type}`)
      .join('\n');

    const body = `Dear ${userName},

Thank you for choosing to share data with the broader labor movement. Your contribution helps unions nationwide learn from each other and build collective power.

**What You&apos;re Sharing:**
${sharedDataList}

**How Your Data is Protected:**
- Your data is NEVER shared individually - only in aggregated form with 5+ other organizations
- Statistical noise (≤2%) is added to all aggregated data to prevent re-identification
- You can revoke consent at any time through your settings
- All aggregation respects strict privacy thresholds (minimum 10-25 cases depending on data type)
- Cross-union insights are used solely for labor movement strengthening

**How This Helps:**
- Other unions can learn from successful strategies
- Legislative advocacy is strengthened with cross-union data
- The labor movement builds shared knowledge
- Unions can benchmark anonymously without revealing sensitive information

You can view movement insights in your dashboard or revoke consent anytime.

Thank you for your solidarity.

In unity,
The Union Eyes Team`;

    await notificationService.send({
      organizationId,
      recipientEmail: userEmail,
      type: 'email',
      priority: 'normal',
      subject: 'Data Sharing Consent Confirmed - Thank You',
      title: 'Data Sharing Enabled',
      body,
      actionUrl: '/dashboard/movement-insights',
      actionLabel: 'View Movement Insights',
      metadata: {
        type: 'consent_granted',
        dataTypes,
      },
      userId,
    });

    logger.info('Consent granted notification sent', {
      organizationId,
      userId,
      dataTypes,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send consent granted notification', {
      error,
      organizationId,
      userId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send data sharing consent revoked acknowledgment
 * 
 * Respects decision, explains data handling, confirms user can re-enable
 */
export async function sendConsentRevokedNotification(
  organizationId: string,
  userId: string,
  userEmail: string,
  userName: string,
  revokedDataTypes: string[],
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const body = `Dear ${userName},

We've received your request to revoke data sharing consent. Your data sharing has been disabled.

**What Happens Now:**
- Your organization's data will no longer be included in future aggregations
- Previously aggregated data cannot be "unshared" (it&apos;s already anonymized and combined)
- Your organization's individual data remains private and accessible only to you
- You can re-enable data sharing anytime through your settings

**Your Privacy:**
- Your decision is respected without question
- No data from your organization will be used in cross-union insights going forward
- You can still view movement insights based on other consenting organizations
- Re-enabling is simple if you change your mind

${reason ? `We appreciate your feedback: "${reason}". This helps us improve our data sharing practices.\n` : ''}

Thank you for considering data sharing. We remain committed to transparency and member sovereignty.

In solidarity,
The Union Eyes Team`;

    await notificationService.send({
      organizationId,
      recipientEmail: userEmail,
      type: 'email',
      priority: 'normal',
      subject: 'Data Sharing Consent Revoked - Confirmed',
      title: 'Data Sharing Disabled',
      body,
      actionUrl: '/dashboard/settings/data-sharing',
      actionLabel: 'View Data Sharing Settings',
      metadata: {
        type: 'consent_revoked',
        revokedDataTypes,
        reason,
      },
      userId,
    });

    logger.info('Consent revoked notification sent', {
      organizationId,
      userId,
      revokedDataTypes,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send consent revoked notification', {
      error,
      organizationId,
      userId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send testimonial approval notification (OPTIONAL - only if submitter requests it)
 * 
 * Celebrates their contribution, explains where it will appear
 */
export async function sendTestimonialApprovedNotification(
  organizationId: string,
  submitterEmail: string,
  submitterName: string,
  testimonialId: string,
  quote: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const truncatedQuote = quote.length > 150 ? quote.substring(0, 150) + '...' : quote;

    const body = `Dear ${submitterName},

Thank you for sharing your testimonial with the Union Eyes community. We&apos;re pleased to let you know it has been approved and is now live!

**Your Testimonial:**
"${truncatedQuote}"

**Where It Appears:**
- Union Eyes origin story page
- Social proof section for prospective pilots
- Community testimonials showcase

Your words help other unions understand the real-world impact of Union Eyes. Thank you for contributing to the movement.

In solidarity,
The Union Eyes Team`;

    await notificationService.send({
      organizationId,
      recipientEmail: submitterEmail,
      type: 'email',
      priority: 'low', // Optional notification - not urgent
      subject: 'Your Testimonial is Now Live - Thank You!',
      title: 'Testimonial Approved',
      body,
      actionUrl: '/story',
      actionLabel: 'View Origin Story',
      metadata: {
        type: 'testimonial_approved',
        testimonialId,
      },
    });

    logger.info('Testimonial approved notification sent', {
      organizationId,
      testimonialId,
      submitterEmail: submitterEmail.substring(0, 10) + '***',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send testimonial approved notification', {
      error,
      organizationId,
      testimonialId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send internal notification when new case study is published
 * 
 * Notifies internal team so they can promote it
 */
export async function sendCaseStudyPublishedNotification(
  organizationId: string,
  internalTeamEmails: string[],
  caseStudySlug: string,
  caseStudyTitle: string,
  organizationName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const notificationService = getNotificationService();

    const body = `New case study published!

**Title:** ${caseStudyTitle}
**Organization:** ${organizationName}
**Slug:** ${caseStudySlug}

The case study is now live and ready to be shared with prospective pilots.

**Suggested Actions:**
- Share on social media channels
- Include in pilot outreach emails
- Feature in upcoming newsletters
- Add to relevant marketing materials

View the case study to review formatting and content.`;

    // Send to each internal team member
    for (const email of internalTeamEmails) {
      await notificationService.send({
        organizationId,
        recipientEmail: email,
        type: 'email',
        priority: 'normal',
        subject: `New Case Study Published: ${caseStudyTitle}`,
        title: 'Case Study Published',
        body,
        actionUrl: `/case-studies/${caseStudySlug}`,
        actionLabel: 'View Case Study',
        metadata: {
          type: 'case_study_published',
          caseStudySlug,
          organizationName,
        },
      });
    }

    logger.info('Case study published notifications sent', {
      organizationId,
      caseStudySlug,
      recipientCount: internalTeamEmails.length,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to send case study published notifications', {
      error,
      organizationId,
      caseStudySlug,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  sendPilotApprovalNotification,
  sendPilotRejectionNotification,
  sendConsentGrantedNotification,
  sendConsentRevokedNotification,
  sendTestimonialApprovedNotification,
  sendCaseStudyPublishedNotification,
};
