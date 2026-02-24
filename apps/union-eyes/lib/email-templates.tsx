/**
 * Email Templates for Claim Status Notifications
 * 
 * Uses React Email components for responsive, accessible emails
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { render } from '@react-email/render';

interface ClaimNotificationEmailProps {
  claimId: string;
  claimTitle: string;
  claimType: string;
  previousStatus?: string;
  newStatus: string;
  memberName: string;
  notes?: string;
  deadline?: string;
  daysRemaining?: number;
  assignedStewardName?: string;
  claimUrl: string;
  humanMessage?: string; // SPRINT 7: Human-readable status explanation from timeline builder
}


/**
 * Get status display name and description
 */
function getStatusInfo(status: string): { name: string; description: string; color: string } {
  const statusMap: Record<string, { name: string; description: string; color: string }> = {
    submitted: {
      name: 'Submitted',
      description: 'Your claim has been received and is awaiting review.',
      color: '#3b82f6',
    },
    under_review: {
      name: 'Under Review',
      description: 'Your claim is being reviewed by our team.',
      color: '#f59e0b',
    },
    assigned: {
      name: 'Assigned',
      description: 'Your claim has been assigned to a steward.',
      color: '#8b5cf6',
    },
    investigation: {
      name: 'Investigation',
      description: 'Your claim is under active investigation.',
      color: '#f59e0b',
    },
    pending_documentation: {
      name: 'Pending Documentation',
      description: 'Additional documentation is required for your claim.',
      color: '#ef4444',
    },
    resolved: {
      name: 'Resolved',
      description: 'Your claim has been resolved.',
      color: '#10b981',
    },
    rejected: {
      name: 'Rejected',
      description: 'Your claim has been rejected.',
      color: '#ef4444',
    },
    closed: {
      name: 'Closed',
      description: 'Your claim has been closed.',
      color: '#6b7280',
    },
  };

  return statusMap[status] || { name: status, description: '', color: '#6b7280' };
}

/**
 * Main claim notification email template
 */
export function ClaimStatusNotificationEmail({
  claimId,
  claimTitle,
  claimType,
  previousStatus,
  newStatus,
  memberName,
  notes,
  deadline,
  daysRemaining,
  assignedStewardName,
  claimUrl,
  humanMessage,
}: ClaimNotificationEmailProps) {
  const statusInfo = getStatusInfo(newStatus);
  const isInitialSubmission = !previousStatus || previousStatus === 'submitted';
  const isResolved = newStatus === 'resolved';
  const isRejected = newStatus === 'rejected';
  const needsAction = newStatus === 'pending_documentation';

  return (
    <Html>
      <Head />
      <Preview>
        {isInitialSubmission
          ? `Your claim "${claimTitle}" has been submitted`
          : `Claim status update: ${statusInfo.name}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Union Claims Portal</Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading as="h2" style={h2}>
              {isInitialSubmission ? 'Claim Submitted Successfully' : 'Claim Status Update'}
            </Heading>

            <Text style={text}>Hello {memberName},</Text>

            {isInitialSubmission ? (
              <Text style={text}>
                Thank you for submitting your claim. We have received it and will begin processing shortly.
              </Text>
            ) : (
              <Text style={text}>
                Your claim status has been updated from{' '}
                <strong>{previousStatus ? getStatusInfo(previousStatus).name : 'Unknown'}</strong> to{' '}
                <strong style={{ color: statusInfo.color }}>{statusInfo.name}</strong>.
              </Text>
            )}

            {/* Claim Details Box */}
            <Section style={detailsBox}>
              <Text style={detailLabel}>Claim ID:</Text>
              <Text style={detailValue}>{claimId}</Text>

              <Text style={detailLabel}>Title:</Text>
              <Text style={detailValue}>{claimTitle}</Text>

              <Text style={detailLabel}>Type:</Text>
              <Text style={detailValue}>{claimType}</Text>

              <Text style={detailLabel}>Status:</Text>
              <Text style={{ ...detailValue, color: statusInfo.color, fontWeight: 'bold' }}>
                {statusInfo.name}
              </Text>

              {assignedStewardName && (
                <>
                  <Text style={detailLabel}>Assigned Steward:</Text>
                  <Text style={detailValue}>{assignedStewardName}</Text>
                </>
              )}

              {deadline && (
                <>
                  <Text style={detailLabel}>Deadline:</Text>
                  <Text style={detailValue}>
                    {deadline}
                    {daysRemaining !== undefined && (
                      <span style={{ color: daysRemaining <= 3 ? '#ef4444' : '#6b7280' }}>
                        {' '}
                        ({daysRemaining} days remaining)
                      </span>
                    )}
                  </Text>
                </>
              )}
            </Section>

            {/* Status Description - SPRINT 7: Use human-readable message if available */}
            <Text style={text}>
              {humanMessage || statusInfo.description}
            </Text>

            {/* Notes from Steward */}
            {notes && (
              <Section style={notesBox}>
                <Text style={notesLabel}>Notes:</Text>
                <Text style={notesText}>{notes}</Text>
              </Section>
            )}

            {/* Action Messages */}
            {needsAction && (
              <Section style={alertBox}>
                <Text style={alertText}>
                  <strong>Action Required:</strong> Please provide the requested documentation to continue
                  processing your claim.
                </Text>
              </Section>
            )}

            {isResolved && (
              <Section style={successBox}>
                <Text style={successText}>
                  Your claim has been successfully resolved. If you have any questions or concerns about the
                  resolution, please contact your steward.
                </Text>
              </Section>
            )}

            {isRejected && (
              <Section style={alertBox}>
                <Text style={alertText}>
                  Your claim has been rejected. Please review the notes above for the reason. If you believe
                  this decision was made in error, you may file an appeal.
                </Text>
              </Section>
            )}

            {/* Call to Action Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={claimUrl}>
                View Claim Details
              </Button>
            </Section>

            <Text style={text}>
              You can view the full details and history of your claim by clicking the button above or logging
              into the portal.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated notification from the Union Claims Portal. Please do not reply to this email.
            </Text>
            <Text style={footerText}>
              If you have questions, please contact your union representative or reply to support@unionclaims.com.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Email Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#1e40af',
  padding: '20px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
};

const content = {
  padding: '32px 40px',
};

const h2 = {
  color: '#1e293b',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 16px',
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const detailsBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const detailLabel = {
  color: '#64748b',
  fontSize: '14px',
  fontWeight: '600',
  margin: '8px 0 4px',
};

const detailValue = {
  color: '#1e293b',
  fontSize: '16px',
  margin: '0 0 16px',
};

const notesBox = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fcd34d',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const notesLabel = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const notesText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const alertBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const alertText = {
  color: '#991b1b',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const successBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const successText = {
  color: '#166534',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#1e40af',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const footer = {
  backgroundColor: '#f8fafc',
  padding: '20px 40px',
  borderTop: '1px solid #e2e8f0',
};

const footerText = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '8px 0',
  textAlign: 'center' as const,
};

/**
 * Render email template to HTML string
 */
export async function renderClaimStatusEmail(props: ClaimNotificationEmailProps): Promise<string> {
  return render(<ClaimStatusNotificationEmail {...props} />);
}

