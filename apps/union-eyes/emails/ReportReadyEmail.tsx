/**
 * Email Template: Report Ready Email
 * 
 * Notifies user that their requested report is ready for download
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ReportReadyEmailProps {
  reportType: string;
  reportUrl: string;
  expiresAt?: Date;
}

export default function ReportReadyEmail({
  reportType = 'Report',
  reportUrl = '#',
  expiresAt,
}: ReportReadyEmailProps) {
  const previewText = `Your ${reportType} report is ready`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Report is Ready</Heading>
          
          <Text style={text}>
            Your <strong>{reportType}</strong> report has been generated and is ready for download.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={reportUrl}>
              Download Report
            </Button>
          </Section>

          {expiresAt && (
            <Text style={expiresText}>
              This link will expire on {new Date(expiresAt).toLocaleDateString()} at{' '}
              {new Date(expiresAt).toLocaleTimeString()}.
            </Text>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            If you didn't request this report, you can safely ignore this email.
          </Text>

          <Text style={footer}>
            © {new Date().getFullYear()} Union Claims. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0 40px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
};

const buttonContainer = {
  padding: '27px 40px',
};

const button = {
  backgroundColor: '#22c55e',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
};

const expiresText = {
  color: '#dc2626',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '0 40px',
  marginTop: '10px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 40px',
  marginTop: '12px',
};

