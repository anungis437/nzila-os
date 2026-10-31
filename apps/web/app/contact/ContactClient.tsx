'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import ScrollReveal from '@/components/public/ScrollReveal';
import { trackEvent } from '@/lib/telemetry';
import type { Locale } from '@/lib/locales';

const contactCopy: Record<Locale, {
  connect: string
  heroTitle: string
  heroSubtitle: string
  sendMessage: string
  responseTime: string
  success: string
  fullName: string
  fullNamePlaceholder: string
  emailAddress: string
  emailPlaceholder: string
  company: string
  companyPlaceholder: string
  industry: string
  selectVertical: string
  message: string
  messagePlaceholder: string
  website: string
  interestLabel: string
  interestOptions: Array<{ value: string; label: string }>
  privacyNotice: string
  sending: string
  send: string
  contactInfo: string
  contactBlurb: string
  inquiries: string
  inquiriesBlurb: string
  partnerPortal: string
  buildingWithUs: string
  buildingSubtitle: string
  teamPortalLogin: string
  requestPartnerAccess: string
  notPartnerYet: string
  applyProgram: string
  onboarding: string
  genericError: string
  networkError: string
  verticals: string[]
  sidebarItems: Array<{ icon: string; title: string; value: string; href: string; sub: string }>
  inquiriesList: string[]
  features: Array<{ icon: string; title: string; description: string }>
}> = {
  'en-CA': {
    connect: 'Connect',
    heroTitle: 'Get In Touch',
    heroSubtitle: "Let\'s discuss where your organization is exposed to continuity loss, governance fragility, or operational memory risk.",
    sendMessage: 'Send Us a Message',
    responseTime: 'We review inquiries and respond based on the nature of the request.',
    success: 'Thank you! Your message has been sent successfully.',
    fullName: 'Full Name *',
    fullNamePlaceholder: 'John Doe',
    emailAddress: 'Email Address *',
    emailPlaceholder: 'john@example.com',
    company: 'Company / Organization',
    companyPlaceholder: 'Acme Inc.',
    industry: 'Industry / Vertical',
    selectVertical: 'Select a vertical...',
    message: 'Message *',
    messagePlaceholder: 'Tell us about your continuity, governance, or Union Eyes pilot needs...',
    website: 'Website',
    sending: 'Sending...',
    send: 'Send Message',
    interestLabel: 'What would you like to discuss?',
    interestOptions: [
      { value: 'contact_page', label: 'General inquiry' },
      { value: 'union_eyes_pilot', label: 'Union Eyes pilot' },
      { value: 'civic_briefing', label: 'CIVIC institutional briefing' },
      { value: 'portfolio_inquiry', label: 'Other Nzila product' },
{ value: 'careers_interest', label: 'Working with us' },
    ],
    privacyNotice: 'We use the details you submit to review and respond to your inquiry. See our privacy policy.',
    contactInfo: 'Contact Information',
    contactBlurb: "Reach out for continuity assessment, governance review, Union Eyes pilot, or procurement documentation.",
    inquiries: 'Governance Inquiries',
    inquiriesBlurb: 'For continuity assessments, Union Eyes pilots, organizational reviews, or procurement documentation:',
    partnerPortal: 'Partner Portal',
    buildingWithUs: 'Already Building With Us?',
    buildingSubtitle: 'Access your dedicated dashboard, manage deployments, and collaborate with the Nzila Ventures engineering team — all in one place.',
    teamPortalLogin: 'Partner workspace →',
    requestPartnerAccess: 'Request Partner Access',
    notPartnerYet: 'Not a partner yet?',
    applyProgram: 'Apply to our partnership program',
    onboarding: '— contact us to discuss the appropriate next steps.',
    genericError: 'Something went wrong',
    networkError: 'Network error - please try again',
    verticals: ['Healthtech', 'Uniontech', 'Insurtech', 'Legaltech', 'Fintech', 'Trade & Commerce', 'Justice & Equity', 'Entertainment', 'Agrotech', 'EdTech', 'Other'],
    sidebarItems: [
      { icon: '✉️', title: 'Email', value: 'contact@nzilaventures.com', href: 'mailto:contact@nzilaventures.com', sub: 'Response times depend on the request' },
      { icon: '📞', title: 'Phone', value: 'Schedule on request', href: '', sub: 'Phone support by arranged discovery call' },
      { icon: '🌍', title: 'Office', value: 'Remote-First · Global Opérations', href: '', sub: 'Teams across multiple time zones' },
    ],
    inquiriesList: ['OCI Continuity Risk Assessment', 'Union Eyes pilot scoping', 'Governance and trust review', 'Procurement-safe doctrine materials'],
    features: [
      { icon: '📊', title: 'Continuity Baseline', description: 'Structured review of key-person dependency, transition exposure, governance visibility, and operational memory risk.' },
      { icon: '🔧', title: 'Pilot Scoping', description: 'Define a bounded pilot function, success criteria, role authority, consent expectations, and review cadence.' },
      { icon: '🤝', title: 'Governance Review', description: 'Map decision lineage, audit evidence, access controls, and organizational accountability before deployment.' },
      { icon: '🔐', title: 'Role-Scoped Access', description: 'Enterprise identity with documented authority, least-privilege access, and reviewable audit logs.' },
      { icon: '💬', title: 'Operator Enablement', description: 'Training and support for stewards, coordinators, staff, and organizational operators inside the pilot scope.' },
      { icon: '📈', title: 'Validation Report', description: 'Pilot closure findings focused on continuity, governance evidence, trust posture, and anti-surveillance compliance.' },
    ],
  },
  'fr-CA': {
    connect: 'Connexion',
    heroTitle: 'Entrons en contact',
    heroSubtitle: 'Discutons des risques de continuité, de fragilité de gouvernance ou de mémoire opérationnelle de votre organisation.',
    sendMessage: 'Envoyez-nous un message',
    responseTime: 'Nous examinons les demandes et répondons selon leur nature.',
    success: 'Merci ! Votre message a été envoye avec succes.',
    fullName: 'Nom complet *',
    fullNamePlaceholder: 'Jean Dupont',
    emailAddress: 'Adresse courriel *',
    emailPlaceholder: 'jean@exemple.com',
    company: 'Entreprise / Organisation',
    companyPlaceholder: 'Acme Inc.',
    industry: 'Secteur / Verticale',
    selectVertical: 'Sélectionnez une verticale...',
    message: 'Message *',
    messagePlaceholder: 'Parlez-nous de vos besoins de continuité, gouvernance ou pilote Union Eyes...',
    website: 'Site Web',
    sending: 'Envoi...',
    send: 'Envoyer le message',
    interestLabel: 'Quel sujet souhaitez-vous aborder ?',
    interestOptions: [
      { value: 'contact_page', label: 'Demande générale' },
      { value: 'union_eyes_pilot', label: 'Pilote Union Eyes' },
      { value: 'civic_briefing', label: 'Présentation CIVIC' },
      { value: 'portfolio_inquiry', label: 'Autre produit Nzila' },
{ value: 'careers_interest', label: 'Travailler avec nous' },
    ],
    privacyNotice: 'Nous utilisons vos renseignements pour examiner votre demande et vous répondre. Consultez notre politique de confidentialité.',
    contactInfo: 'Coordonnées',
    contactBlurb: 'Communiquez avec nous pour une évaluation de continuité, une revue de gouvernance, un pilote Union Eyes ou une documentation procurement.',
    inquiries: 'Demandes de gouvernance',
    inquiriesBlurb: 'Pour évaluations de continuité, pilotes Union Eyes, revues institutionnelles ou documentation procurement :',
    partnerPortal: 'Portail partenaires',
    buildingWithUs: 'Vous construisez déjà avec nous ?',
    buildingSubtitle: 'Accédez a votre tableau de bord, gérez vos déploiements et collaborez avec l équipe d ingénierie Nzila Ventures.',
    teamPortalLogin: 'Espace partenaires →',
    requestPartnerAccess: 'Demander un accès partenaire',
    notPartnerYet: 'Pas encore partenaire ?',
    applyProgram: 'Postulez a notre programme de partenariat',
    onboarding: '— communiquez avec nous pour définir la suite.',
    genericError: 'Une erreur est survenue',
    networkError: 'Erreur réseau - veuillez reessayer',
    verticals: ['Santé', 'Travail syndical', 'Assurtech', 'Legaltech', 'Fintech', 'Commerce', 'Justice et équité', 'Divertissement', 'Agrotech', 'EdTech', 'Autre'],
    sidebarItems: [
      { icon: '✉️', title: 'Courriel', value: 'contact@nzilaventures.com', href: 'mailto:contact@nzilaventures.com', sub: 'Le délai dépend de la nature de la demande' },
      { icon: '📞', title: 'Téléphone', value: 'Planification sur demande', href: '', sub: 'Support téléphonique via appel de découverte' },
      { icon: '🌍', title: 'Bureau', value: "Télétravail d'abord · Opérations mondiales", href: '', sub: 'Équipes sur plusieurs fuseaux horaires' },
    ],
    inquiriesList: ['Évaluation de risque de continuité institutionnelle', 'Cadrage pilote Union Eyes', 'Revue de gouvernance et confiance', 'Matériaux doctrine procurement-safe'],
    features: [
      { icon: '📊', title: 'Base de continuité', description: 'Revue de dépendance aux personnes clés, exposition de transition, visibilité de gouvernance et risque mémoire.' },
      { icon: '🔧', title: 'Cadrage pilote', description: 'Définir fonction pilote, critères de succès, autorités de rôle, consentement et cadence de revue.' },
      { icon: '🤝', title: 'Revue de gouvernance', description: 'Cartographier lignée décisionnelle, preuves d audit, contrôles d accès et accountability institutionnelle.' },
      { icon: '🔐', title: 'Accès par rôle', description: 'Identité entreprise avec autorité documentée, moindre privilège et journaux d audit révisables.' },
      { icon: '💬', title: 'Formation opérateurs', description: 'Support pour délégués, coordinateurs, équipes et opérateurs institutionnels dans le périmètre pilote.' },
      { icon: '📈', title: 'Rapport de validation', description: 'Conclusions de clôture sur continuité, preuves de gouvernance, confiance et conformité anti-surveillance.' },
    ],
  },
};

