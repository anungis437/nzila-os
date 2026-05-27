import type { ReactNode } from 'react';
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
 * Batch send session reminders (for cron jobs)
 */
export async function batchSendSessionReminders(
  reminders: Array<{
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
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const reminder of reminders) {
    const result = await sendSessionReminder(reminder);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      if (result.error) {
        results.errors.push(`${reminder.toEmail}: ${result.error}`);
      }
    }
    // Rate limiting: wait 100ms between sends
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Batch send certification expiry warnings (for cron jobs)
 */
export async function batchSendExpiryWarnings(
  warnings: Array<{
    toEmail: string;
    memberName: string;
    certificationName: string;
    certificateNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const warning of warnings) {
    const result = await sendCertificationExpiryWarning(warning);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      if (result.error) {
        results.errors.push(`${warning.toEmail}: ${result.error}`);
      }
    }
    // Rate limiting: wait 100ms between sends
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}


