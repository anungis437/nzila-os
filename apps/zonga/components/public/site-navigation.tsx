/**
 * SiteNavigation — Scroll-Aware Navbar (Zonga)
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ZongaBrandMark } from '@/components/branding';
import { LanguageSwitcher } from '@/components/language-switcher';

const navLinkKeys = [
  { href: '/', key: 'home' },
  { href: '/about', key: 'about' },
  { href: '/artists', key: 'artists' },
  { href: '/events', key: 'events' },
  { href: '/pricing', key: 'pricing' },
  { href: '/contact', key: 'contact' },
] as const;

export default function SiteNavigation() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ── Close on route change (state-based, avoids effect + ref in render) ── */
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); },
    [],
  );
  useEffect(() => {
    if (mobileOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [mobileOpen, onKeyDown]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100'
            : 'bg-navy/80 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <ZongaBrandMark placement="app_header" size="md" theme={scrolled ? 'light' : 'dark'} />

            <nav className="hidden md:flex items-center gap-1">
              {navLinkKeys.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? scrolled ? 'text-electric' : 'text-white'
                      : scrolled ? 'text-gray-600 hover:text-navy' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {t(link.key)}
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-electric/10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <LanguageSwitcher variant={scrolled ? 'light' : 'dark'} dropDirection="down" />
              </div>
              <Link
                href="/sign-in"
                className={`hidden md:inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold transition-all btn-press ${
                  scrolled
                    ? 'bg-electric text-white hover:bg-blue-700 shadow-md shadow-electric/25'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                {t('signIn')}
              </Link>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden relative w-10 h-10 flex items-center justify-center"
                aria-label="Toggle menu"
              >
                <div className="space-y-1.5">
                  <span className={`block w-6 h-0.5 transition-all duration-300 ${scrolled ? 'bg-navy' : 'bg-white'} ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                  <span className={`block w-6 h-0.5 transition-all duration-300 ${scrolled ? 'bg-navy' : 'bg-white'} ${mobileOpen ? 'opacity-0' : ''}`} />
                  <span className={`block w-6 h-0.5 transition-all duration-300 ${scrolled ? 'bg-navy' : 'bg-white'} ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-80 z-50 bg-white shadow-2xl md:hidden"
            >
              <div className="p-6 pt-20 space-y-2">
                {navLinkKeys.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-electric/10 text-electric'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t(link.key)}
                  </Link>
                ))}
                <hr className="my-4 border-gray-100" />
                <div className="px-4 py-2">
                  <LanguageSwitcher variant="light" dropDirection="down" />
                </div>
                <Link
                  href="/sign-in"
                  className="block w-full px-4 py-3 text-center bg-electric text-white font-semibold rounded-xl shadow-md shadow-electric/25 hover:bg-blue-700 transition-all btn-press"
                >
                  {t('signIn')}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
