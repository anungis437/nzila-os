'use client';

import Image from 'next/image';
import { useState } from 'react';
import ScrollReveal from '@/components/public/ScrollReveal';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    vertical: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const verticals = [
    'Healthtech', 'Uniontech', 'Insurtech', 'Legaltech', 'Fintech',
    'Trade & Commerce', 'Justice & Equity', 'Entertainment',
    'Agrotech', 'EdTech', 'Other',
  ];

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
              Connect
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">Get In Touch</h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Let&apos;s discuss how Nzila Ventures can accelerate your organization&apos;s AI transformation.
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
                <h2 className="text-3xl font-bold text-navy mb-2">Send Us a Message</h2>
                <p className="text-gray-500 mb-8">We&apos;ll get back to you within 24-48 hours.</p>

                {submitted && (
                  <div className="mb-6 p-4 bg-emerald/5 border border-emerald/20 rounded-xl">
                    <p className="text-emerald font-medium">
                      Thank you! Your message has been sent successfully.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-navy mb-1.5">
                      Full Name *
                    </label>
                    <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} className={inputClasses} placeholder="John Doe" />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-navy mb-1.5">
                      Email Address *
                    </label>
                    <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} className={inputClasses} placeholder="john@example.com" />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-semibold text-navy mb-1.5">
                      Company / Organization
                    </label>
                    <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} className={inputClasses} placeholder="Acme Inc." />
                  </div>

                  <div>
                    <label htmlFor="vertical" className="block text-sm font-semibold text-navy mb-1.5">
                      Industry / Vertical
                    </label>
                    <select id="vertical" name="vertical" value={formData.vertical} onChange={handleChange} className={inputClasses}>
                      <option value="">Select a vertical…</option>
                      {verticals.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-navy mb-1.5">
                      Message *
                    </label>
                    <textarea id="message" name="message" required value={formData.message} onChange={handleChange} rows={5} className={inputClasses} placeholder="Tell us about your needs…" />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-electric text-white font-bold py-4 px-6 rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/25 btn-press"
                  >
                    Send Message
                  </button>
                </form>
              </div>
            </ScrollReveal>

            {/* ── SIDEBAR ── */}
            <ScrollReveal direction="right">
              <div>
                <h2 className="text-3xl font-bold text-navy mb-2">Contact Information</h2>
                <p className="text-gray-500 mb-8">
                  Reach out through any channel — we&apos;re here to help transform your vision.
                </p>

                <div className="space-y-6">
                  {[
                    { icon: '✉️', title: 'Email', value: 'contact@nzilaventures.com', href: 'mailto:contact@nzilaventures.com', sub: 'We respond within 24-48 hours' },
                    { icon: '📞', title: 'Phone', value: '+1 (234) 567-890', href: 'tel:+1234567890', sub: 'Mon – Fri, 9 AM – 5 PM EST' },
                    { icon: '🌍', title: 'Office', value: 'Remote-First · Global Operations', href: '', sub: 'Teams across multiple time zones' },
                  ].map((item) => (
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
                  <h3 className="font-bold text-lg mb-3">Business Inquiries</h3>
                  <p className="text-gray-300 text-sm mb-4">
                    For partnerships, investment discussions, or platform collaborations:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {['Platform integration opportunities', 'Vertical-specific solutions', 'Strategic partnerships', 'Investment discussions'].map((item) => (
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
                Partner Portal
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Already Building With Us?
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Access your dedicated dashboard, manage deployments, and collaborate with
                the Nzila Ventures engineering team — all in one place.
              </p>
            </div>
          </ScrollReveal>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            {[
              {
                icon: '📊',
                title: 'Performance Dashboard',
                description: 'Real-time metrics across all your deployed verticals — uptime, API calls, revenue attribution, and AI model accuracy.',
              },
              {
                icon: '🔧',
                title: 'Deployment Management',
                description: 'One-click staging → production promotion, rollback controls, and environment configuration for every platform.',
              },
              {
                icon: '🤝',
                title: 'Shared Roadmap',
                description: 'Collaborative backlog with your dedicated Nzila engineering pod. Vote on features, track sprints, and review release notes.',
              },
              {
                icon: '🔐',
                title: 'SSO & Team Access',
                description: 'Enterprise single sign-on with role-based permissions. Manage team members, API keys, and audit logs from one console.',
              },
              {
                icon: '💬',
                title: 'Priority Support',
                description: 'Direct Slack channel with your engineering pod, 4-hour SLA for critical issues, and monthly architecture reviews.',
              },
              {
                icon: '📈',
                title: 'AI & Analytics Lab',
                description: 'Experiment with custom AI models, run A/B tests on new features, and access detailed analytics on user engagement.',
              },
            ].map((feature, i) => (
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
                Team Portal Login →
              </a>
              <a
                href="mailto:partners@nzilaventures.com"
                className="inline-flex items-center justify-center px-10 py-4 border-2 border-white/30 text-white font-bold rounded-xl hover:bg-white/10 transition-all text-lg"
              >
                Request Partner Access
              </a>
            </div>
            <p className="text-center text-gray-500 text-sm mt-6">
              Not a partner yet?{' '}
              <a href="/contact" className="text-gold hover:underline">
                Apply to our partnership program
              </a>{' '}
              — we onboard qualified teams within 48 hours.
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
