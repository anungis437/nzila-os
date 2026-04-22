import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Trust & Security',
  description:
    'How Union Eyes protects member data with Canadian hosting, enterprise encryption, strict access controls, and a responsible AI stance.',
  alternates: {
    canonical: 'https://unioneyes.app/trust',
  },
  openGraph: {
    title: 'Trust & Security | Union Eyes',
    description:
      'Canadian hosting, end-to-end encryption, audit trails, RBAC, and responsible AI. Built for labour organizations that cannot afford a data breach.',
  },
};

const sections = [
  {
    id: 'data-residency',
    icon: '🍁',
    heading: 'Canadian Data Residency',
    body: (
      <p>
        All member data is stored and processed exclusively in{' '}
        <strong>Microsoft Azure Canada Central (Toronto)</strong>. No data
        transits U.S. infrastructure. This satisfies PIPEDA, provincial privacy
        statutes, and CBA/CUPE data-sovereignty requirements.
      </p>
    ),
    badges: ['Azure Canada Central', 'PIPEDA-aligned', 'No cross-border transfer'],
  },
  {
    id: 'encryption',
    icon: '🔒',
    heading: 'End-to-End Encryption',
    body: (
      <p>
        Data at rest uses <strong>AES-256</strong> (Azure Storage Service
        Encryption). Data in transit is enforced via <strong>TLS 1.3</strong>{' '}
        with HSTS and <code>upgrade-insecure-requests</code> on all production
        surfaces. Database credentials, API keys, and secrets are stored in{' '}
        <strong>Azure Key Vault</strong> and never in source code or environment
        variables directly.
      </p>
    ),
    badges: ['AES-256 at rest', 'TLS 1.3 in transit', 'Azure Key Vault'],
  },
  {
    id: 'access-control',
    icon: '🛡️',
    heading: 'Role-Based Access Control',
    body: (
      <p>
        Every action in Union Eyes is gated by a least-privilege RBAC model.
        Roles — grievance officer, steward, executive, read-only — are scoped
        per organization and enforced at both the API layer and PostgreSQL
        Row-Level Security (RLS) policies. No user can read another
        organization&apos;s data, even if they share the same database instance.
      </p>
    ),
    badges: ['Per-org isolation', 'PostgreSQL RLS', 'Least-privilege'],
  },
  {
    id: 'audit-logs',
    icon: '📋',
    heading: 'Immutable Audit Trails',
    body: (
      <p>
        Every case state change, file access, and admin action is logged with a
        cryptographic HMAC seal (AES-256 / SHA-256). Audit logs cannot be
        retroactively altered. Evidence packages are exportable as PDF bundles
        suitable for arbitration, OLRB proceedings, and internal reviews.
      </p>
    ),
    badges: ['HMAC-sealed logs', 'Arbitration-ready exports', 'Non-repudiation'],
  },
  {
    id: 'identity',
    icon: '🪪',
    heading: 'Enterprise Identity & SSO',
    body: (
      <p>
        Union Eyes supports both <strong>email/password</strong> (Argon2id,
        OWASP-hardened) and <strong>Microsoft Entra ID (Azure AD) SSO</strong>{' '}
        for organizations on Microsoft 365. Accounts auto-lock after five failed
        attempts. Session tokens are opaque, short-lived, and stored server-side
        — never in localStorage.
      </p>
    ),
    badges: ['Argon2id passwords', 'Entra ID SSO', 'Server-side sessions'],
  },
  {
    id: 'responsible-ai',
    icon: '🤖',
    heading: 'Responsible AI',
    body: (
      <p>
        AI features (case analysis, pattern detection, grievance risk scoring)
        are <strong>advisory only</strong>. Every AI output is surfaced with
        confidence indicators, human-review prompts, and a complete audit trail.
        No automated decisions are made without human confirmation. Models run
        on <strong>Azure OpenAI</strong> within the same Canadian tenant — your
        data is never used to train public models.
      </p>
    ),
    badges: ['Human-in-the-loop', 'Azure OpenAI (Canada)', 'No model training on your data'],
  },
  {
    id: 'availability',
    icon: '⚡',
    heading: 'Availability & Disaster Recovery',
    body: (
      <p>
        Hosted on <strong>Azure Container Apps</strong> with auto-scaling and
        zero-downtime deployments. Database backups run nightly with a 30-day
        retention window. An uptime status page is available at{' '}
        <Link
          href="/status"
          className="text-electric hover:underline"
        >
          unioneyes.app/status
        </Link>
        .
      </p>
    ),
    badges: ['Auto-scaling', '30-day DB backups', 'Zero-downtime deploys'],
  },
  {
    id: 'private-deployment',
    icon: '🏢',
    heading: 'Private Deployment (Optional)',
    body: (
      <p>
        Larger federations may request a dedicated Azure subscription isolated
        from all other tenants — your own ACR, Container Apps environment,
        PostgreSQL flexible server, and Key Vault. Contact us to discuss private
        deployment options for federations of 10,000+ members.
      </p>
    ),
    badges: ['Isolated Azure subscription', 'Dedicated DB', 'CUPE / large federations'],
  },
];

