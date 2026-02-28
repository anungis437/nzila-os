/**
 * Email Template: Password Reset Email
 * 
 * Sent when user requests password reset
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

interface PasswordResetEmailProps {
  userEmail: string;
  resetUrl: string;
  expiresIn?: number; // minutes
}

export default function PasswordResetEmail({
  userEmail = '',
  resetUrl = '#',
  expiresIn = 60,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Union Claims password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset Your Password</Heading>
          
          <Text style={text}>
            A password reset was requested for the Union Claims account associated with {userEmail}.
          </Text>

          <Text style={text}>
            Click the button below to reset your password:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          <Text style={expiresText}>
            This link will expire in {expiresIn} minutes.
          </Text>

          <Hr style={hr} />

          <Text style={securityText}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            If you didn't request this password reset, you can safely ignore this email. 
            Your password will remain unchanged.
          </Text>

          <Text style={securityText}>
            For security reasons, we never send passwords via email.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            If you're having trouble clicking the button, copy and paste this URL into your browser:
          </Text>
          <Text style={urlText}>{resetUrl}</Text>

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
  marginBottom: '16px',
};

const buttonContainer = {
  padding: '27px 40px',
};

const button = {
  backgroundColor: '#2563eb',
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
  fontWeight: '600',
};

const securityText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '0 40px',
  marginBottom: '12px',
};

const urlText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  padding: '0 40px',
  wordBreak: 'break-all' as const,
  marginBottom: '12px',
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

