/**
 * Member Portal & Engagement — Platform module page
 *
 * Describes member management, self-service portal, and engagement tools.
 * Tone: Practical, organizer-first.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Metadata } from 'next';
import {
  Users,
  UserPlus,
  CreditCard,
  FileUp,
  MessageSquare,
  BarChart3,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Member Portal | UnionEyes',
  description:
    'Member self-service portal with claims tracking, dues visibility, document management, and onboarding — giving members transparency without burdening stewards.',
};

const features = [
  {
    icon: Users,
    title: 'Member Directory',
    description:
      'Searchable directory with seniority tracking, status management, and bulk operations. Import, export, or merge records without spreadsheet headaches.',
  },
  {
    icon: UserPlus,
    title: 'Onboarding Wizard',
    description:
      'Step-by-step onboarding for new members. Collect information, assign roles, and get people up to speed from day one.',
  },
  {
    icon: FolderOpen,
    title: 'Claims & Grievance Visibility',
    description:
      'Members can file benefit and insurance claims, track status in real time, and see updates without calling the hall. Transparency builds trust.',
  },
  {
    icon: CreditCard,
    title: 'Dues Tracking',
    description:
      'Members see their balance, payment history, and next payment date. Less confusion, fewer phone calls, better record-keeping for everyone.',
  },
  {
    icon: FileUp,
    title: 'Documents & Files',
    description:
      'Upload, version, and share documents with approval workflows and retention policies. No more emailing attachments back and forth.',
  },
  {
    icon: MessageSquare,
    title: 'Communications',
    description:
      'Messages, notifications, and subscription preferences for email and SMS. Reach members on their terms without spamming.',
  },
  {
    icon: BarChart3,
    title: 'Engagement Dashboard',
    description:
      'See participation metrics, activity trends, and communication effectiveness at a glance. Understand who&apos;s engaged and who needs outreach.',
  },
];

export default function MemberPortalPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium mb-6">
            <Users className="h-4 w-4" />
            <span>Core Module</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            A portal your members will actually use
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Self-service for members. Less phone calls for you. Claims tracking,
            dues visibility, and document access — all in one place that
            respects their time and yours.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Two sides callout */}
        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-blue-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              For Members
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• See your claims and their status in real time</li>
              <li>• Check your dues balance without calling the office</li>
              <li>• Upload documents securely from any device</li>
              <li>• Get notifications on your terms (email or SMS)</li>
            </ul>
          </div>
          <div className="bg-violet-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              For Stewards &amp; Staff
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• Onboard new members with a guided wizard</li>
              <li>• Bulk import/export member records</li>
              <li>• Track engagement and identify disengaged members</li>
              <li>• Manage documents with version control and approvals</li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Ready for a portal that works?
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            We&apos;re piloting the member portal with Canadian unions.
            See how it handles your real workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Request a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features/grievance-tracking"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Grievance Tracking
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
