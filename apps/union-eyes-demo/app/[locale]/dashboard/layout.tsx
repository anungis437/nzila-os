/**
 * Union Eyes Demo — dashboard layout.
 *
 * Minimal chrome for the demo dashboard. The operational app has a
 * much richer app-shell; the demo intentionally does not import it
 * (Wave 0 §2 boundary rule).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: 'cases', label: 'Cases' },
  { href: 'inbox', label: 'Inbox' },
  { href: 'members', label: 'Members' },
  { href: 'grievances', label: 'Grievances' },
  { href: 'documents', label: 'Documents' },
  { href: 'governance', label: 'Governance' },
  { href: 'priorities', label: 'Priorities' },
  { href: 'agreements', label: 'Agreements' },
  { href: 'calendar', label: 'Calendar' },
  { href: 'communications', label: 'Communications' },
  { href: 'work', label: 'Work' },
];

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav
        aria-label="Demo navigation"
        style={{
          width: 220,
          background: '#12324a',
          color: '#f4ecd8',
          padding: '20px 12px',
          fontSize: 14,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            marginBottom: 6,
            color: '#d3c08f',
          }}
        >
          Union Eyes Demo
        </div>
        <div style={{ opacity: 0.7, marginBottom: 18, fontSize: 11 }}>
          Synthetic-data workspace
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={`/${locale}/dashboard/${item.href}`}
                style={{
                  display: 'block',
                  color: '#f4ecd8',
                  padding: '6px 10px',
                  textDecoration: 'none',
                  borderRadius: 4,
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
