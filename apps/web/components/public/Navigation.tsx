'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useLocale, useTranslations } from 'next-intl';
import TrackedLink from './TrackedLink';
import { locales, type Locale } from '@/lib/locales';

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001';
const PARTNERS_URL = process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'http://localhost:3004';

const navigation = [
  { key: 'continuity', href: '/organizational-continuity' },
  { key: 'publicService', href: '/public-service' },
  { key: 'unionEyes', href: '/union-eyes' },
  { key: 'platform', href: '/platform' },
  { key: 'trust', href: '/trust' },
  { key: 'insights', href: '/insights' },
  { key: 'contact', href: '/contact' },
] as const;

const appLinks = [
  { key: 'console', href: CONSOLE_URL },
  { key: 'partnerPortal', href: PARTNERS_URL },
] as const;

const localeLabels: Record<Locale, string> = {
  'en-CA': 'EN',
  'fr-CA': 'FR',
};

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  const isConsole = pathname?.startsWith('/console');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isConsole) {
    return null;
  }

  const setLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return;
    }

    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center">
                <span className="text-white font-bold text-sm">NV</span>
              </div>
              <span
                className={`text-xl font-bold transition-colors ${
                  scrolled ? 'text-navy' : 'text-white'
                }`}
              >
                Nzila Ventures
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative ${
                    isActive
                      ? scrolled ? 'text-electric' : 'text-white'
                      : scrolled
                      ? 'text-gray-600 hover:text-navy'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t(item.key)}
                  {isActive && (
                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-electric rounded-full" />
                  )}
                </Link>
              );
            })}
            <TrackedLink
              href="/contact"
              eventName="book_demo_click"
              eventProps={{ source: 'navigation_desktop' }}
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25"
            >
              {t('requestDemo')}
            </TrackedLink>
            {/* App-switcher divider */}
            <div className="w-px h-6 bg-gray-200" />
            {appLinks.map((app) => (
              <TrackedLink
                key={app.key}
                href={app.href}
                eventName="app_switch"
                eventProps={{ app: app.key, source: 'navigation_desktop' }}
                external
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  scrolled ? 'text-gray-500 hover:text-navy' : 'text-white/60 hover:text-white'
                }`}
              >
                {t(app.key)}
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </TrackedLink>
            ))}
            <div className="w-px h-6 bg-gray-200" />
            <div
              role="group"
              aria-label="Language selector"
              className={`inline-flex rounded-xl border p-0.5 ${
                scrolled ? 'border-gray-200 bg-white' : 'border-white/40 bg-white/10'
              }`}
            >
              {locales.map((option) => {
                const selected = option === locale;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLocale(option)}
                    aria-pressed={selected}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      selected
                        ? 'bg-electric text-white'
                        : scrolled
                        ? 'text-gray-600 hover:text-navy'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {localeLabels[option]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className={`p-2 rounded-lg transition-colors ${
                scrolled ? 'text-gray-700' : 'text-white'
              }`}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 transition-all duration-300 overflow-hidden"
          style={{
            maxHeight: mobileMenuOpen ? '1000px' : '0',
            opacity: mobileMenuOpen ? 1 : 0,
          }}
        >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-base font-medium ${
                      isActive
                        ? 'bg-electric/10 text-electric'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <TrackedLink
                href="/contact"
                eventName="book_demo_click"
                eventProps={{ source: 'navigation_mobile' }}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 bg-electric text-white rounded-xl text-base font-semibold text-center mt-2"
              >
                {t('requestDemo')}
              </TrackedLink>
              <div className="pt-2 border-t border-gray-100 mt-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('apps')}</p>
                {appLinks.map((app) => (
                  <TrackedLink
                    key={app.key}
                    href={app.href}
                    eventName="app_switch"
                    eventProps={{ app: app.key, source: 'navigation_mobile' }}
                    external
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {t(app.key)}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </TrackedLink>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-100 mt-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('language')}</p>
                <div className="px-4 grid grid-cols-2 gap-2">
                  {locales.map((option) => {
                    const selected = option === locale;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setLocale(option);
                          setMobileMenuOpen(false);
                        }}
                        aria-pressed={selected}
                        className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          selected
                            ? 'bg-electric text-white border-electric'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {localeLabels[option]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
        </div>
        )}
    </nav>
  );
}






