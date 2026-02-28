import Link from "next/link";

const footerLinks = {
  Commerce: [
    { href: "#features", label: "Vehicle Trading" },
    { href: "#features", label: "Spare Parts" },
    { href: "#features", label: "Inventory Management" },
    { href: "#features", label: "Deal Pipeline" },
  ],
  Resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/api", label: "API Reference" },
    { href: "/blog", label: "Trade Insights" },
    { href: "/changelog", label: "Changelog" },
  ],
  Company: [
    { href: "https://nzilaventures.com", label: "Nzila Ventures" },
    { href: "https://nzilaventures.com/products", label: "All Products" },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/security", label: "Security" },
    { href: "/compliance", label: "Compliance" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-navy">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 font-poppins text-sm font-bold text-white">
                TO
              </div>
              <span className="font-poppins text-lg font-bold text-white">
                Trade<span className="text-amber-400">Ops</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Automotive commerce and trade management platform for the DRC and
              Central African markets. Vehicle trading, spare parts logistics,
              and deal lifecycle management.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["OHADA Compliant", "ISO 27001", "B Corp"].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-poppins text-sm font-semibold text-white">
                {title}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-amber-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Nzila Ventures. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            All Systems Operational
          </div>
        </div>
      </div>
    </footer>
  );
}
