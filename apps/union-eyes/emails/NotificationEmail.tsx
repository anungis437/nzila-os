/**
 * Email Template: Generic Notification Email
 * 
 * Used for system notifications, alerts, and general messages to users
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';
import * as React from 'react';

interface NotificationEmailProps {
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
}

export default function NotificationEmail({
  title = 'Notification',
  body = '',
  actionUrl,
  actionText = 'View Details',
}: NotificationEmailProps) {
  const previewText = title;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          
          <Text style={text}>{body}</Text>

          {actionUrl && (
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                {actionText}
              </Button>
            </Section>
          )}

          <Text style={footer}>
            This is an automated notification from UnionEyes. 
            If you believe this was sent in error, please contact support.
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
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 40px',
};

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 10px',
  padding: '0 40px',
};

const buttonContainer = {
  padding: '27px 40px',
};

const button = {
  backgroundColor: '#1a73e8',
  borderRadius: '5px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  lineHeight: '50px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  width: '200px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '24px 0',
  padding: '0 40px',
};

