/**
 * Locale-aware Contact page
 * Accessible at /{locale}/contact
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail, MapPin, Clock } from 'lucide-react';
import { ContactForm } from '@/app/(marketing)/contact/contact-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.contact' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LocaleContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.contact' });
  const isFr = locale === 'fr-CA';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{t('heroHeading')}</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">{t('heroDescription')}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {isFr ? 'Envoyez-nous un message' : 'Send us a message'}
            </h2>
            <ContactForm />
          </div>

          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {isFr ? 'Autres façons de nous joindre' : 'Other ways to reach us'}
            </h2>
            <div className="space-y-6">
              <ContactInfoItem
                icon={<Mail className="h-5 w-5" />}
                label={isFr ? 'Courriel' : 'Email'}
                value="hello@union-eyes.ca"
                href="mailto:hello@union-eyes.ca"
              />
              <ContactInfoItem
                icon={<MapPin className="h-5 w-5" />}
                label={isFr ? 'Adresse' : 'Address'}
                value={isFr ? 'Toronto, Ontario, Canada' : 'Toronto, Ontario, Canada'}
              />
              <ContactInfoItem
                icon={<Clock className="h-5 w-5" />}
                label={isFr ? 'Heures de bureau' : 'Office hours'}
                value={isFr ? 'Lun–Ven, 9h–17h HE' : 'Mon–Fri, 9am–5pm ET'}
              />
            </div>

            <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                {isFr ? 'Pas de vente sous pression' : 'No pressure sales'}
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                {isFr
                  ? "Nous ne répondons pas aux demandes sur les délais de vente. Si nous ne sommes pas le bon outil pour vous, nous vous le dirons honnêtement."
                  : "We don't respond to inquiries on a sales cadence. If we're not the right tool for you, we'll tell you honestly."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ContactInfoItem({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {href ? (
          <a href={href} className="text-slate-900 hover:text-blue-600 transition-colors">
            {value}
          </a>
        ) : (
          <p className="text-slate-900">{value}</p>
        )}
      </div>
    </div>
  );
}
