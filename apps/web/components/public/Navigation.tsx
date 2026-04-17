'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Bars3Icon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import TrackedLink from './TrackedLink';

const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001';
const PARTNERS_URL = process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'http://localhost:3004';

const navigation = [
  { name: 'About', href: '/about' },
  { name: 'Platform', href: '/platform' },
  { name: 'Products', href: '/products' },
  { name: 'Verticals', href: '/verticals' },
  { name: 'Investors', href: '/investors' },
  { name: 'Resources', href: '/resources' },
];

const appLinks = [
  { name: 'Console', href: CONSOLE_URL },
  { name: 'Partner Portal', href: PARTNERS_URL },
];

export default function Navigation() {
  const pathname = usePathname();
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
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative ${
                    isActive
                      ? scrolled ? 'text-electric' : 'text-white'
                      : scrolled
                      ? 'text-gray-600 hover:text-navy'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-electric rounded-full"
                    />
                  )}
                </Link>
              );
            })}
            <TrackedLink
              href="/contact"
              eventName="cta_request_demo"
              eventProps={{ source: 'navigation_desktop' }}
              className="px-5 py-2.5 bg-electric text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25"
            >
              Request Demo
            </TrackedLink>
            {/* App-switcher divider */}
            <div className="w-px h-6 bg-gray-200" />
            {appLinks.map((app) => (
              <TrackedLink
                key={app.name}
                href={app.href}
                eventName="app_switch"
                eventProps={{ app: app.name, source: 'navigation_desktop' }}
                external
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  scrolled ? 'text-gray-500 hover:text-navy' : 'text-white/60 hover:text-white'
                }`}
              >
                {app.name}
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </TrackedLink>
            ))}
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
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            id="mobile-navigation-menu"
            className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
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
              <TrackedLink
                href="/contact"
                eventName="cta_request_demo"
                eventProps={{ source: 'navigation_mobile' }}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 bg-electric text-white rounded-xl text-base font-semibold text-center mt-2"
              >
                Request Demo
              </TrackedLink>
              <div className="pt-2 border-t border-gray-100 mt-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Apps</p>
                {appLinks.map((app) => (
                  <TrackedLink
                    key={app.name}
                    href={app.href}
                    eventName="app_switch"
                    eventProps={{ app: app.name, source: 'navigation_mobile' }}
                    external
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {app.name}
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </TrackedLink>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
