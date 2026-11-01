import type { ReactNode } from 'react';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { claimEducationReminder, releaseEducationReminder, type EducationReminderIdentity } from '@/lib/education/reminder-delivery';
import { getFromEmail, sendResendEmail } from '@/lib/email-service';
import RegistrationConfirmationEmail from "@/emails/training/registration-confirmation";
import SessionReminderEmail from "@/emails/training/session-reminder";
import CompletionCertificateEmail from "@/emails/training/completion-certificate";
import CertificationExpiryWarningEmail from "@/emails/training/certification-expiry-warning";
import ProgramMilestoneEmail from "@/emails/training/program-milestone";

const fromEmail = getFromEmail();
const unionName = process.env.NEXT_PUBLIC_UNION_NAME || "Union";
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  /** Unknown provider state after an exception: do not release the durable send claim. */
  uncertain?: boolean;
}

async function sendTrainingEmail(
  toEmail: string,
  subject: string,
  react: ReactNode,
  templateId: string,
): Promise<SendEmailResult> {
  const result = await sendResendEmail({
    from: fromEmail,
    to: [toEmail],
    subject,
    react,
  }, {
    feature: 'training_notifications',
    templateId,
  });

  return result;
}

/**
 * Send course registration confirmation email
 */
export async function sendRegistrationConfirmation({
  toEmail,
  memberName,
  courseName,
  courseCode,
  registrationDate,
  startDate,
  endDate,
  instructorName,
  location,
  totalHours,
}: {
  toEmail: string;
  memberName: string;
  courseName: string;
  courseCode: string;
  registrationDate: string;
  startDate?: string;
  endDate?: string;
  instructorName?: string;
  location?: string;
  totalHours?: number;
}): Promise<SendEmailResult> {
  try {
    return await sendTrainingEmail(
      toEmail,
      `Registration Confirmed: ${courseName}`,
      RegistrationConfirmationEmail({
        memberName,
        courseName,
        courseCode,
        registrationDate,
        startDate,
        endDate,
        instructorName,
        location,
        totalHours,
        dashboardUrl: `${baseUrl}/education`,
        unionName,
      }),
      'training_registration_confirmation',
    );
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send session reminder email (7, 3, or 1 day before)
 */
export async function sendSessionReminder({
  toEmail,
  memberName,
  courseName,
  sessionDate,
  sessionTime,
  daysUntilSession,
  location,
  instructorName,
  sessionDuration,
  materialsNeeded,
  specialInstructions,
}: {
  toEmail: string;
  memberName: string;
  courseName: string;
  sessionDate: string;
  sessionTime: string;
  daysUntilSession: number;
  location?: string;
  instructorName?: string;
  sessionDuration?: number;
  materialsNeeded?: string[];
  specialInstructions?: string;
}): Promise<SendEmailResult> {
  try {
    const reminderType =
      daysUntilSession === 1 ? "Tomorrow" : `${daysUntilSession} Days`;

    return await sendTrainingEmail(
      toEmail,
      `Reminder: Training Session in ${reminderType} - ${courseName}`,
      SessionReminderEmail({
        memberName,
        courseName,
        sessionDate,
        sessionTime,
        daysUntilSession,
        location,
        instructorName,
        sessionDuration,
        materialsNeeded,
        specialInstructions,
        dashboardUrl: `${baseUrl}/education`,
        unionName,
      }),
      'training_session_reminder',
    );
  } catch (error) {
return {
      success: false,
      uncertain: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send course completion certificate email
 */
export async function sendCompletionCertificate({
  toEmail,
  memberName,
  courseName,
  courseCode,
  completionDate,
  finalGrade,
  totalHours,
  certificateNumber,
  certificateUrl,
  continuingEducationHours,
  clcApproved,
}: {
  toEmail: string;
  memberName: string;
  courseName: string;
  courseCode: string;
  completionDate: string;
  finalGrade?: number;
  totalHours?: number;
  certificateNumber: string;
  certificateUrl: string;
  continuingEducationHours?: number;
  clcApproved?: boolean;
}): Promise<SendEmailResult> {
  try {
    return await sendTrainingEmail(
      toEmail,
      `Congratulations! Course Completed: ${courseName}`,
      CompletionCertificateEmail({
        memberName,
        courseName,
        courseCode,
        completionDate,
        finalGrade,
        totalHours,
        certificateNumber,
        certificateUrl,
        continuingEducationHours,
        clcApproved,
        dashboardUrl: `${baseUrl}/education`,
        unionName,
      }),
      'training_completion_certificate',
    );
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send certification expiry warning email (90 or 30 days before)
 */
export async function sendCertificationExpiryWarning({
  toEmail,
  memberName,
  certificationName,
  certificateNumber,
  expiryDate,
  daysUntilExpiry,
  continuingEducationHours,
  renewalRequirements,
  renewalCourseUrl,
}: {
  toEmail: string;
  memberName: string;
  certificationName: string;
  certificateNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  continuingEducationHours?: number;
  renewalRequirements?: string[];
  renewalCourseUrl?: string;
}): Promise<SendEmailResult> {
  try {
    const urgencyLevel = daysUntilExpiry <= 30 ? "URGENT" : "Important";

    return await sendTrainingEmail(
      toEmail,
      `${urgencyLevel}: Certification Expires in ${daysUntilExpiry} Days - ${certificationName}`,
      CertificationExpiryWarningEmail({
        memberName,
        certificationName,
        certificateNumber,
        expiryDate,
        daysUntilExpiry,
        continuingEducationHours,
        renewalRequirements,
        renewalCourseUrl,
        dashboardUrl: `${baseUrl}/education`,
        unionName,
      }),
      'training_certification_expiry_warning',
    );
  } catch (error) {
return {
      success: false,
      uncertain: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send program milestone achievement email
 */
export async function sendProgramMilestone({
  toEmail,
  memberName,
  programName,
  milestoneTitle,
  completionPercentage,
  coursesCompleted,
  coursesRequired,
  hoursCompleted,
  hoursRequired,
  currentLevel,
  nextLevel,
  mentorName,
  achievementDate,
  nextMilestone,
}: {
  toEmail: string;
  memberName: string;
  programName: string;
  milestoneTitle: string;
  completionPercentage: number;
  coursesCompleted: number;
  coursesRequired: number;
  hoursCompleted: number;
  hoursRequired: number;
  currentLevel?: string;
  nextLevel?: string;
  mentorName?: string;
  achievementDate: string;
  nextMilestone?: string;
}): Promise<SendEmailResult> {
  try {
    return await sendTrainingEmail(
      toEmail,
      `Milestone Achieved: ${milestoneTitle} - ${programName}`,
      ProgramMilestoneEmail({
        memberName,
        programName,
        milestoneTitle,
        completionPercentage,
        coursesCompleted,
        coursesRequired,
        hoursCompleted,
        hoursRequired,
        currentLevel,
        nextLevel,
        mentorName,
        achievementDate,
        nextMilestone,
        dashboardUrl: `${baseUrl}/education`,
        unionName,
      }),
      'training_program_milestone',
    );
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * The unique, durable in-app reminder is claimed before contacting the mail provider.
 * A repeat or overlapping cron cannot claim the same organization/member/source/tier.
 * A definitive provider refusal releases the claim for retry; an unexpected exception
 * leaves it in place for manual reconciliation, rather than risk a duplicate email.
 */
async function deliverOnce(
  identity: EducationReminderIdentity,
  send: () => Promise<SendEmailResult>,
): Promise<'sent' | 'skipped' | 'failed'> {
  let claimed: boolean;
  try {
    claimed = await withSystemContext(() => claimEducationReminder(identity));
  } catch {
    // No delivery without a durable idempotency record.
    return 'failed';
  }
  if (!claimed) return 'skipped';
  try {
    const result = await send();
    if (result.success) return 'sent';
    // An exception may occur after provider acceptance; retain the claim for manual reconciliation.
    if (result.uncertain) return 'failed';
    // The provider explicitly refused; retry is safe only after the claim is released.
    try {
      await withSystemContext(() => releaseEducationReminder(identity));
    } catch {
      // Keep a conservative failure disposition if the release could not be confirmed.
    }
    return 'failed';
  } catch {
    // Delivery may have occurred. Retain the claim to prevent an unsafe replay.
    return 'failed';
  }
}

export async function batchSendSessionReminders(
  reminders: Array<{
    organizationId: string;
    userId: string;
    sourceId: string;
    toEmail: string;
    memberName: string;
    courseName: string;
    sessionDate: string;
    sessionTime: string;
    daysUntilSession: number;
    location?: string;
    instructorName?: string;
    sessionDuration?: number;
  }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };
  for (const reminder of reminders) {
    const outcome = await deliverOnce(
      { organizationId: reminder.organizationId, userId: reminder.userId,
        sourceId: reminder.sourceId, kind: 'session', leadDays: reminder.daysUntilSession },
      () => sendSessionReminder(reminder),
    );
    if (outcome === 'sent') results.sent++;
    if (outcome === 'failed') {
      results.failed++;
      results.errors.push('Session reminder delivery failed or could not be safely claimed');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}

export async function batchSendExpiryWarnings(
  warnings: Array<{
    organizationId: string;
    userId: string;
    sourceId: string;
    toEmail: string;
    memberName: string;
    certificationName: string;
    certificateNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };
  for (const warning of warnings) {
    const outcome = await deliverOnce(
      { organizationId: warning.organizationId, userId: warning.userId,
        sourceId: warning.sourceId, kind: 'certification', leadDays: warning.daysUntilExpiry },
      () => sendCertificationExpiryWarning(warning),
    );
    if (outcome === 'sent') results.sent++;
    if (outcome === 'failed') {
      results.failed++;
      results.errors.push('Certification expiry warning delivery failed or could not be safely claimed');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}
