/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * institutional trust for democratic infrastructure.
 */
/**
 * Locale-aware Contact page
 * Accessible at /{locale}/contact
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail, MapPin, Clock } from 'lucide-react';
import { ContactForm } from '@/app/(marketing)/contact/contact-form';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const CONTACT_COPY: Record<string, {
  sendMessage: string;
  otherWays: string;
  email: string;
  address: string;
  officeHours: string;
  officeHoursValue: string;
  salesHeading: string;
  salesBody: string;
}> = {
  'en-CA': {
    sendMessage: 'Send us a message',
    otherWays: 'Other ways to reach us',
    email: 'Email',
    address: 'Address',
    officeHours: 'Office hours',
    officeHoursValue: 'Mon-Fri, 9am-5pm ET',
    salesHeading: 'No pressure sales',
    salesBody: "We don't respond to inquiries on a sales cadence. If we're not the right tool for you, we'll tell you honestly.",
  },
  'fr-CA': {
    sendMessage: 'Envoyez-nous un message',
    otherWays: 'Autres facons de nous joindre',
    email: 'Courriel',
    address: 'Adresse',
    officeHours: 'Heures de bureau',
    officeHoursValue: 'Lun-Ven, 9h-17h HE',
    salesHeading: 'Pas de vente sous pression',
    salesBody: 'Nous ne repondons pas aux demandes sur un rythme commercial. Si nous ne sommes pas le bon outil pour vous, nous vous le dirons honnetement.',
  },
  it: {
    sendMessage: 'Inviaci un messaggio',
    otherWays: 'Altri modi per contattarci',
    email: 'Email',
    address: 'Indirizzo',
    officeHours: 'Orari di ufficio',
    officeHoursValue: 'Lun-Ven, 9:00-17:00 ET',
    salesHeading: 'Nessuna vendita aggressiva',
    salesBody: 'Non rispondiamo alle richieste con pressione commerciale. Se non siamo lo strumento giusto per te, te lo diremo con onesta.',
  },
  pt: {
    sendMessage: 'Envie-nos uma mensagem',
    otherWays: 'Outras formas de falar conosco',
    email: 'Email',
    address: 'Endereco',
    officeHours: 'Horario comercial',
    officeHoursValue: 'Seg-Sex, 9h-17h ET',
    salesHeading: 'Sem pressao comercial',
    salesBody: 'Nao respondemos com pressao de vendas. Se nao formos a ferramenta certa para voce, diremos isso com honestidade.',
  },
};

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
    alternates: buildLocaleAlternates(locale, '/contact'),
  };
}

export default async function LocaleContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.contact' });
  const copy = CONTACT_COPY[locale] ?? CONTACT_COPY['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Hero Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.contact}
        heading={t('heroHeading')}
        description={t('heroDescription')}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {copy.sendMessage}
            </h2>
            <ContactForm />
          </div>

          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {copy.otherWays}
            </h2>
            <div className="space-y-6">
              <ContactInfoItem
                icon={<Mail className="h-5 w-5" />}
                label={copy.email}
                value="hello@unioneyes.app"
                href="mailto:hello@unioneyes.app"
              />
              <ContactInfoItem
                icon={<MapPin className="h-5 w-5" />}
                label={copy.address}
                value="Ottawa, ON"
              />
              <ContactInfoItem
                icon={<Clock className="h-5 w-5" />}
                label={copy.officeHours}
                value={copy.officeHoursValue}
              />
            </div>

            <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                {copy.salesHeading}
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                {copy.salesBody}
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
