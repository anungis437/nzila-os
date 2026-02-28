import Link from "next/link";

const footerSections = [
  {
    title: "Platform",
    links: [
      { label: "Supply Chain", href: "/platform" },
      { label: "Crop Planning", href: "/platform" },
      { label: "IoT Integration", href: "/platform" },
      { label: "Market Intelligence", href: "/platform" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/resources" },
      { label: "API Reference", href: "/resources" },
      { label: "Changelog", href: "/resources" },
      { label: "System Status", href: "/resources" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Security", href: "/legal/security" },
      { label: "DPA", href: "/legal/dpa" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "NzilaOS Platform", href: "https://nzilaventures.com" },
      { label: "CORA Insights", href: "#" },
      { label: "Trade OS", href: "#" },
      { label: "Union Eyes", href: "https://unioneyes.ca" },
    ],
  },
];

const trustBadges = [
  { label: "PIPEDA Compliant" },
  { label: "B Corp Aligned" },
  { label: "Fair Trade Verified" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      {/* Pre-footer CTA */}
      <div className="bg-navy">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div>
            <h3 className="font-poppins text-lg font-semibold text-white">
              Ready to modernize your supply chain?
            </h3>
            <p className="text-sm text-slate-400">
              Start managing your agricultural operations with intelligence today.
            </p>
          </div>
          <Link
            href="/sign-up"
            className="rounded-lg bg-emerald px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald/90 hover:shadow-lg"
          >
            Get Started Free
          </Link>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald font-poppins text-sm font-bold text-white">
                PO
              </div>
              <span className="font-poppins text-lg font-semibold text-navy">
                PonduOps
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Agricultural supply chain and operations ERP for the DRC and
              Central African corridor. From farm to market with full
              traceability.
            </p>
            <div className="mt-6 flex gap-3">
              {["LinkedIn", "GitHub"].map((label) => (
                <span
                  key={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-500 transition-colors hover:bg-emerald hover:text-white"
                >
                  {label[0]}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-poppins text-sm font-semibold text-navy">
                {section.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-emerald"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-8">
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-500"
            >
              <span className="h-2 w-2 rounded-full bg-emerald" />
              {badge.label}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 text-sm text-slate-400 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Nzila Ventures Inc. All rights reserved.</p>
          <p>Part of the NzilaOS Ecosystem</p>
        </div>
      </div>
    </footer>
  );
}
