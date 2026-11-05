'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type MemberProfileProps = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  onSignOut: () => void;
  /** Pages that really manage something of the person's own (each one a page the application serves); nothing is listed that has no page behind it. */
  manage?: ReadonlyArray<{ href: string; title: string; description: string }>;
};

/**
 * Least-privilege profile: the person's own identity, read-only. Nothing here is editable,
 * deletable or exportable because the profile service does not persist changes; the notice tells the
 * person who to contact instead of presenting controls that do nothing. A setting that is real and has
 * a page of its own (two-factor authentication) is linked, never imitated.
 */
export function MemberProfile({ name, email, phone, organization, role, onSignOut, manage }: MemberProfileProps) {
  const t = useTranslations();
  const rows: Array<[string, string]> = [
    [t('profile.fullName'), name],
    [t('profile.emailAddress'), email],
    [t('profile.phoneNumber'), phone],
    [t('profile.localSection'), organization],
    [t('profile.role'), role],
  ];

  return (
    <div className="p-4 md:p-8" data-testid="member-profile">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{t('memberProfile.title')}</h1>
        <p className="mb-6 text-gray-600">{t('memberProfile.readOnlyNotice')}</p>
        <Card className="p-6">
          <dl className="divide-y divide-gray-100">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">{label}</dt>
                <dd className="break-words text-sm text-gray-900 sm:col-span-2">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {manage && manage.length > 0 && (
          <section className="mt-6" aria-labelledby="member-profile-manage">
            <h2 id="member-profile-manage" className="mb-3 text-lg font-semibold text-gray-900">{t('memberProfile.manageTitle')}</h2>
            <ul className="space-y-2">
              {manage.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                    <span className="block text-sm font-medium text-gray-900">{item.title}</span>
                    <span className="block text-sm text-gray-600">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-6">
          <Button variant="outline" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('profile.signOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}
