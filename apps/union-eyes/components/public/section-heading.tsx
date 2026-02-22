/**
 * SectionHeading — Consistent badge + title + subtitle pattern
 * Matches the apps/web design language.
 */
'use client';

import ScrollReveal from './scroll-reveal';

interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  light?: boolean;
}

export default function SectionHeading({
  badge,
  title,
  subtitle,
  align = 'center',
  light = false,
}: SectionHeadingProps) {
  return (
    <ScrollReveal className={`mb-16 ${align === 'center' ? 'text-center' : ''}`}>
      {badge && (
        <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
          {badge}
        </span>
      )}
      <h2
        className={`text-3xl md:text-5xl font-bold mb-4 ${
          light ? 'text-white' : 'text-navy'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-lg max-w-2xl ${
            align === 'center' ? 'mx-auto' : ''
          } ${light ? 'text-gray-300' : 'text-gray-500'}`}
        >
          {subtitle}
        </p>
      )}
    </ScrollReveal>
  );
}
