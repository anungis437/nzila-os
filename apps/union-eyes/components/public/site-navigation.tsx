/**
 * SiteNavigation — Flagship marketing navigation for UnionEyes
 * ──────────────────────────────────────────────────────────────
 * Fixed navbar with scroll-aware transparency, Framer Motion active
 * indicator, mobile drawer with body-scroll lock, keyboard esc-close,
 * and auto-close on route change.  Aligned with apps/web Navigation.
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitcher from '@/components/language-switcher';

const navigation = [
  { name: 'Home',                href: '/' },
  { name: 'Story',               href: '/story' },
  { name: 'Pricing',             href: '/pricing' },
  { name: 'Trust & Compliance',  href: '/en-CA/trust' },
  { name: 'Case Studies',        href: '/case-studies' },
  { name: 'Contact',             href: '/contact' },
];

const platformLinks = [
  { name: 'Governance & Oversight', href: '/en-CA/trust' },
  { name: 'Case Management',       href: '/features/grievance-tracking' },
  { name: 'Member Portal',         href: '/features/member-portal' },
  { name: 'Intelligence',          href: '/features/ai-workbench' },
  { name: 'Financial Allocation',  href: '/features/analytics' },
];

const roleLinks = [
  { name: 'For Representatives',  href: '/en-CA/for-representatives' },
  { name: 'For Leadership',       href: '/en-CA/for-leadership' },
  { name: 'For Federations',      href: '/en-CA/for-federations' },
  { name: 'For CLC',              href: '/en-CA/for-clc' },
  { name: 'For Members',          href: '/en-CA/for-members' },
];

export default function SiteNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [mobilePlatformOpen, setMobilePlatformOpen] = useState(false);
  const [mobileRolesOpen, setMobileRolesOpen] = useState(false);
  const platformTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rolesTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ── Scroll-aware glass effect ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Close mobile menu on route change ── */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  /* ── Body scroll lock when mobile menu open ── */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  /* ── Keyboard: Escape closes mobile menu ── */
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
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm'
          : 'bg-navy/80 backdrop-blur-md'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/brand/icon.png"
                alt="UnionEyes"
                width={36}
                height={36}
                className="w-9 h-9 rounded-lg shadow-lg shadow-electric/20 group-hover:shadow-electric/40 transition-shadow"
              />
              <span
                className={`text-xl font-bold transition-colors ${
                  scrolled ? 'text-navy' : 'text-white'
                }`}
              >
                UnionEyes
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center space-x-5 whitespace-nowrap">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative py-1 ${
                    isActive
                      ? scrolled
                        ? 'text-electric'
                        : 'text-white'
                      : scrolled
                      ? 'text-gray-600 hover:text-navy'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="ue-nav-indicator"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full"
                    />
                  )}
                </Link>
              );
            })}

            {/* Platform dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(platformTimeout.current); setPlatformOpen(true); }}
              onMouseLeave={() => { platformTimeout.current = setTimeout(() => setPlatformOpen(false), 150); }}
            >
              <button
                className={`text-sm font-medium transition-colors relative py-1 inline-flex items-center gap-1 ${
                  pathname?.startsWith('/features')
                    ? scrolled ? 'text-electric' : 'text-white'
                    : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
                }`}
              >
                  Modules
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${platformOpen ? 'rotate-180' : ''}`} />
                  {pathname?.startsWith('/features') && (
                  <motion.div
                    layoutId="ue-nav-indicator"
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

            {/* Who It's For dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(rolesTimeout.current); setRolesOpen(true); }}
              onMouseLeave={() => { rolesTimeout.current = setTimeout(() => setRolesOpen(false), 150); }}
            >
              <button
                className={`text-sm font-medium transition-colors relative py-1 inline-flex items-center gap-1 ${
                  pathname?.startsWith('/en-CA/for-')
                    ? scrolled ? 'text-electric' : 'text-white'
                    : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
                }`}
              >
                Who It&apos;s For
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rolesOpen ? 'rotate-180' : ''}`} />
                {pathname?.startsWith('/en-CA/for-') && (
                  <motion.div
                    layoutId="ue-nav-roles-indicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full"
                  />
                )}
              </button>
              <AnimatePresence>
                {rolesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                  >
                    {roleLinks.map((link) => (
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

            <div className="w-px h-6 bg-gray-300/30" />

            <LanguageSwitcher />

            <Link
              href="/pilot-request"
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25 btn-press"
            >
              Request a Demo
            </Link>

            <Link
              href="/sign-in"
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                scrolled
                  ? 'text-gray-600 hover:text-navy'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                scrolled ? 'text-gray-700' : 'text-white'
              }`}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-black/30 backdrop-blur-sm xl:hidden z-40"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />

            {/* Drawer */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="xl:hidden bg-white border-t border-gray-100 shadow-2xl relative z-50"
            >
              <div className="px-4 pt-3 pb-5 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/' && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-electric/10 text-electric'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* Platform section (mobile) */}
                <button
                  onClick={() => setMobilePlatformOpen(!mobilePlatformOpen)}
                  className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    pathname?.startsWith('/features')
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
                        onClick={() => setMobileMenuOpen(false)}
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

                {/* Who It's For (mobile) */}
                <button
                  onClick={() => setMobileRolesOpen(!mobileRolesOpen)}
                  className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    pathname?.startsWith('/en-CA/for-')
                      ? 'bg-electric/10 text-electric'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Who It&apos;s For
                  <ChevronDown className={`h-4 w-4 transition-transform ${mobileRolesOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileRolesOpen && (
                  <div className="pl-4 space-y-1">
                    {roleLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
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

                <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
                  <Link
                    href="/pilot-request"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 bg-electric text-white rounded-xl text-base font-semibold text-center shadow-lg shadow-electric/25"
                  >
                    Request a Demo
                  </Link>
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-base font-medium text-gray-600 hover:text-navy transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
