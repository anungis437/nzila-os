'use client';

import Link from 'next/link';
import Image from 'next/image';
import ScrollReveal from './ScrollReveal';

interface InvestorCTAProps {
  className?: string;
}

export default function InvestorCTA({ className = '' }: InvestorCTAProps) {
  return (
    <section className={`relative overflow-hidden py-24 ${className}`}>
      <Image
        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920"
        alt="Earth at night showing interconnected cities — Nzila Ventures global AI infrastructure"
        fill
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-linear-to-r from-navy/95 via-navy/85 to-electric/60" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <ScrollReveal direction="left">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-4">
              For Investors
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Series A — Join the Future of AI Infrastructure
            </h2>
            <p className="text-gray-300 mb-6">
              $100B+ TAM. 15 platforms. 4 flagships. One unified Backbone.
            </p>
            <Link
              href="/investors"
              className="inline-flex items-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-colors text-lg"
            >
              View Investment Thesis
            </Link>
          </ScrollReveal>

          <ScrollReveal direction="right">
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-4">
              For Partners
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Build With the APEX of AI
            </h2>
            <p className="text-gray-300 mb-6">
              Deploy ethical AI solutions across healthcare, finance, agriculture, and beyond.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-4 bg-white text-navy font-bold rounded-xl hover:bg-gray-100 transition-colors text-lg"
            >
              Partner With Us
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