export default function ContactClient({ initialSource }: { initialSource: string }) {
  const locale = useLocale() as Locale;
  const copy = contactCopy[locale] ?? contactCopy['en-CA'];

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    vertical: '',
    message: '',
    source: initialSource,
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    website: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    trackEvent('contact_submit_attempt', {
      vertical: formData.vertical || 'unspecified',
      has_company: Boolean(formData.company),
    });

    // Resolve attribution at submit time, without a hydration state update.
    // Never trust arbitrary interest labels as CRM source values.
    const params = new URLSearchParams(window.location.search);
    const payload = {
      ...formData,
      source: formData.source,
      utmSource: (params.get('utm_source') ?? '').slice(0, 128),
      utmMedium: (params.get('utm_medium') ?? '').slice(0, 160),
      utmCampaign: (params.get('utm_campaign') ?? '').slice(0, 160),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? copy.genericError);
        trackEvent('contact_submit_failed', {
          vertical: formData.vertical || 'unspecified',
          status: res.status,
        });
        return;
      }

      setSubmitted(true);
      trackEvent('contact_submit_success', {
        vertical: formData.vertical || 'unspecified',
      });
      setFormData((prev) => ({
        ...prev,
        name: '',
        email: '',
        company: '',
        vertical: '',
        message: '',
        website: '',
      }));
      // Keep the confirmation visible to assistive technology until the user navigates away.
    } catch {
      setError(copy.networkError);
      trackEvent('contact_submit_network_error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const verticals = copy.verticals;

  const inputClasses =
    'w-full min-w-0 min-h-12 px-4 py-3 bg-[#f8fafc] border border-slate-300 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric transition-colors text-gray-900 placeholder-gray-500';

  return (
    <main className="min-h-screen">
      {/* A human-centered invitation, rather than an unrelated stock photo. */}
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-48 h-[34rem] w-[34rem] rounded-full bg-blue-600/20 blur-[105px]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-16rem] left-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#dfbe70]/10 blur-[95px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-36 sm:px-6 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-24 lg:pt-44">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">{copy.connect}</p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.09] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{copy.heroTitle}</h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">{copy.heroSubtitle}</p>
            <a href="#contact-form" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-[#101a2c] transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {copy.sendMessage} <span aria-hidden="true" className="ml-2">↘</span>
            </a>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.045] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">
              {locale === 'fr-CA' ? 'Le début d’une conversation' : 'Start a conversation'}
            </p>
            <p className="mt-5 text-xl font-semibold leading-relaxed text-white sm:text-2xl">
              {locale === 'fr-CA'
                ? 'Parlez-nous de votre défi. Nous parlerons de votre réalité avant de parler de technologie.'
                : 'Tell us what you are facing. We will start with your reality, not a product pitch.'}
            </p>
            <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-6">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfbe70]/40 bg-[#dfbe70]/10 text-[#dfbe70]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M4.5 21v-3a7.5 7.5 0 0 1 15 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <p className="text-sm leading-6 text-slate-300">
                {locale === 'fr-CA' ? 'Une démarche humaine et adaptée à votre organisation.' : 'A human conversation, grounded in your organization.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CONTACT CONTENT ═══════════════════════ */}
      <section id="contact-form" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid min-w-0 gap-12 lg:grid-cols-2 lg:gap-16">
            {/* ── FORM ── */}
            <ScrollReveal direction="left">
              <div>
                <h2 className="text-3xl font-bold text-navy mb-2">{copy.sendMessage}</h2>
                <p className="text-gray-500 mb-8">{copy.responseTime}</p>

                {submitted && (
                  <div role="status" aria-live="polite" className="mb-6 p-4 bg-emerald/5 border border-emerald/20 rounded-xl">
                    <p className="text-emerald font-medium">
                      {copy.success}
                    </p>
                  </div>
                )}

                {error && (
                  <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.fullName}
                    </label>
                    <input type="text" id="name" name="name" autoComplete="name" required value={formData.name} onChange={handleChange} className={inputClasses} placeholder={copy.fullNamePlaceholder} />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.emailAddress}
                    </label>
                    <input type="email" id="email" name="email" autoComplete="email" inputMode="email" required value={formData.email} onChange={handleChange} className={inputClasses} placeholder={copy.emailPlaceholder} />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.company}
                    </label>
                    <input type="text" id="company" name="company" autoComplete="organization" value={formData.company} onChange={handleChange} className={inputClasses} placeholder={copy.companyPlaceholder} />
                  </div>

                  <div>
                    <label htmlFor="vertical" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.industry}
                    </label>
                    <select id="vertical" name="vertical" value={formData.vertical} onChange={handleChange} className={inputClasses}>
                      <option value="">{copy.selectVertical}</option>
                      {verticals.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="source" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.interestLabel}
                    </label>
                    <select id="source" name="source" value={formData.source} onChange={handleChange} className={inputClasses}>
                      {copy.interestOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.message}
                    </label>
                    <textarea id="message" name="message" required value={formData.message} onChange={handleChange} rows={5} maxLength={2000} className={inputClasses} placeholder={copy.messagePlaceholder} />
                  </div>

                  {/* Honeypot field for basic bot filtering */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website">{copy.website}</label>
                    <input id="website" name="website" value={formData.website} onChange={handleChange} tabIndex={-1} autoComplete="off" />
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    {copy.privacyNotice}{' '}
                    <a href="/legal/privacy" className="font-semibold text-electric underline-offset-2 hover:underline">
                      {locale === 'fr-CA' ? 'En savoir plus' : 'Learn more'}
                    </a>
                  </p>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-12 bg-[#193d7a] text-white font-bold py-4 px-6 rounded-xl hover:bg-[#234f93] transition-colors text-base shadow-lg shadow-blue-900/15 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
                  >
                    {submitting ? copy.sending : copy.send}
                  </button>
                </form>
              </div>
            </ScrollReveal>

            {/* ── SIDEBAR ── */}
            <ScrollReveal direction="right">
              <div>
                <h2 className="text-3xl font-bold text-navy mb-2">{copy.contactInfo}</h2>
                <p className="text-gray-500 mb-8">
                  {copy.contactBlurb}
                </p>

                <div className="space-y-6">
                  {copy.sidebarItems.map((item) => (
                    <div key={item.title} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover-lift cursor-default">
                      <span className="text-2xl mt-0.5">{item.icon}</span>
                      <div>
                        <h3 className="font-semibold text-navy mb-0.5">{item.title}</h3>
                        {item.href ? (
                          <a href={item.href} className="text-electric hover:underline font-medium">{item.value}</a>
                        ) : (
                          <p className="text-gray-700 font-medium">{item.value}</p>
                        )}
                        <p className="text-sm text-gray-500 mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Business Inquiries */}
                <div className="mt-10 rounded-2xl bg-[#101a2c] p-6 text-white">
                  <h3 className="font-bold text-lg mb-3">{copy.inquiries}</h3>
                  <p className="text-gray-300 text-sm mb-4">
                    {copy.inquiriesBlurb}
                  </p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {copy.inquiriesList.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-gold rounded-full shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PARTNER PORTAL ═══════════════════════ */}
      <section className="relative isolate overflow-hidden bg-[#101a2c] py-20 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-blue-600/15 blur-[100px]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-16rem] left-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#dfbe70]/10 blur-[100px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Heading */}
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
                {copy.partnerPortal}
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {copy.buildingWithUs}
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                {copy.buildingSubtitle}
              </p>
            </div>
          </ScrollReveal>

          {/* Feature Grid */}
          <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {copy.features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.045] p-6 transition-colors hover:bg-white/[0.08]">
                  <span aria-hidden="true" className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfbe70]/30 bg-[#dfbe70]/10 text-sm font-semibold text-[#dfbe70]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm leading-7 text-slate-300">{feature.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* CTA Row */}
          <ScrollReveal delay={0.3}>
            <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
              <a
                href="/partners"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-[#101a2c] transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {copy.teamPortalLogin}
              </a>
              <a
                href="mailto:partners@nzilaventures.com"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {copy.requestPartnerAccess}
              </a>
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-slate-300">
              {copy.notPartnerYet}{' '}
              <a href="/contact" className="text-gold hover:underline">
                {copy.applyProgram}
              </a>{' '}
              {copy.onboarding}
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}







