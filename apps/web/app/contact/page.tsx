'use client';

import Image from 'next/image';
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
    responseTime: "We\'ll get back to you within 24-48 hours.",
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
    contactInfo: 'Contact Information',
    contactBlurb: "Reach out for continuity assessment, governance review, Union Eyes pilot, or procurement documentation.",
    inquiries: 'Governance Inquiries',
    inquiriesBlurb: 'For continuity assessments, Union Eyes pilots, institutional reviews, or procurement documentation:',
    partnerPortal: 'Partner Portal',
    buildingWithUs: 'Already Building With Us?',
    buildingSubtitle: 'Access your dedicated dashboard, manage deployments, and collaborate with the Nzila Ventures engineering team — all in one place.',
    teamPortalLogin: 'Team Portal Login ->',
    requestPartnerAccess: 'Request Partner Access',
    notPartnerYet: 'Not a partner yet?',
    applyProgram: 'Apply to our partnership program',
    onboarding: '— we onboard qualified teams within 48 hours.',
    genericError: 'Something went wrong',
    networkError: 'Network error - please try again',
    verticals: ['Healthtech', 'Uniontech', 'Insurtech', 'Legaltech', 'Fintech', 'Trade & Commerce', 'Justice & Equity', 'Entertainment', 'Agrotech', 'EdTech', 'Other'],
    sidebarItems: [
      { icon: '✉️', title: 'Email', value: 'contact@nzilaventures.com', href: 'mailto:contact@nzilaventures.com', sub: 'We respond within 24-48 hours' },
      { icon: '📞', title: 'Phone', value: 'Schedule on request', href: '', sub: 'Phone support by arranged discovery call' },
      { icon: '🌍', title: 'Office', value: 'Remote-First · Global Opérations', href: '', sub: 'Teams across multiple time zones' },
    ],
    inquiriesList: ['OCI Continuity Risk Assessment', 'Union Eyes pilot scoping', 'Governance and trust review', 'Procurement-safe doctrine materials'],
    features: [
      { icon: '📊', title: 'Continuity Baseline', description: 'Structured review of key-person dependency, transition exposure, governance visibility, and operational memory risk.' },
      { icon: '🔧', title: 'Pilot Scoping', description: 'Define a bounded pilot function, success criteria, role authority, consent expectations, and review cadence.' },
      { icon: '🤝', title: 'Governance Review', description: 'Map decision lineage, audit evidence, access controls, and institutional accountability before deployment.' },
      { icon: '🔐', title: 'Role-Scoped Access', description: 'Enterprise identity with documented authority, least-privilege access, and reviewable audit logs.' },
      { icon: '💬', title: 'Operator Enablement', description: 'Training and support for stewards, coordinators, staff, and institutional operators inside the pilot scope.' },
      { icon: '📈', title: 'Validation Report', description: 'Pilot closure findings focused on continuity, governance evidence, trust posture, and anti-surveillance compliance.' },
    ],
  },
  'fr-CA': {
    connect: 'Connexion',
    heroTitle: 'Entrons en contact',
    heroSubtitle: 'Discutons des risques de continuité, de fragilité de gouvernance ou de mémoire opérationnelle de votre organisation.',
    sendMessage: 'Envoyez-nous un message',
    responseTime: 'Nous vous répondrons sous 24 a 48 heures.',
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
    contactInfo: 'Coordonnées',
    contactBlurb: 'Communiquez avec nous pour une évaluation de continuité, une revue de gouvernance, un pilote Union Eyes ou une documentation procurement.',
    inquiries: 'Demandes de gouvernance',
    inquiriesBlurb: 'Pour évaluations de continuité, pilotes Union Eyes, revues institutionnelles ou documentation procurement :',
    partnerPortal: 'Portail partenaires',
    buildingWithUs: 'Vous construisez déjà avec nous ?',
    buildingSubtitle: 'Accédez a votre tableau de bord, gérez vos déploiements et collaborez avec l équipe d ingénierie Nzila Ventures.',
    teamPortalLogin: 'Connexion au portail équipe ->',
    requestPartnerAccess: 'Demander un accès partenaire',
    notPartnerYet: 'Pas encore partenaire ?',
    applyProgram: 'Postulez a notre programme de partenariat',
    onboarding: '- nous intégrons les équipes qualifiées sous 48 heures.',
    genericError: 'Une erreur est survenue',
    networkError: 'Erreur réseau - veuillez reessayer',
    verticals: ['Santé', 'Travail syndical', 'Assurtech', 'Legaltech', 'Fintech', 'Commerce', 'Justice et équité', 'Divertissement', 'Agrotech', 'EdTech', 'Autre'],
    sidebarItems: [
      { icon: '✉️', title: 'Courriel', value: 'contact@nzilaventures.com', href: 'mailto:contact@nzilaventures.com', sub: 'Reponse sous 24 a 48 heures' },
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

export default function Contact() {
  const locale = useLocale() as Locale;
  const copy = contactCopy[locale] ?? contactCopy['en-CA'];

  const [formData, setFormData] = useState(() => {
    const params = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;

    return {
      name: '',
      email: '',
      company: '',
      vertical: '',
      message: '',
      source: 'contact_page',
      utmSource: params?.get('utm_source') ?? '',
      utmMedium: params?.get('utm_medium') ?? '',
      utmCampaign: params?.get('utm_campaign') ?? '',
      website: '',
    };
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

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
      setTimeout(() => setSubmitted(false), 5000);
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
    'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-electric/40 focus:border-electric transition text-gray-900 placeholder-gray-400';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[50vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920"
          alt="Modern open-plan office with floor-to-ceiling windows and warm natural light"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {copy.connect}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">{copy.heroTitle}</h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {copy.heroSubtitle}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ CONTACT CONTENT ═══════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* ── FORM ── */}
            <ScrollReveal direction="left">
              <div>
                <h2 className="text-3xl font-bold text-navy mb-2">{copy.sendMessage}</h2>
                <p className="text-gray-500 mb-8">{copy.responseTime}</p>

                {submitted && (
                  <div className="mb-6 p-4 bg-emerald/5 border border-emerald/20 rounded-xl">
                    <p className="text-emerald font-medium">
                      {copy.success}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.fullName}
                    </label>
                    <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} className={inputClasses} placeholder={copy.fullNamePlaceholder} />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.emailAddress}
                    </label>
                    <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} className={inputClasses} placeholder={copy.emailPlaceholder} />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.company}
                    </label>
                    <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} className={inputClasses} placeholder={copy.companyPlaceholder} />
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
                    <label htmlFor="message" className="block text-sm font-semibold text-navy mb-1.5">
                      {copy.message}
                    </label>
                    <textarea id="message" name="message" required value={formData.message} onChange={handleChange} rows={5} className={inputClasses} placeholder={copy.messagePlaceholder} />
                  </div>

                  {/* Honeypot field for basic bot filtering */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website">{copy.website}</label>
                    <input id="website" name="website" value={formData.website} onChange={handleChange} tabIndex={-1} autoComplete="off" />
                  </div>

                  <button
                    disabled={submitting}
                    className="w-full bg-electric text-white font-bold py-4 px-6 rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/25 btn-press disabled:opacity-60"
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
                <div className="mt-10 bg-navy rounded-2xl p-6 text-white pulse-glow">
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
      <section className="relative py-24 overflow-hidden">
        {/* Background */}
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920"
          alt="Diverse team collaborating around a conference table with laptops and digital dashboards"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-br from-navy/90 via-navy/85 to-navy/95" />

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
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            {copy.features.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.08}>
                <div className="glass-card p-6 rounded-2xl border border-white/10 hover-lift h-full">
                  <span className="text-3xl block mb-4">{feature.icon}</span>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* CTA Row */}
          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <a
                href="/partners"
                className="inline-flex items-center justify-center px-10 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold/90 transition-all text-lg shadow-lg shadow-gold/25 btn-press"
              >
                {copy.teamPortalLogin}
              </a>
              <a
                href="mailto:partners@nzilaventures.com"
                className="inline-flex items-center justify-center px-10 py-4 border-2 border-white/30 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-lg"
              >
                {copy.requestPartnerAccess}
              </a>
            </div>
            <p className="text-center text-gray-500 text-sm mt-6">
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







