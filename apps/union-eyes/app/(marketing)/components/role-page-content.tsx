/**
 * Shared role-page content components.
 * Both (marketing) and [locale]/(marketing) routes import from here — no duplication.
 *
 * Each role's content (icons, flow steps, before/after, headlines) is defined here
 * so that server-component pages only pass a serializable `role` string prop.
 */
'use client';

import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import {
  ArrowRight,
  Inbox, FileText, Scale, TrendingUp,
  BarChart3, AlertTriangle, Users, Target,
  Network, Building2, Shield,
  Globe, Megaphone, ClipboardList,
  Search, Upload, MessageSquare, BookOpen,
  type LucideIcon,
} from 'lucide-react';

/* ────── Types ────── */

interface FlowStep {
  icon: LucideIcon;
  step: string;
  detail: string;
}

interface BeforeAfterRow {
  before: string;
  after: string;
}

interface RoleData {
  badge: string;
  headlineLine1: string;
  headlineAccent: string;
  subtitle: string;
  flowTitle: string;
  dailyFlow: FlowStep[];
  beforeAfter: BeforeAfterRow[];
  ctaHeadline: string;
  ctaSubtitle: string;
}

/* ────── Role Data Registry ────── */

const ROLE_DATA: Record<string, RoleData> = {
  representatives: {
    badge: 'For Representatives & Stewards',
    headlineLine1: 'Stop chasing paper.',
    headlineAccent: 'Start winning cases.',
    subtitle: 'Union Eyes gives you guided intake, precedent research, and deadline tracking — so you spend less time on admin and more time representing members.',
    flowTitle: 'Your daily flow, simplified',
    dailyFlow: [
      { icon: Inbox, step: 'Intake', detail: 'Guided forms capture every detail — no missed fields' },
      { icon: FileText, step: 'Casework', detail: 'Track deadlines, attach evidence, log interactions' },
      { icon: Scale, step: 'Precedents', detail: 'Surface similar past outcomes before your hearing' },
      { icon: TrendingUp, step: 'Outcomes', detail: 'See your case resolution rate and patterns over time' },
    ],
    beforeAfter: [
      { before: 'Scattered notes across email, paper, and spreadsheets', after: 'Every case in one place with full history' },
      { before: 'Guessing which arguments worked before', after: 'Precedent search across your entire local' },
      { before: 'Missed deadlines because nobody tracked them', after: 'Automatic deadline alerts at every stage' },
      { before: 'Asking leadership for updates on your cases', after: 'Real-time status visible to you and your team' },
    ],
    ctaHeadline: 'Ready to focus on what matters?',
    ctaSubtitle: 'See how Union Eyes helps reps move from intake to outcome with confidence.',
  },
  leadership: {
    badge: 'For Presidents & Executive Boards',
    headlineLine1: 'Lead with clarity.',
    headlineAccent: 'Not with spreadsheets.',
    subtitle: 'Union Eyes gives you live visibility into casework, priorities, and outcomes — so you can allocate resources, spot trends, and report to your membership with confidence.',
    flowTitle: 'What leadership sees every day',
    dailyFlow: [
      { icon: BarChart3, step: 'Dashboards', detail: 'Live case volumes, resolution rates, and timelines at a glance' },
      { icon: AlertTriangle, step: 'Priorities', detail: 'Surface escalations, overdue cases, and emerging patterns' },
      { icon: Users, step: 'Team Oversight', detail: 'See workload distribution across reps and locals' },
      { icon: Target, step: 'Outcomes', detail: 'Track win rates, settlement trends, and employer patterns' },
    ],
    beforeAfter: [
      { before: 'Monthly reports compiled manually from reps', after: 'Real-time dashboards updated automatically' },
      { before: 'No visibility into case backlogs until too late', after: 'Escalation alerts before deadlines pass' },
      { before: 'Allocating resources based on gut feeling', after: 'Data-driven workload and resource decisions' },
      { before: 'Preparing for bargaining with scattered data', after: 'Trend analysis ready for the bargaining table' },
    ],
    ctaHeadline: 'Ready to lead with data, not guesswork?',
    ctaSubtitle: 'See how Union Eyes gives leadership the visibility they need.',
  },
  federations: {
    badge: 'For Federations & National Unions',
    headlineLine1: 'See across every local.',
    headlineAccent: 'Act with one system.',
    subtitle: 'Union Eyes gives federations cross-local visibility into casework, resources, and outcomes — so you can coordinate effectively and support locals that need it most.',
    flowTitle: 'What federation leaders see',
    dailyFlow: [
      { icon: Network, step: 'Cross-local View', detail: 'See case volumes, trends, and outcomes across all your locals' },
      { icon: Building2, step: 'Resource Allocation', detail: 'Identify which locals need support and where to deploy resources' },
      { icon: BarChart3, step: 'Benchmarking', detail: 'Compare resolution rates, timelines, and patterns across the federation' },
      { icon: Shield, step: 'Policy Compliance', detail: 'Ensure consistent grievance handling aligned with national standards' },
    ],
    beforeAfter: [
      { before: 'Quarterly reports from locals — weeks old by the time you see them', after: 'Real-time dashboards showing every local\'s status' },
      { before: 'No way to identify struggling locals until they ask for help', after: 'Automated alerts when locals fall behind on cases' },
      { before: 'Inconsistent processes across locals', after: 'Shared templates and standards federation-wide' },
      { before: 'National bargaining prep requires weeks of data gathering', after: 'Aggregate data ready at any time' },
    ],
    ctaHeadline: 'Ready to see across your entire federation?',
    ctaSubtitle: 'See how Union Eyes gives national leaders the visibility they need.',
  },
  clc: {
    badge: 'For CLC & Labour Councils',
    headlineLine1: 'Coordinate the movement.',
    headlineAccent: 'From one dashboard.',
    subtitle: 'Union Eyes gives the Canadian Labour Congress and labour councils movement-wide visibility — aggregate casework trends, campaign coordination, and impact reporting across affiliated unions.',
    flowTitle: 'How CLC uses Union Eyes',
    dailyFlow: [
      { icon: Globe, step: 'Movement Data', detail: 'Aggregate casework trends across all affiliated unions' },
      { icon: Megaphone, step: 'Campaign Coordination', detail: 'Track campaign progress and participation across affiliates' },
      { icon: TrendingUp, step: 'Trend Analysis', detail: 'Identify sector-wide patterns in employer behaviour and grievance outcomes' },
      { icon: ClipboardList, step: 'Impact Reporting', detail: 'Generate evidence-based reports for advocacy and lobbying' },
    ],
    beforeAfter: [
      { before: 'Relying on anecdotal reports from member unions', after: 'Verified, aggregate data across the movement' },
      { before: 'No visibility into sector-wide employer patterns', after: 'Cross-union trend analysis reveals systemic issues' },
      { before: 'Campaign coordination through emails and spreadsheets', after: 'Centralized campaign tracking with real-time progress' },
      { before: 'Policy advocacy backed by limited data', after: 'Evidence-based reporting with movement-wide statistics' },
    ],
    ctaHeadline: 'Ready to see the full picture?',
    ctaSubtitle: 'See how Union Eyes gives the movement the data it needs to drive change.',
  },
  members: {
    badge: 'For Union Members',
    headlineLine1: 'Your case. Your status.',
    headlineAccent: 'Your voice.',
    subtitle: 'Union Eyes gives members direct visibility into their cases, secure document sharing, and clear communication with their representative — no more wondering what\'s happening.',
    flowTitle: 'What members can do',
    dailyFlow: [
      { icon: Search, step: 'Case Tracker', detail: 'See real-time status of your grievance or workplace issue' },
      { icon: Upload, step: 'Documents', detail: 'Securely upload evidence, photos, and supporting documents' },
      { icon: MessageSquare, step: 'Communication', detail: 'Message your representative directly within the system' },
      { icon: BookOpen, step: 'Know Your Rights', detail: 'Access plain-language guides to your workplace rights and CBA' },
    ],
    beforeAfter: [
      { before: 'Calling or emailing your rep for updates, hoping they respond', after: 'Log in and see your case status instantly' },
      { before: 'Handing over paper documents that might get lost', after: 'Secure digital upload with confirmation' },
      { before: 'No idea if your grievance was filed or where it stands', after: 'Step-by-step timeline showing every milestone' },
      { before: 'Searching the internet for your rights', after: 'Your CBA and workplace rights in one place' },
    ],
    ctaHeadline: 'Ready to stay in the loop?',
    ctaSubtitle: 'See how Union Eyes keeps members informed and connected.',
  },
};

