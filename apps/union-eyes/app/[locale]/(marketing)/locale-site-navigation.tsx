'use client';

/**
 * LocaleSiteNavigation — Enterprise institutional navigation for UnionEyes (locale-aware)
 * Used inside app/[locale]/(marketing)/ where NextIntlClientProvider is active.
 *
 * Institutional IA (Phase 4 alignment — institutional infrastructure with operational modules):
 *   Solutions | Platform | Trust | Insights | Proof | Pricing | Contact
 *
 * Trust is a top-level institutional pillar (audit, sovereignty, explainability) and
 * intentionally surfaced alongside Platform rather than nested inside it, signalling
 * that institutional trust is a first-class concern — not a sub-module.
 */

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/language-switcher';
import { parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';

export default function LocaleSiteNavigation() {
  const t = useTranslations('marketing.nav');
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en-CA';
  const contextMode = parseInstitutionalMode(searchParams.get('context') ?? undefined);
  const pilotRequestHref = withInstitutionalContext(`/${locale}/pilot-request`, contextMode);

  const solutionsLinks = [
    { name: t('solutionsItems.executive.name'), href: `/${locale}/solutions/executive-leadership`,  desc: t('solutionsItems.executive.desc') },
    { name: t('solutionsItems.governance.name'), href: `/${locale}/solutions/governance-leadership`, desc: t('solutionsItems.governance.desc') },
    { name: t('solutionsItems.operations.name'), href: `/${locale}/solutions/operations-leadership`, desc: t('solutionsItems.operations.desc') },
    { name: t('solutionsItems.technology.name'), href: `/${locale}/solutions/technology-leadership`, desc: t('solutionsItems.technology.desc') },
    { name: t('solutionsItems.labour.name'), href: `/${locale}/solutions/labour-leadership`, desc: t('solutionsItems.labour.desc') },
    { name: t('solutionsItems.procurement.name'), href: `/${locale}/solutions/procurement`, desc: t('solutionsItems.procurement.desc') },
  ];

  // Canonical 8-pillar institutional spine (Phase 4 nav IA).
  // All entries deep-link into the single /platform overview page; sub-pages
  // will land in Wave 3 alongside the runtime module rename. Labels & descriptions
  // are i18n-driven via marketing.nav.platformItems for full locale parity.
  const platformHref = `/${locale}/platform`;
  const platformLinks = [
    { name: t('platformItems.inbox.name'),        href: `${platformHref}#inbox`,                desc: t('platformItems.inbox.desc') },
    { name: t('platformItems.work.name'),         href: `${platformHref}#work`,                 desc: t('platformItems.work.desc') },
    { name: t('platformItems.priorities.name'),   href: `${platformHref}#priorities`,           desc: t('platformItems.priorities.desc') },
    { name: t('platformItems.intelligence.name'), href: `${platformHref}#intelligence`,         desc: t('platformItems.intelligence.desc') },
    { name: t('platformItems.cognition.name'),    href: `${platformHref}#cognition`,            desc: t('platformItems.cognition.desc') },
    { name: t('platformItems.governance.name'),   href: `${platformHref}#governance`,           desc: t('platformItems.governance.desc') },
    { name: t('platformItems.memory.name'),       href: `${platformHref}#institutional-memory`, desc: t('platformItems.memory.desc') },
    { name: t('platformItems.trust.name'),        href: `${platformHref}#trust`,                desc: t('platformItems.trust.desc') },
  ];

  const primaryNav = [
    { name: t('trust'),    href: `/${locale}/trust` },
    { name: t('insights'), href: `/${locale}/insights` },
    { name: t('proof'),    href: `/${locale}/proof` },
    { name: t('pricing'),  href: `/${locale}/pricing` },
    { name: t('contact'),  href: `/${locale}/contact` },
  ];

  const [mobileMenuOpen, setMobileMenuOpen]           = useState(false);
  const [scrolled, setScrolled]                       = useState(false);
  const [solutionsOpen, setSolutionsOpen]             = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [modulesOpen, setModulesOpen]                 = useState(false);
  const [mobileModulesOpen, setMobileModulesOpen]     = useState(false);
  const solutionsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modulesTimeout   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors relative py-1 inline-flex items-center gap-1 ${
      active
        ? scrolled ? 'text-electric' : 'text-white'
        : scrolled ? 'text-gray-600 hover:text-navy' : 'text-white/80 hover:text-white'
    }`;

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
          {/* ── Logo ── */}
          <div className="flex items-center">
            <Link
              href={`/${locale}`}
              className={`flex items-center group transition-all duration-300 ${
                scrolled
                  ? 'rounded-none px-0 py-0 bg-transparent shadow-none'
                  : 'rounded-md px-2 py-1 bg-white/10 backdrop-blur-md border border-white/15 shadow-sm'
              }`}
            >
              <Image
                src="/images/brand/icon.png"
                alt="UnionEyes"
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
                priority
              />
              <span
                className={`ml-2 text-base md:text-lg font-bold leading-none transition-colors ${
                  scrolled ? 'text-navy' : 'text-white'
                }`}
              >
                UnionEyes
              </span>
            </Link>
          </div>

          {/* ── Desktop Navigation ── */}
          <div className="hidden xl:flex items-center space-x-5 whitespace-nowrap">

            {/* Solutions */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(solutionsTimeout.current); setSolutionsOpen(true); }}
              onMouseLeave={() => { solutionsTimeout.current = setTimeout(() => setSolutionsOpen(false), 150); }}
            >
              <button className={navLinkClass(pathname?.startsWith(`/${locale}/solutions`) ?? false)}>
                {t('solutions')}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {solutionsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50"
                  >
                    {solutionsLinks.map((link) => (
                      <Link key={link.href} href={link.href}
                        className={`block px-4 py-3 rounded-lg text-sm transition-colors ${
                          pathname === link.href || pathname?.startsWith(link.href)
                            ? 'text-electric bg-electric/5 font-medium'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-navy'
                        }`}
                      >
                        <span className="block font-medium leading-tight">{link.name}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Platform (8-pillar institutional spine) */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(modulesTimeout.current); setModulesOpen(true); }}
              onMouseLeave={() => { modulesTimeout.current = setTimeout(() => setModulesOpen(false), 150); }}
            >
              <button className={navLinkClass(pathname?.startsWith(`/${locale}/platform`) ?? false)}>
                {t('platform')}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${modulesOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {modulesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50"
                  >
                    {platformLinks.map((link) => (
                      <Link key={link.href} href={link.href}
                        className="block px-4 py-3 rounded-lg text-sm transition-colors text-gray-700 hover:bg-gray-50 hover:text-navy"
                      >
                        <span className="block font-medium leading-tight">{link.name}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Primary nav */}
            {primaryNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} className={navLinkClass(isActive)}>
                  {item.name}
                  {isActive && (
                    <motion.div layoutId="ue-locale-nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full" />
                  )}
                </Link>
              );
            })}

            <div className="w-px h-6 bg-gray-300/30" />

            <LanguageSwitcher />

            <a
              href={pilotRequestHref}
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25 btn-press"
            >
              {t('requestPilot')}
            </a>

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

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden bg-white border-t border-gray-100 shadow-xl"
          >
            <div className="px-4 py-4 space-y-1">

              {/* Solutions mobile */}
              <button
                onClick={() => setMobileSolutionsOpen(!mobileSolutionsOpen)}
                className={`flex w-full items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith(`/${locale}/solutions`) ? 'bg-electric/10 text-electric' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('solutions')}
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileSolutionsOpen && (
                <div className="pl-4 space-y-1">
                  {solutionsLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="block px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <span className="block font-medium leading-tight">{link.name}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Platform mobile */}
              <button
                onClick={() => setMobileModulesOpen(!mobileModulesOpen)}
                className={`flex w-full items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith(`/${locale}/platform`) ? 'bg-electric/10 text-electric' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('platform')}
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileModulesOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileModulesOpen && (
                <div className="pl-4 space-y-1">
                  {platformLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="block px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <span className="block font-medium leading-tight">{link.name}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                    </Link>
                  ))}
                </div>
              )}

              {primaryNav.map((item) => (
                <Link key={item.name} href={item.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-navy rounded-lg transition-colors">
                  {item.name}
                </Link>
              ))}

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <a href={pilotRequestHref}
                  className="block w-full text-center px-4 py-3 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                  {t('requestPilot')}
                </a>
                <Link href="/sign-in"
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:text-navy">
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
