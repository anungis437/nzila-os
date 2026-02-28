import Link from "next/link";

const footerLinks = {
  Platform: [
    { href: "#capabilities", label: "Portfolio Overview" },
    { href: "#capabilities", label: "Financial Ops" },
    { href: "#capabilities", label: "AI & ML" },
    { href: "#capabilities", label: "Metrics" },
  ],
  Internal: [
    { href: "/docs", label: "Runbooks" },
    { href: "/api", label: "API Reference" },
    { href: "/changelog", label: "Changelog" },
    { href: "/status", label: "System Status" },
  ],
  Company: [
    { href: "https://nzilaventures.com", label: "Nzila Ventures" },
    { href: "https://nzilaventures.com/products", label: "All Products" },
    { href: "/security", label: "Security" },
    { href: "/contact", label: "Contact" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-navy">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 font-poppins text-sm font-bold text-white">
                NC
              </div>
              <span className="font-poppins text-lg font-bold text-white">
                Nzila<span className="text-slate-400">Console</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Internal operations dashboard for the Nzila Ventures portfolio.
              Portfolio management, financial operations, AI/ML tooling, and
              platform metrics.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Internal", "SSO", "Audit Log"].map((badge) => (
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
                      className="text-sm text-slate-400 transition-colors hover:text-slate-300"
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
            &copy; {new Date().getFullYear()} Nzila Ventures — Internal Use
            Only
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            All Systems Operational
          </div>
        </div>
      </div>
    </footer>
  );
}
