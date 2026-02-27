import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Contact Us",
    description: "For firms onboarding their first VCFO clients.",
    features: [
      "Up to 10 client entities",
      "AI-powered financial reports",
      "Document management",
      "Tax deadline tracking",
      "Client portal access",
      "Email support",
    ],
    cta: "Get Started",
    href: "/contact",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "Contact Us",
    description:
      "For growing advisory practices scaling their VCFO services.",
    features: [
      "Unlimited client entities",
      "AI-powered financial reports",
      "Document management with blob storage",
      "Full tax compliance engine",
      "QuickBooks Online integration",
      "Workflow automation",
      "Team collaboration & RBAC",
      "CSV bulk import",
      "Report export (PDF & CSV)",
      "Priority support",
    ],
    cta: "Book a Demo",
    href: "/contact",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description:
      "For multi-office firms and white-label deployments.",
    features: [
      "Everything in Professional",
      "Multi-firm / multi-entity isolation",
      "Custom branding & white-label",
      "Dedicated onboarding",
      "Stripe billing integration",
      "Advanced AI advisory insights",
      "SLA & dedicated support",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    href: "/contact",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="bg-white pt-24">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="font-poppins text-4xl font-bold tracking-tight text-navy sm:text-5xl">
          Plans & Pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
          Transparent pricing that grows with your practice. Every plan includes
          the AI-powered tools your firm needs to deliver exceptional virtual CFO
          services.
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 shadow-sm transition-shadow hover:shadow-md ${
                plan.highlighted
                  ? "border-electric ring-2 ring-electric/20"
                  : "border-slate-200"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-electric px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <div>
                <h3 className="font-poppins text-xl font-semibold text-navy">
                  {plan.name}
                </h3>
                <div className="mt-3 font-poppins text-3xl font-bold text-navy">
                  {plan.price}
                </div>
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-electric" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-lg px-6 py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-electric text-white hover:bg-electric/90"
                    : "border border-slate-200 text-navy hover:bg-slate-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ preview */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-poppins text-2xl font-bold text-navy">
            Questions?
          </h2>
          <p className="mt-3 text-slate-500">
            We&apos;re happy to walk you through a live demo tailored to your
            firm&apos;s needs. All plans include a free onboarding session.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-lg bg-navy px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
          >
            Book a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
