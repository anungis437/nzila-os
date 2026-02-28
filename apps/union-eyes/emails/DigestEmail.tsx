/**
 * Email Template: Digest Email
 * 
 * Daily/Weekly summary of notifications and updates
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface DigestEmailProps {
  userId: string;
  email: string;
  frequency: 'daily' | 'weekly';
  notifications: Array<{
    title: string;
    message: string;
    createdAt: Date;
    actionUrl?: string;
  }>;
}

export default function DigestEmail({
  frequency = 'daily',
  notifications = [],
}: DigestEmailProps) {
  const previewText = `Your ${frequency} Union Claims digest`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            Your {frequency === 'daily' ? 'Daily' : 'Weekly'} Digest
          </Heading>
          
          <Text style={text}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Here's what happened in your Union Claims account:
          </Text>

          {notifications.length === 0 ? (
            <Text style={text}>
              No new notifications this {frequency === 'daily' ? 'day' : 'week'}. 
              Check back later!
            </Text>
          ) : (
            <Section>
              {notifications.map((notification, index) => (
                <div key={index}>
                  <Section style={notificationSection}>
                    <Heading as="h3" style={h3}>
                      {notification.title}
                    </Heading>
                    <Text style={notificationText}>
                      {notification.message}
                    </Text>
                    <Text style={timestamp}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </Text>
                    {notification.actionUrl && (
                      <Link href={notification.actionUrl} style={button}>
                        View Details
                      </Link>
                    )}
                  </Section>
                  {index < notifications.length - 1 && <Hr style={hr} />}
                </div>
              ))}
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications`} style={link}>
              Manage notification preferences
            </Link>
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

const h3 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 10px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
};

const notificationSection = {
  padding: '20px 40px',
};

const notificationText = {
  color: '#555',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '10px 0',
};

const timestamp = {
  color: '#999',
  fontSize: '12px',
  margin: '5px 0',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '5px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '12px 24px',
  textDecoration: 'none',
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

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
};

