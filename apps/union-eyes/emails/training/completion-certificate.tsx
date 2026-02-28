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

interface CompletionCertificateEmailProps {
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
  dashboardUrl: string;
  unionName: string;
}

export default function CompletionCertificateEmail({
  memberName = "Member",
  courseName = "Training Course",
  courseCode = "COURSE-001",
  completionDate = new Date().toLocaleDateString(),
  finalGrade,
  totalHours,
  certificateNumber = "CERT-123456",
  certificateUrl = "https://example.com/certificate.pdf",
  continuingEducationHours,
  clcApproved = false,
  dashboardUrl = "https://example.com/dashboard",
  unionName = "Union",
}: CompletionCertificateEmailProps) {
  return (
    <Html>
      <Head />
      {/* eslint-disable-next-line react/no-unescaped-entities */}
      <Preview>Congratulations! You've completed {courseName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={trophy}>🎓</Text>
            <Heading style={h1}>Congratulations!</Heading>
            <Text style={subtitle}>Course Completed Successfully</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Dear {memberName},</Text>

            <Text style={paragraph}>
              We are pleased to inform you that you have successfully completed{" "}
              <strong>{courseName}</strong> ({courseCode}) on {completionDate}.
            </Text>

            <Section style={achievementBox}>
              <Heading as="h2" style={h2}>
                Your Achievement
              </Heading>

              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Course:</td>
                    <td style={valueCell}>{courseName}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Certificate Number:</td>
                    <td style={valueCell}>{certificateNumber}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Completion Date:</td>
                    <td style={valueCell}>{completionDate}</td>
                  </tr>
                  {finalGrade !== undefined && (
                    <tr>
                      <td style={labelCell}>Final Grade:</td>
                      <td style={{...valueCell, color: "#16a34a", fontWeight: "bold"}}>
                        {finalGrade}%
                      </td>
                    </tr>
                  )}
                  {totalHours && (
                    <tr>
                      <td style={labelCell}>Training Hours:</td>
                      <td style={valueCell}>{totalHours} hours</td>
                    </tr>
                  )}
                  {continuingEducationHours && (
                    <tr>
                      <td style={labelCell}>CE Hours Earned:</td>
                      <td style={valueCell}>{continuingEducationHours} hours</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {clcApproved && (
                <Section style={clcBadge}>
                  <Text style={badgeText}>
                    ⭐ <strong>CLC Approved Course</strong>
                  </Text>
                  <Text style={badgeSubtext}>
                    This course meets Canadian Labour Congress standards
                  </Text>
                </Section>
              )}
            </Section>

            <Section style={certificateSection}>
              <Heading as="h3" style={h3}>
                Your Certificate is Ready
              </Heading>
              <Text style={certificateText}>
                Your official completion certificate is now available for download.
                You can access it anytime from your learning portal.
              </Text>
              <Section style={ctaSection}>
                <Button style={primaryButton} href={certificateUrl}>
                  Download Certificate (PDF)
                </Button>
              </Section>
            </Section>

            {continuingEducationHours && continuingEducationHours > 0 && (
              <Section style={ceBox}>
                <Text style={ceTitle}>
                  📚 Continuing Education Credit
                </Text>
                <Text style={ceText}>
                  {/* eslint-disable-next-line react/no-unescaped-entities */}
                  You've earned <strong>{continuingEducationHours} CE hours</strong> that can be
                  applied toward certification renewal and professional development requirements.
                </Text>
              </Section>
            )}

            <Section style={nextStepsBox}>
              <Heading as="h3" style={h3}>
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                What's Next?
              </Heading>
              <ul style={nextStepsList}>
                <li style={nextStepsItem}>
                  Download and save your certificate for your records
                </li>
                <li style={nextStepsItem}>
                  Add this achievement to your professional profile
                </li>
                <li style={nextStepsItem}>
                  Explore additional courses to advance your skills
                </li>
                <li style={nextStepsItem}>
                  Share your accomplishment with colleagues and mentors
                </li>
              </ul>
            </Section>

            <Section style={ctaSection}>
              <Button style={secondaryButton} href={dashboardUrl}>
                View Learning Portal
              </Button>
            </Section>

            <Text style={congratsMessage}>
              Great work on completing this course! Your dedication to professional development
              strengthens our union and advances our collective goals.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Certificate issued by {unionName} Training System
              <br />
              Certificate Number: {certificateNumber}
            </Text>
            <Text style={footerText}>
              <Link href={dashboardUrl} style={footerLink}>
                View All Certificates
              </Link>
              {" | "}
              <Link href={certificateUrl} style={footerLink}>
                Download PDF
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
  backgroundColor: "#16a34a",
  padding: "40px 48px",
  textAlign: "center" as const,
};

const trophy = {
  fontSize: "64px",
  margin: "0 0 16px 0",
};

const h1 = {
  color: "#ffffff",
  fontSize: "32px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
  padding: "0",
};

const subtitle = {
  color: "#dcfce7",
  fontSize: "16px",
  margin: "0",
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
  color: "#16a34a",
};

const h3 = {
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0 0 12px 0",
  color: "#0f172a",
};

const achievementBox = {
  backgroundColor: "#f0fdf4",
  border: "2px solid #86efac",
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

const clcBadge = {
  backgroundColor: "#fef3c7",
  border: "2px solid #fbbf24",
  borderRadius: "6px",
  padding: "12px",
  marginTop: "16px",
  textAlign: "center" as const,
};

const badgeText = {
  fontSize: "14px",
  color: "#78350f",
  margin: "0 0 4px 0",
  fontWeight: "600",
};

const badgeSubtext = {
  fontSize: "12px",
  color: "#92400e",
  margin: "0",
};

const certificateSection = {
  textAlign: "center" as const,
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "32px 24px",
  marginBottom: "24px",
};

const certificateText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#64748b",
  marginBottom: "24px",
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const primaryButton = {
  backgroundColor: "#16a34a",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const secondaryButton = {
  backgroundColor: "#1e40af",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const ceBox = {
  backgroundColor: "#eff6ff",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const ceTitle = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1e40af",
  margin: "0 0 8px 0",
};

const ceText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#1e3a8a",
  margin: "0",
};

const nextStepsBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px",
};

const nextStepsList = {
  margin: "12px 0 0 0",
  paddingLeft: "24px",
};

const nextStepsItem = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#475569",
  marginBottom: "8px",
};

const congratsMessage = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#16a34a",
  fontWeight: "500",
  textAlign: "center" as const,
  marginTop: "32px",
  padding: "16px",
  backgroundColor: "#f0fdf4",
  borderRadius: "6px",
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

