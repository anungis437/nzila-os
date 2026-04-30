'use client';

/**
 * LocaleSiteNavigation — Locale-aware marketing navigation for UnionEyes
 * Used inside app/[locale]/(marketing)/ where NextIntlClientProvider is active.
 * Translates nav labels and uses locale-prefixed hrefs.
 */

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/language-switcher';

export default function LocaleSiteNavigation() {
  const t = useTranslations('marketing.nav');
  const tf = useTranslations('marketing.footer');
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'en-CA';

  const navigation = [
    { name: t('story'),   href: `/${locale}/story` },
    { name: t('pricing'), href: `/${locale}/pricing` },
    { name: t('contact'), href: `/${locale}/contact` },
  ];

  const platformLinks = [
    { name: 'Inbox',        href: `/${locale}/features/inbox` },
    { name: 'Priorities',   href: `/${locale}/features/priorities` },
    { name: 'Work',         href: `/${locale}/features/grievance-tracking` },
    { name: 'Intelligence', href: `/${locale}/features/ai-workbench` },
    { name: 'Outcomes',     href: `/${locale}/features/analytics` },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [mobilePlatformOpen, setMobilePlatformOpen] = useState(false);
  const platformTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [mobileMenuOpen, handleKeyDown]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm' : 'bg-navy/80 backdrop-blur-md'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <Image
                src="/images/brand/icon.png"
                alt="UnionEyes"
                width={36}
                height={36}
                className="w-9 h-9 rounded-lg bg-white/95 p-1 shadow-lg shadow-electric/20 ring-1 ring-white/60 group-hover:shadow-electric/40 transition-shadow"
              />
              <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-navy' : 'text-white'}`}>
                UnionEyes
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center space-x-5 whitespace-nowrap">
            {navigation.slice(0, 1).map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative py-1 ${
                    isActive
                      ? scrolled ? 'text-electric' : 'text-white'
                      : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="ue-locale-nav-indicator"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full"
                    />
                  )}
                </Link>
              );
            })}

            {/* Modules dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(platformTimeout.current); setPlatformOpen(true); }}
              onMouseLeave={() => { platformTimeout.current = setTimeout(() => setPlatformOpen(false), 150); }}
            >
              <button
                className={`text-sm font-medium transition-colors relative py-1 inline-flex items-center gap-1 ${
                  pathname?.startsWith(`/${locale}/features`) || pathname?.startsWith(`/${locale}/trust`)
                    ? scrolled ? 'text-electric' : 'text-white'
                    : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
                }`}
              >
                Modules
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${platformOpen ? 'rotate-180' : ''}`} />
                {(pathname?.startsWith(`/${locale}/features`) || pathname?.startsWith(`/${locale}/trust`)) && (
                  <motion.div
                    layoutId="ue-locale-nav-indicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full"
                  />
                )}
              </button>
              <AnimatePresence>
                {platformOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                  >
                    {platformLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2.5 text-sm truncate transition-colors ${
                          pathname === link.href
                            ? 'text-electric bg-electric/5 font-medium'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-navy'
                        }`}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navigation.slice(1).map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative py-1 ${
                    isActive
                      ? scrolled ? 'text-electric' : 'text-white'
                      : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="ue-locale-nav-indicator"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full"
                    />
                  )}
                </Link>
              );
            })}

            <div className="w-px h-6 bg-gray-300/30" />

            <LanguageSwitcher />

            <Link
              href={`/${locale}/pilot-request`}
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25 btn-press"
            >
              Request a Demo
            </Link>

            <Link
              href="/sign-in"
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
              }`}
            >
              <LogIn className="h-4 w-4" />
              {t('signIn')}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-700' : 'text-white'}`}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden bg-white border-t border-gray-100 shadow-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {navigation.slice(0, 1).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-navy rounded-lg transition-colors"
                >
                  {item.name}
                </Link>
              ))}

              {/* Modules section (mobile) */}
              <button
                onClick={() => setMobilePlatformOpen(!mobilePlatformOpen)}
                className={`flex w-full items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith(`/${locale}/features`) || pathname?.startsWith(`/${locale}/trust`)
                    ? 'bg-electric/10 text-electric'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Modules
                <ChevronDown className={`h-4 w-4 transition-transform ${mobilePlatformOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobilePlatformOpen && (
                <div className="pl-4 space-y-1">
                  {platformLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block px-4 py-2.5 rounded-lg text-sm transition-colors ${
                        pathname === link.href
                          ? 'text-electric bg-electric/5 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}

              {navigation.slice(1).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-navy rounded-lg transition-colors"
                >
                  {item.name}
                </Link>
              ))}

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="block w-full text-center px-4 py-3 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  {t('requestPilot')}
                </Link>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:text-navy"
                >
                  <LogIn className="h-4 w-4" />
                  {t('signIn')}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
