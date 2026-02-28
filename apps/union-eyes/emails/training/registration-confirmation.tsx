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

interface RegistrationConfirmationEmailProps {
  memberName: string;
  courseName: string;
  courseCode: string;
  registrationDate: string;
  startDate?: string;
  endDate?: string;
  instructorName?: string;
  location?: string;
  totalHours?: number;
  dashboardUrl: string;
  unionName: string;
}

export default function RegistrationConfirmationEmail({
  memberName = "Member",
  courseName = "Training Course",
  courseCode = "COURSE-001",
  registrationDate = new Date().toLocaleDateString(),
  startDate,
  endDate,
  instructorName,
  location,
  totalHours,
  dashboardUrl = "https://example.com/dashboard",
  unionName = "Union",
}: RegistrationConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      {/* eslint-disable-next-line react/no-unescaped-entities */}
      <Preview>You're registered for {courseName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Registration Confirmed!</Heading>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hello {memberName},</Text>

            <Text style={paragraph}>
              Your registration for <strong>{courseName}</strong> ({courseCode}) has been
              successfully confirmed on {registrationDate}.
            </Text>

            <Section style={infoBox}>
              <Heading as="h2" style={h2}>
                Course Details
              </Heading>

              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Course Name:</td>
                    <td style={valueCell}>{courseName}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Course Code:</td>
                    <td style={valueCell}>{courseCode}</td>
                  </tr>
                  {startDate && (
                    <tr>
                      <td style={labelCell}>Start Date:</td>
                      <td style={valueCell}>{startDate}</td>
                    </tr>
                  )}
                  {endDate && (
                    <tr>
                      <td style={labelCell}>End Date:</td>
                      <td style={valueCell}>{endDate}</td>
                    </tr>
                  )}
                  {totalHours && (
                    <tr>
                      <td style={labelCell}>Total Hours:</td>
                      <td style={valueCell}>{totalHours} hours</td>
                    </tr>
                  )}
                  {instructorName && (
                    <tr>
                      <td style={labelCell}>Instructor:</td>
                      <td style={valueCell}>{instructorName}</td>
                    </tr>
                  )}
                  {location && (
                    <tr>
                      <td style={labelCell}>Location:</td>
                      <td style={valueCell}>{location}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href={dashboardUrl}>
                View in Learning Portal
              </Button>
            </Section>

            <Text style={paragraph}>
              You will receive reminder notifications as your course start date approaches.
              Make sure to complete any pre-course requirements and bring required materials.
            </Text>

            <Text style={tips}>
              <strong>Next Steps:</strong>
              <br />
              • Check your course materials in the learning portal
              <br />
              • Complete any pre-course assessments
              <br />
              • Mark your calendar for the start date
              <br />• Review attendance and completion requirements
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from {unionName} Training System.
              <br />
              If you have questions, please contact your training coordinator.
            </Text>
            <Text style={footerText}>
              <Link href={dashboardUrl} style={footerLink}>
                Manage Notifications
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
  backgroundColor: "#1e40af",
  padding: "32px 48px",
  textAlign: "center" as const,
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
  color: "#1e40af",
};

const infoBox = {
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
  width: "140px",
};

const valueCell = {
  fontSize: "14px",
  color: "#0f172a",
  fontWeight: "500",
  paddingBottom: "12px",
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
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

const tips = {
  fontSize: "14px",
  lineHeight: "22px",
  backgroundColor: "#fef3c7",
  border: "1px solid #fbbf24",
  borderRadius: "6px",
  padding: "16px",
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

