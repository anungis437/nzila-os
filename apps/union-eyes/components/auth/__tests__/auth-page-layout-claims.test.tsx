// @vitest-environment jsdom
/**
 * The sign-in, sign-up and password pages share AuthPageLayout. It used to show "SOC 2 Compliant", "PIPEDA Ready" and
 * "End-to-End Encrypted" badges to every visitor. No SOC 2 attestation, privacy compliance assessment or end-to-end
 * encryption exists (the server reads case data). An assurance claim on a public page must have evidence on file,
 * so the layout shows none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AuthPageLayout from '../auth-page-layout';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const tag = (name: string) => {
    const Motion = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, initial: _i, animate: _a, transition: _t, ...rest }, ref) =>
      React.createElement(name, { ...rest, ref }, children as React.ReactNode),
    );
    Motion.displayName = `motion.${name}`;
    return Motion;
  };
  return { motion: new Proxy({}, { get: (_target, name: string) => tag(name) }) };
});

afterEach(() => cleanup());

describe('AuthPageLayout assurance claims', () => {
  it('shows no certification, compliance or encryption badge', () => {
    const { container } = render(
      <AuthPageLayout appName="Union Eyes" tagline="A decision system for labour leadership">
        <form aria-label="sign in" />
      </AuthPageLayout>,
    );
    const text = container.textContent ?? '';
    for (const claim of [/SOC\s*2/i, /PIPEDA/i, /end-to-end encrypt/i, /ISO\s*27001/i, /certified/i, /compliant/i]) {
      expect(text).not.toMatch(claim);
    }
  });
});