export default function TrustPage() {
  return (
    <div className="bg-white">
      {/* ── HERO ── */}
      <section className="bg-navy text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
            Security &amp; Privacy
          </span>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Built for Organizations That<br />
            <span className="gradient-text">Cannot Afford a Data Breach</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Member trust is the foundation of every union. Every architectural
            decision in Union Eyes starts there.
          </p>
          <Link
            href="/pilot-request"
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30"
          >
            Book a Security Briefing
          </Link>
        </div>
      </section>

      {/* ── TRUST PILLARS ── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How We Protect Your Members
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Eight security pillars, built into the platform from day one —
              not bolted on after.
            </p>
          </div>

          <div className="grid gap-10">
            {sections.map((s) => (
              <div
                key={s.id}
                id={s.id}
                className="flex gap-6 p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-4xl shrink-0 mt-1" aria-hidden="true">
                  {s.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {s.heading}
                  </h3>
                  <div className="text-gray-600 leading-relaxed mb-4 prose prose-sm max-w-none">
                    {s.body}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.badges.map((b) => (
                      <span
                        key={b}
                        className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POSTURE SUMMARY TABLE ── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Security Posture at a Glance
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy text-white text-left">
                  <th className="px-6 py-4 font-semibold">Control</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Data residency', '✅ Canadian', 'Azure Canada Central (Toronto)'],
                  ['Encryption at rest', '✅ AES-256', 'Azure Storage Service Encryption'],
                  ['Encryption in transit', '✅ TLS 1.3', 'HSTS + HTTPS enforced'],
                  ['Secret management', '✅ Key Vault', 'Azure Key Vault — no env-var secrets in prod'],
                  ['Authentication', '✅ MFA-capable', 'Argon2id + Entra ID SSO'],
                  ['Session security', '✅ Server-side', 'Opaque tokens, no localStorage'],
                  ['Database isolation', '✅ Row-Level Security', 'PostgreSQL RLS per org'],
                  ['Audit logging', '✅ HMAC-sealed', 'Cryptographic evidence packages'],
                  ['AI data handling', '✅ No training use', 'Azure OpenAI, data stays in tenant'],
                  ['Vulnerability scanning', '✅ CI pipeline', 'Dependency audit + Trivy container scan'],
                  ['SOC 2 Type II', '🔄 Roadmap', 'Scoping in progress — pre-audit readiness 2026'],
                  ['Penetration test', '🔄 Planned', 'Third-party pen test scheduled pre-production'],
                ].map(([control, status, detail]) => (
                  <tr key={control} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{control}</td>
                    <td className="px-6 py-3 text-gray-700">{status}</td>
                    <td className="px-6 py-3 text-gray-500">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── REPORTING VULNERABILITY ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Responsible Disclosure
          </h2>
          <p className="text-gray-600 mb-6">
            Found a security issue? We follow coordinated disclosure. Please
            email{' '}
            <a
              href="mailto:security@unioneyes.app"
              className="text-electric hover:underline"
            >
              security@unioneyes.app
            </a>{' '}
            with details. We acknowledge within 24 hours and aim to patch
            critical issues within 72 hours.
          </p>
          <p className="text-sm text-gray-500">
            For our full security policy see{' '}
            <a
              href="https://github.com/anungis437/nzila-os/blob/main/SECURITY.md"
              className="text-electric hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              SECURITY.md
            </a>
            .
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-navy text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">
            Ready to See It in Action?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Book a 30-minute security briefing or request access to our
            vendor risk package, privacy impact assessment template, and
            data processing agreement.
          </p>
          <Link
            href="/pilot-request"
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30"
          >
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
