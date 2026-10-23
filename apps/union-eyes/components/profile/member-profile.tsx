'use client';

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
};

/**
 * Least-privilege profile for members: their own identity, read-only. Nothing here is editable,
 * deletable or exportable because the profile service does not persist changes; the notice tells the
 * member who to contact instead of presenting controls that do nothing.
 */
export function MemberProfile({ name, email, phone, organization, role, onSignOut }: MemberProfileProps) {
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
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{t('profile.title')}</h1>
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
