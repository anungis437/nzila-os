'use client';

import { useTranslations } from 'next-intl';
import AuthPageLayout from '@/components/auth/auth-page-layout';
import { LoginForm } from '@/components/auth/login-form';
import type { TrustBadge } from '@/components/auth/auth-page-layout';

const badgeColors: TrustBadge['color'][] = ['emerald', 'gold', 'muted'];

export default function SignInPageContent() {
  const t = useTranslations('signIn');

  const stats = t.raw('stats') as Array<{ value: string; label: string }>;

  const rawBadges = t.raw('badges') as Array<{ label: string }>;
  const trustBadges: TrustBadge[] = rawBadges.map((b, i) => ({
    label: b.label,
    color: badgeColors[i] ?? 'muted',
  }));

  return (
    <AuthPageLayout
      tagline={t('tagline')}
      subtitle={t('subtitle')}
      stats={stats}
      heroImage="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&q=80"
      heroAlt="African musician performing — representing the creative spirit Zonga empowers"
      trustBadges={trustBadges}
    >
      <LoginForm />
    </AuthPageLayout>
  );
}
