import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface CertificationExpiryWarningEmailProps {
  memberName: string;
  certificationName: string;
  certificateNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  continuingEducationHours?: number;
  renewalRequirements?: string[];
  renewalCourseUrl?: string;
  dashboardUrl: string;
  unionName: string;
}

export default function CertificationExpiryWarningEmail({
  memberName = "Member",
  certificationName = "Professional Certification",
  certificateNumber = "CERT-123456",
  expiryDate = "January 15, 2026",
  daysUntilExpiry = 90,
  continuingEducationHours,
  renewalRequirements = [],
  renewalCourseUrl,
  dashboardUrl = "https://example.com/dashboard",
  unionName = "Union",
}: CertificationExpiryWarningEmailProps) {
  const urgencyLevel = daysUntilExpiry <= 30 ? "critical" : daysUntilExpiry <= 60 ? "warning" : "notice";
  const urgencyColor = urgencyLevel === "critical" ? "#dc2626" : urgencyLevel === "warning" ? "#f59e0b" : "#3b82f6";
  const urgencyBg = urgencyLevel === "critical" ? "#fef2f2" : urgencyLevel === "warning" ? "#fffbeb" : "#eff6ff";
  
  return (
    <Html>
      <Head />
      <Preview>
        Your {certificationName} certification expires in {String(daysUntilExpiry)} days
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{...header, backgroundColor: urgencyColor}}>
            <Text style={alertIcon}>
              {urgencyLevel === "critical" ? "⚠️" : urgencyLevel === "warning" ? "⏰" : "📋"}
            </Text>
            <Heading style={h1}>Certification Expiring Soon</Heading>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hello {memberName},</Text>

            <Section style={{...urgencyBox, backgroundColor: urgencyBg, borderColor: urgencyColor}}>
              <Text style={{...urgencyText, color: urgencyColor}}>
                <strong>
                  Your certification expires in {daysUntilExpiry} days
                  {urgencyLevel === "critical" && " - Action Required!"}
                </strong>
              </Text>
            </Section>

            <Text style={paragraph}>
              This is a reminder that your <strong>{certificationName}</strong> certification
              is set to expire on <strong>{expiryDate}</strong>.
            </Text>

            <Section style={certBox}>
              <Heading as="h2" style={h2}>
                Certification Details
              </Heading>

              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Certification:</td>
                    <td style={valueCell}>{certificationName}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Certificate Number:</td>
                    <td style={valueCell}>{certificateNumber}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Expiry Date:</td>
                    <td style={{...valueCell, color: urgencyColor, fontWeight: "bold"}}>
                      {expiryDate}
                    </td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Days Remaining:</td>
                    <td style={{...valueCell, color: urgencyColor, fontWeight: "bold"}}>
                      {daysUntilExpiry} days
                    </td>
                  </tr>
                  {continuingEducationHours !== undefined && (
                    <tr>
                      <td style={labelCell}>CE Hours Required:</td>
                      <td style={valueCell}>{continuingEducationHours} hours</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            {renewalRequirements.length > 0 && (
              <Section style={requirementsBox}>
                <Heading as="h3" style={h3}>
                  Renewal Requirements
                </Heading>
                <ul style={requirementsList}>
                  {renewalRequirements.map((requirement, index) => (
                    <li key={index} style={requirementsItem}>
                      {requirement}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section style={actionBox}>
              <Heading as="h3" style={h3}>
                Action Required
              </Heading>
              <Text style={actionText}>
                To maintain your certification and avoid any lapse in your credentials, please
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                complete the renewal process before the expiry date. Don't wait until the last
                minute - start your renewal today!
              </Text>
            </Section>

            <Section style={ctaSection}>
              {renewalCourseUrl ? (
                <Button style={primaryButton} href={renewalCourseUrl}>
                  Start Renewal Process
                </Button>
              ) : (
                <Button style={primaryButton} href={dashboardUrl}>
                  View Certification Details
                </Button>
              )}
            </Section>

            <Section style={consequencesBox}>
              <Text style={consequencesTitle}>
                ⚠️ What Happens if Your Certification Expires?
              </Text>
              <Text style={consequencesText}>
                • You may lose your ability to perform certain job functions
                <br />
                • Your professional standing may be affected
                <br />
                • You may need to retake the full certification course
                <br />• Additional fees may apply for late renewal
              </Text>
            </Section>

            <Text style={helpText}>
              Need help with renewal? Contact your training coordinator or visit the learning
              portal for more information about the renewal process.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated reminder from {unionName} Training System.
              <br />
              Certificate Number: {certificateNumber}
            </Text>
            <Text style={footerText}>
              <Link href={dashboardUrl} style={footerLink}>
                Manage Certifications
              </Link>
              {" | "}
              <Link href={dashboardUrl} style={footerLink}>
                Update Notification Preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 48px",
  textAlign: "center" as const,
};

const alertIcon = {
  fontSize: "48px",
  margin: "0 0 12px 0",
};

const h1 = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "bold",
  margin: "0",
  padding: "0",
};

const content = {
  padding: "0 48px",
};

const greeting = {
  fontSize: "16px",
  lineHeight: "24px",
  marginBottom: "16px",
  marginTop: "32px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "24px",
  marginBottom: "16px",
};

const h2 = {
  fontSize: "20px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
  color: "#0f172a",
};

const h3 = {
  fontSize: "16px",
  fontWeight: "bold",
  margin: "0 0 12px 0",
  color: "#0f172a",
};

const urgencyBox = {
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "24px",
  border: "2px solid",
  textAlign: "center" as const,
};

const urgencyText = {
  fontSize: "16px",
  fontWeight: "600",
  margin: "0",
};

const certBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px",
};

const detailsTable = {
  width: "100%",
  marginTop: "16px",
};

const labelCell = {
  fontSize: "14px",
  color: "#64748b",
  paddingBottom: "12px",
  paddingRight: "16px",
  verticalAlign: "top" as const,
  width: "160px",
};

const valueCell = {
  fontSize: "14px",
  color: "#0f172a",
  fontWeight: "500",
  paddingBottom: "12px",
};

const requirementsBox = {
  backgroundColor: "#eff6ff",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

const requirementsList = {
  margin: "8px 0 0 0",
  paddingLeft: "24px",
};

const requirementsItem = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#1e40af",
  marginBottom: "8px",
};

const actionBox = {
  backgroundColor: "#fef3c7",
  border: "2px solid #fbbf24",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

const actionText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#78350f",
  margin: "0",
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const primaryButton = {
  backgroundColor: "#dc2626",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const consequencesBox = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fca5a5",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

const consequencesTitle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#991b1b",
  margin: "0 0 12px 0",
};

const consequencesText = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#991b1b",
  margin: "0",
};

const helpText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#64748b",
  textAlign: "center" as const,
  marginTop: "24px",
};

const footer = {
  borderTop: "1px solid #e2e8f0",
  marginTop: "32px",
  padding: "24px 48px",
  textAlign: "center" as const,
};

const footerText = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "18px",
  marginBottom: "8px",
};

const footerLink = {
  color: "#1e40af",
  textDecoration: "underline",
};

