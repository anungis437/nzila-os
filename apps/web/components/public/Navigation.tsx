'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Bars3Icon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useLocale, useTranslations } from 'next-intl';
import TrackedLink from './TrackedLink';
import { locales, type Locale } from '@/lib/locales';

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL;

const navigation = [
  { key: 'publicService', href: '/public-service' },
  { key: 'unionEyes', href: '/union-eyes' },
  { key: 'platform', href: '/platform' },
  { key: 'trust', href: '/trust' },
  { key: 'products', href: '/products' },
  { key: 'contact', href: '/contact' },
] as const;

const appLinks = CONSOLE_URL && /^https:\/\//.test(CONSOLE_URL) ? [{ key: 'console' as const, href: CONSOLE_URL }] : [];

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  
  const isConsole = pathname?.startsWith('/console');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

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
      aria-label={locale === 'fr-CA' ? 'Navigation principale' : 'Primary navigation'}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm'
          : 'bg-[#080e1c]/90 backdrop-blur-xl border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          <div className="flex items-center">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dfbe70]/35 bg-[#18335d] shadow-sm">
                <span className="text-[#dfbe70] font-bold text-sm tracking-tight">NV</span>
              </div>
              <span
                className={`truncate text-base font-semibold tracking-tight transition-colors sm:text-xl ${
                  scrolled ? 'text-navy' : 'text-white'
                }`}
              >
                Nzila Ventures
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-4 2xl:gap-6">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative rounded-sm py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70] ${
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
              className="inline-flex min-h-11 items-center rounded-xl bg-[#dfbe70] px-4 py-2.5 text-sm font-bold text-[#101a2c] transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70]"
            >
              {t('requestDemo')}
            </TrackedLink>
            {/* App-switcher divider */}
            {appLinks.length > 0 && <div className="w-px h-6 bg-gray-200" />}
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
            {appLinks.length > 0 && <div className="w-px h-6 bg-gray-200" />}
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
          <div className="xl:hidden flex items-center">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dfbe70] ${
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
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-gray-100 bg-white/98 shadow-2xl backdrop-blur-xl xl:hidden md:max-h-[calc(100dvh-5rem)]"
        >
            <div className="space-y-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
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
                className="mt-3 block rounded-xl bg-[#193d7a] px-4 py-3.5 text-center text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193d7a]"
              >
                {t('requestDemo')}
              </TrackedLink>
              {appLinks.length > 0 && <div className="mt-2 border-t border-gray-100 pt-2">
                <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('apps')}</p>
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
              </div>}
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






