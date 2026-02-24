/**
 * Email Template: Welcome Email
 * 
 * Sent to new users when they sign up
 */

import {
  Body,
  Button,
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

interface WelcomeEmailProps {
  userName: string;
  userEmail: string;
}

export default function WelcomeEmail({
  userName = 'there',
  userEmail: _userEmail = '',
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Union Claims Management System</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Union Claims!</Heading>
          
          <Text style={text}>
            Hi {userName},
          </Text>

          <Text style={text}>
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Welcome to the Union Claims Management System. We're excited to have you on board!
          </Text>

          <Text style={text}>
            Our platform helps you manage union claims, track grievances, and collaborate with your team more effectively.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`}>
              Go to Dashboard
            </Button>
          </Section>

          <Text style={text}>
            Here are some things you can do to get started:
          </Text>

          <ul style={list}>
            <li style={listItem}>Complete your profile settings</li>
            <li style={listItem}>Set up notification preferences</li>
            <li style={listItem}>Explore the claims dashboard</li>
            <li style={listItem}>Connect with your team members</li>
          </ul>

          <Hr style={hr} />

          <Text style={text}>
            If you have any questions, feel free to{' '}
            <Link href="mailto:support@unionclaims.com" style={link}>
              contact our support team
            </Link>
            .
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

const list = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
  marginLeft: '20px',
};

const listItem = {
  marginBottom: '8px',
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