/* ────── Component ────── */

export type RoleKey = keyof typeof ROLE_DATA;

export default function RolePageContent({ role }: { role: RoleKey }) {
  const data = ROLE_DATA[role];
  if (!data) return null;

  const { badge, headlineLine1, headlineAccent, subtitle, flowTitle, dailyFlow, beforeAfter, ctaHeadline, ctaSubtitle } = data;
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-20 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 mb-6">
              {badge}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {headlineLine1}<br />
              <span className="gradient-text">{headlineAccent}</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">{subtitle}</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Daily Flow */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl font-bold text-navy text-center mb-14">{flowTitle}</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {dailyFlow.map((item) => (
              <ScrollReveal key={item.step}>
                <div className="text-center p-6 rounded-2xl border border-gray-100 hover:border-electric/30 transition-colors">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-electric" />
                  </div>
                  <h3 className="font-bold text-navy mb-2">{item.step}</h3>
                  <p className="text-sm text-gray-600">{item.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-3xl font-bold text-navy text-center mb-14">
              Before &amp; after Union Eyes
            </h2>
          </ScrollReveal>
          <div className="space-y-6">
            {beforeAfter.map((row) => (
              <ScrollReveal key={row.before}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-white border border-gray-200">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Before</span>
                    <p className="text-gray-600 mt-1 line-through decoration-gray-300">{row.before}</p>
                  </div>
                  <div className="p-5 rounded-xl bg-electric/5 border border-electric/20">
                    <span className="text-xs font-semibold text-electric uppercase tracking-wider">After</span>
                    <p className="text-navy font-medium mt-1">{row.after}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-navy text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-3xl font-bold mb-4">{ctaHeadline}</h2>
            <p className="text-lg text-white/80 mb-8">{ctaSubtitle}</p>
            <Link
              href="/pilot-request"
              className="inline-flex items-center gap-2 px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Request a Demo <ArrowRight className="w-5 h-5" />
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
