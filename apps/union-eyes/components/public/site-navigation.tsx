/**
 * SiteNavigation — Premium marketing navigation for Union Eyes
 * ──────────────────────────────────────────────────────────────
 * Fixed navbar with scroll-aware transparency, Framer Motion active
 * indicator, and mobile drawer. Aligned with apps/web Navigation design.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitcher from '@/components/language-switcher';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Story', href: '/story' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Case Studies', href: '/case-studies' },
  { name: 'Contact', href: '/contact' },
];

export default function SiteNavigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm'
          : 'bg-navy/80 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center shadow-lg shadow-electric/20">
                <span className="text-white font-bold text-sm">UE</span>
              </div>
              <span
                className={`text-xl font-bold transition-colors ${
                  scrolled ? 'text-navy' : 'text-white'
                }`}
              >
                Union Eyes
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative ${
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
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-electric rounded-full"
                    />
                  )}
                </Link>
              );
            })}

            <div className="w-px h-6 bg-gray-300/30" />

            <LanguageSwitcher />

            <Link
              href="/pilot-request"
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25 btn-press"
            >
              Request Pilot
            </Link>

            <Link
              href="/sign-in"
              className={`text-sm font-medium transition-colors ${
                scrolled
                  ? 'text-gray-600 hover:text-navy'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Sign In
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${
                scrolled ? 'text-gray-700' : 'text-white'
              }`}
              aria-label="Toggle navigation menu"
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
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-base font-medium ${
                      isActive
                        ? 'bg-electric/10 text-electric'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <Link
                href="/pilot-request"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 bg-electric text-white rounded-xl text-base font-semibold text-center mt-2"
              >
                Request Pilot
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-base font-medium text-gray-600 text-center"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
