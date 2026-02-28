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

interface ProgramMilestoneEmailProps {
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
  dashboardUrl: string;
  unionName: string;
}

export default function ProgramMilestoneEmail({
  memberName = "Member",
  programName = "Apprenticeship Program",
  milestoneTitle = "Level 1 Completion",
  completionPercentage = 25,
  coursesCompleted = 5,
  coursesRequired = 20,
  hoursCompleted = 2000,
  hoursRequired = 8000,
  currentLevel = "Level 1",
  nextLevel = "Level 2",
  mentorName,
  achievementDate = new Date().toLocaleDateString(),
  nextMilestone = "Level 2 Completion",
  dashboardUrl = "https://example.com/dashboard",
  unionName = "Union",
}: ProgramMilestoneEmailProps) {
  const progressBarWidth = Math.min(completionPercentage, 100);
  
  return (
    <Html>
      <Head />
      <Preview>
        Milestone achieved in {programName}: {milestoneTitle}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={trophy}>🏆</Text>
            <Heading style={h1}>Milestone Achieved!</Heading>
            <Text style={subtitle}>{milestoneTitle}</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Congratulations {memberName}!</Text>

            <Text style={paragraph}>
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              You've reached an important milestone in your <strong>{programName}</strong> journey.
              Your dedication and hard work continue to pay off!
            </Text>

            <Section style={achievementBox}>
              <Heading as="h2" style={h2}>
                Milestone Details
              </Heading>

              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Program:</td>
                    <td style={valueCell}>{programName}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Milestone:</td>
                    <td style={valueCell}>{milestoneTitle}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Achievement Date:</td>
                    <td style={valueCell}>{achievementDate}</td>
                  </tr>
                  {currentLevel && (
                    <tr>
                      <td style={labelCell}>Current Level:</td>
                      <td style={{...valueCell, color: "#16a34a", fontWeight: "bold"}}>
                        {currentLevel}
                      </td>
                    </tr>
                  )}
                  {mentorName && (
                    <tr>
                      <td style={labelCell}>Mentor:</td>
                      <td style={valueCell}>{mentorName}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section style={progressSection}>
              <Heading as="h3" style={h3}>
                Overall Program Progress
              </Heading>

              <Section style={progressBarContainer}>
                <div style={progressBarBg}>
                  <div style={{...progressBarFill, width: `${progressBarWidth}%`}} />
                </div>
                <Text style={progressPercentage}>{completionPercentage}% Complete</Text>
              </Section>

              <div style={statsGrid}>
                <div style={statBox}>
                  <Text style={statLabel}>Courses</Text>
                  <Text style={statValue}>
                    {coursesCompleted} / {coursesRequired}
                  </Text>
                  <Text style={statSubtext}>
                    {coursesRequired - coursesCompleted} remaining
                  </Text>
                </div>

                <div style={statBox}>
                  <Text style={statLabel}>Training Hours</Text>
                  <Text style={statValue}>
                    {hoursCompleted.toLocaleString()} / {hoursRequired.toLocaleString()}
                  </Text>
                  <Text style={statSubtext}>
                    {(hoursRequired - hoursCompleted).toLocaleString()} remaining
                  </Text>
                </div>
              </div>
            </Section>

            {nextLevel && (
              <Section style={nextLevelBox}>
                <Text style={nextLevelTitle}>🎯 Next Step: {nextLevel}</Text>
                <Text style={nextLevelText}>
                  {/* eslint-disable-next-line react/no-unescaped-entities */}
                  You're now eligible to advance to {nextLevel}. Continue your excellent work
                  to reach the next milestone: <strong>{nextMilestone}</strong>.
                </Text>
              </Section>
            )}

            <Section style={recognitionBox}>
              <Heading as="h3" style={h3}>
                Recognition
              </Heading>
              <Text style={recognitionText}>
                Your achievement demonstrates commitment to professional excellence and continuous
                improvement. This milestone has been recorded in your training record and contributes
                to your overall career development within the union.
              </Text>
              {mentorName && (
                <Text style={mentorMessage}>
                  Your mentor, <strong>{mentorName}</strong>, has been notified of your achievement
                  and will be reaching out to discuss your next steps.
                </Text>
              )}
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href={dashboardUrl}>
                View Program Details
              </Button>
            </Section>

            <Section style={encouragementBox}>
              <Text style={encouragementText}>
                💪 <strong>Keep Up the Great Work!</strong>
                <br />
                <br />
                Every milestone brings you closer to completing your program and achieving your
                professional goals. We&apos;re proud of your progress and look forward to celebrating
                your continued success.
              </Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This achievement notification is from {unionName} Training System.
              <br />
              Milestone achieved: {achievementDate}
            </Text>
            <Text style={footerText}>
              <Link href={dashboardUrl} style={footerLink}>
                View Apprenticeship Portal
              </Link>
              {" | "}
              <Link href={dashboardUrl} style={footerLink}>
                Share Achievement
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
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  padding: "40px 48px",
  textAlign: "center" as const,
};

const trophy = {
  fontSize: "72px",
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
  color: "#e0e7ff",
  fontSize: "18px",
  margin: "0",
  fontWeight: "500",
};

const content = {
  padding: "0 48px",
};

const greeting = {
  fontSize: "18px",
  lineHeight: "28px",
  marginBottom: "16px",
  marginTop: "32px",
  fontWeight: "600",
  color: "#6366f1",
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
  color: "#6366f1",
};

const h3 = {
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
  color: "#0f172a",
};

const achievementBox = {
  backgroundColor: "#f5f3ff",
  border: "2px solid #a78bfa",
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

const progressSection = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px",
};

const progressBarContainer = {
  marginBottom: "24px",
};

const progressBarBg = {
  width: "100%",
  height: "24px",
  backgroundColor: "#e2e8f0",
  borderRadius: "12px",
  overflow: "hidden" as const,
  marginBottom: "8px",
};

const progressBarFill = {
  height: "100%",
  background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)",
  borderRadius: "12px",
  transition: "width 0.3s ease",
};

const progressPercentage = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#6366f1",
  textAlign: "center" as const,
  margin: "0",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
  marginTop: "16px",
};

const statBox = {
  textAlign: "center" as const,
  padding: "16px",
  backgroundColor: "#ffffff",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
};

const statLabel = {
  fontSize: "12px",
  color: "#64748b",
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
  fontWeight: "600",
  letterSpacing: "0.5px",
};

const statValue = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#0f172a",
  margin: "0 0 4px 0",
};

const statSubtext = {
  fontSize: "12px",
  color: "#64748b",
  margin: "0",
};

const nextLevelBox = {
  backgroundColor: "#eff6ff",
  border: "2px solid #3b82f6",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const nextLevelTitle = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1e40af",
  margin: "0 0 12px 0",
};

const nextLevelText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#1e3a8a",
  margin: "0",
};

const recognitionBox = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fbbf24",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px",
};

const recognitionText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#78350f",
  margin: "0 0 12px 0",
};

const mentorMessage = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#92400e",
  margin: "0",
  fontStyle: "italic" as const,
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#6366f1",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
};

const encouragementBox = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: "8px",
  padding: "24px",
  textAlign: "center" as const,
};

const encouragementText = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#166534",
  margin: "0",
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
  color: "#6366f1",
  textDecoration: "underline",
};

