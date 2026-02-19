'use client';

import Link from 'next/link';
import TechStackBar from './TechStackBar';

const footerLinks = {
  Company: [
    { name: 'About Us', href: '/about' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Verticals', href: '/verticals' },
    { name: 'Platform', href: '/platform' },
    { name: 'Contact', href: '/contact' },
  ],
  Investors: [
    { name: 'Investment Thesis', href: '/investors' },
    { name: 'Products', href: '/products' },
    { name: 'Resources', href: '/resources' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'IP Governance', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-navy text-gray-300">
      {/* Tech Stack */}
      <div className="border-b border-white/10 py-10">
        <TechStackBar label="Powered By" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-electric to-violet flex items-center justify-center">
                <span className="text-white font-bold text-sm">NV</span>
              </div>
              <span className="text-2xl font-bold text-white">Nzila Ventures</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-sm">
              The APEX of AI — a venture studio building ethical, human-centered 
              technology across 10+ verticals and 15 platforms.
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gold/20 text-gold">
                Series A Ready
              </span>
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald/20 text-emerald">
                $100B+ TAM
              </span>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Nzila Ventures. All rights reserved.
          </p>
          <p className="text-sm text-gray-500">
            Built with intentionality, ethics, and impact.
          </p>
        </div>
      </div>
    </footer>
  );
}
