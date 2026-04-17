'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import ScrollReveal from './ScrollReveal';
import type { Locale } from '@/lib/locales';

const techStack = [
  { name: 'Azure', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azure/azure-original.svg' },
  { name: 'Django', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/django/django-plain.svg' },
  { name: 'Next.js', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg' },
  { name: 'PostgreSQL', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg' },
  { name: 'TensorFlow', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tensorflow/tensorflow-original.svg' },
  { name: 'Python', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg' },
  { name: 'TypeScript', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg' },
  { name: 'Docker', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg' },
];

interface TechStackBarProps {
  className?: string;
  label?: string;
}

export default function TechStackBar({ className = '', label = 'Built With' }: TechStackBarProps) {
  const locale = useLocale() as Locale;
  const resolvedLabel = label === 'Built With'
    ? (locale === 'fr-CA' ? 'Construit avec' : 'Built With')
    : label;

  return (
    <ScrollReveal className={className}>
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 text-center mb-6">
        {resolvedLabel}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
        {techStack.map((tech) => (
          <div
            key={tech.name}
            className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <Image
              src={tech.logo}
              alt={tech.name}
              width={40}
              height={40}
              className="grayscale hover:grayscale-0 transition-all"
            />
            <span className="text-xs text-gray-500">{tech.name}</span>
          </div>
        ))}
      </div>
    </ScrollReveal>
  );
}







