'use client';

/**
 * LocaleSiteNavigation — Locale-aware marketing navigation for Union Eyes
 * Used inside app/[locale]/(marketing)/ where NextIntlClientProvider is active.
 * Translates nav labels and uses locale-prefixed hrefs.
 */

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/language-switcher';

export default function LocaleSiteNavigation() {
  const t = useTranslations('marketing.nav');
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'en-CA';

  const navigation = [
    { name: t('home'),        href: `/${locale}` },
    { name: t('story'),       href: `/${locale}/story` },
    { name: t('pricing'),     href: `/${locale}/pricing` },
    { name: t('caseStudies'), href: `/${locale}/case-studies` },
    { name: t('status'),      href: `/${locale}/status` },
    { name: t('contact'),     href: `/${locale}/contact` },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center shadow-lg shadow-electric/20 group-hover:shadow-electric/40 transition-shadow">
                <span className="text-white font-bold text-sm">UE</span>
              </div>
              <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-navy' : 'text-white'}`}>
                Union Eyes
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== `/${locale}` && pathname?.startsWith(item.href));
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
              {t('requestPilot')}
            </Link>

            <Link
              href="/sign-in"
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
              }`}
            >
              <LogIn className="h-4 w-4" />
              {t('signIn')}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-3">
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
            className="lg:hidden bg-white border-t border-gray-100 shadow-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {navigation.map((item) => (
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
