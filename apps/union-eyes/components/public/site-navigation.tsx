/**
 * SiteNavigation — Enterprise institutional navigation for UnionEyes
 * ──────────────────────────────────────────────────────────────────
 * Fixed navbar with scroll-aware transparency, Framer Motion active
 * indicator, mobile drawer with body-scroll lock, keyboard esc-close,
 * and auto-close on route change.
 *
 * Enterprise IA:
 *   Solutions | Platform | Governance & Trust | Insights | Pilot Program | Contact
 */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, LogIn, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** Primary navigation items (non-dropdown) */
const primaryNav = [
  { name: 'Insights', href: '/insights' },
  { name: 'Pricing',  href: '/pricing' },
  { name: 'Contact',  href: '/contact' },
];

/** Solutions dropdown — stakeholder-oriented journeys */
const solutionsLinks = [
  { name: 'Union Executive Leadership',  href: '/solutions/executive-leadership',   desc: 'Strategic continuity' },
  { name: 'Governance Leadership',       href: '/solutions/governance-leadership',  desc: 'Governance modernization' },
  { name: 'Operations Leadership',       href: '/solutions/operations-leadership',  desc: 'Cross-team coordination' },
  { name: 'Technology Leadership',       href: '/solutions/technology-leadership',  desc: 'Enterprise-safe AI' },
  { name: 'Policy & Labour Leadership',  href: '/solutions/labour-leadership',      desc: 'Human oversight' },
  { name: 'Procurement Stakeholders',    href: '/solutions/procurement',            desc: 'Deployment readiness' },
];

const modulesLinks = [
  {
    name: 'Institutional Continuity',
    href: '/institutional-continuity',
    desc: 'Leadership transition resilience',
  },
  {
    name: 'Governance Transparency Hub',
    href: '/platform/governance-intelligence',
    desc: 'Decision traceability and oversight',
  },
  {
    name: 'Organizational Memory Vault',
    href: '/platform/organizational-memory',
    desc: 'Protected organizational knowledge',
  },
  {
    name: 'Executive Briefing Engine',
    href: '/executive-intelligence',
    desc: 'Strategic briefing for leadership',
  },
  {
    name: 'Operations Coherence Layer',
    href: '/platform/operational-coherence',
    desc: 'Cross-team operating alignment',
  },
  {
    name: 'Explainability and Audit Layer',
    href: '/platform/explainable-intelligence',
    desc: 'Transparent and reviewable AI',
  },
];


export default function SiteNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [mobileModulesOpen, setMobileModulesOpen] = useState(false);
  const solutionsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modulesTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isModulesPath =
    pathname?.startsWith('/institutional-continuity') ||
    pathname?.startsWith('/platform/governance-intelligence') ||
    pathname?.startsWith('/platform/organizational-memory') ||
    pathname?.startsWith('/executive-intelligence') ||
    pathname?.startsWith('/platform/operational-coherence') ||
    pathname?.startsWith('/platform/explainable-intelligence');

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

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors relative py-1 inline-flex items-center gap-1 ${
      active
        ? 'text-[#1f5b84]'
        : 'text-slate-600 hover:text-navy'
    }`;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-sm border-b border-slate-200/80' : 'bg-white/96 border-b border-slate-200/60'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* ── Logo ── */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center group rounded-md px-1 py-1">
              <Image
                src="/images/brand/icon.png"
                alt="UnionEyes"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
                priority
              />
              <span className="ml-2 text-base md:text-lg font-bold text-navy leading-none">UnionEyes</span>
            </Link>
          </div>

          {/* ── Desktop Navigation ── */}
          <div className="hidden xl:flex items-center space-x-5 whitespace-nowrap">

            {/* Solutions dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(solutionsTimeout.current); setSolutionsOpen(true); }}
              onMouseLeave={() => { solutionsTimeout.current = setTimeout(() => setSolutionsOpen(false), 150); }}
            >
              <button className={navLinkClass(pathname?.startsWith('/solutions') ?? false)}>
                Solutions
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
                {(pathname?.startsWith('/solutions') ?? false) && (
                  <motion.div layoutId="ue-nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full" />
                )}
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
                      <Link
                        key={link.href}
                        href={link.href}
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

            {/* Modules dropdown */}
            <div
              className="relative"
              onMouseEnter={() => { clearTimeout(modulesTimeout.current); setModulesOpen(true); }}
              onMouseLeave={() => { modulesTimeout.current = setTimeout(() => setModulesOpen(false), 150); }}
            >
              <button className={navLinkClass(Boolean(isModulesPath))}>
                Modules
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${modulesOpen ? 'rotate-180' : ''}`} />
                {Boolean(isModulesPath) && (
                  <motion.div layoutId="ue-nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full" />
                )}
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
                    {modulesLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
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

            {/* Primary nav links */}
            {primaryNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} className={navLinkClass(isActive)}>
                  {item.name}
                  {isActive && (
                    <motion.div layoutId="ue-nav-indicator" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-electric rounded-full" />
                  )}
                </Link>
              );
            })}

            <div className="w-px h-6 bg-gray-300/30" />

            <Link
              href="/pilot-request"
              className="px-5 py-2.5 bg-[#1f5b84] text-white text-sm font-semibold rounded-xl hover:bg-[#12324a] transition-colors btn-press"
            >
              Request a Demo
            </Link>

            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap text-slate-600 hover:text-navy"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg transition-colors text-slate-700"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Navigation ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-black/20 xl:hidden z-40"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="xl:hidden bg-white border-t border-gray-100 shadow-2xl relative z-50"
            >
              <div className="px-4 pt-3 pb-5 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">

                {/* Solutions mobile */}
                <button
                  onClick={() => setMobileSolutionsOpen(!mobileSolutionsOpen)}
                  className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    pathname?.startsWith('/solutions') ? 'bg-electric/10 text-electric' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Solutions
                  <ChevronDown className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileSolutionsOpen && (
                  <div className="pl-4 space-y-1">
                    {solutionsLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-navy transition-colors">
                        <span className="block font-medium leading-tight">{link.name}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Modules mobile */}
                <button
                  onClick={() => setMobileModulesOpen(!mobileModulesOpen)}
                  className={`flex w-full items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    isModulesPath ? 'bg-electric/10 text-electric' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Modules
                  <ChevronDown className={`h-4 w-4 transition-transform ${mobileModulesOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileModulesOpen && (
                  <div className="pl-4 space-y-1">
                    {modulesLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-navy transition-colors">
                        <span className="block font-medium leading-tight">{link.name}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-3">{link.desc}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {primaryNav.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href);
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                        isActive ? 'bg-electric/10 text-electric' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
                  <Link href="/pilot-request" onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 bg-[#1f5b84] text-white rounded-xl text-base font-semibold text-center">
                    Request a Demo
                  </Link>
                  <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-base font-medium text-gray-600 hover:text-navy transition-colors">
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
