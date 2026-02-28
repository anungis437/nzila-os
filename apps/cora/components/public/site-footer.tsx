import Link from "next/link";

const footerLinks = {
  Platform: [
    { href: "#features", label: "Analytics Dashboard" },
    { href: "#features", label: "Yield Forecasting" },
    { href: "#features", label: "Regional Benchmarks" },
    { href: "#features", label: "Climate Modeling" },
  ],
  Resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/api", label: "API Reference" },
    { href: "/blog", label: "Insights Blog" },
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 font-poppins text-sm font-bold text-white">
                CO
              </div>
              <span className="font-poppins text-lg font-bold text-white">
                CORA<span className="text-cyan-400">Insights</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Data-driven agricultural analytics platform. Yield forecasting,
              climate modeling, and market intelligence for the DRC and Central
              African corridor.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["ISO 27001", "SOC 2", "B Corp"].map((badge) => (
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
                      className="text-sm text-slate-400 transition-colors hover:text-cyan-400"
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            All Systems Operational
          </div>
        </div>
      </div>
    </footer>
  );
}
