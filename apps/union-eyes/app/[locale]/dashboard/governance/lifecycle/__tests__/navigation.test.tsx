// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Layout from '../layout';

const state = vi.hoisted(() => ({ locale: 'en-CA', pathname: '/en-CA/dashboard/governance/lifecycle/registry' }));
vi.mock('next-intl', () => ({ useLocale: () => state.locale }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
afterEach(cleanup);

describe('lifecycle navigation', () => {
  it.each(['en-CA', 'fr-CA'])('keeps every destination in the real localized route tree from nested pages (%s)', locale => {
    state.locale = locale;
    state.pathname = `/${locale}/dashboard/governance/lifecycle/registry`;
    render(<Layout>Policy list</Layout>);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(9);
    const destinations = links.map(link => new URL(link.getAttribute('href')!, `https://example.test${state.pathname}`).pathname);
    expect(destinations).toEqual(['registry', 'timeline', 'approvals', 'replay', 'conflicts', 'lineage', 'deprecation', 'drift', 'snapshot']
      .map(section => `/${locale}/dashboard/governance/lifecycle/${section}`));
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(document.querySelector('[aria-current="page"]')).toHaveAttribute('href', state.pathname);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(locale === 'fr-CA' ? 'Cycle de vie des politiques' : 'Policy Lifecycle Governance');
  });

  it('does not select a similarly prefixed but different destination', () => {
    state.locale = 'en-CA';
    state.pathname = '/en-CA/dashboard/governance/lifecycle/registry-other';
    render(<Layout>Unrelated page</Layout>);
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });
});
