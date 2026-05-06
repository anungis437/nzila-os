/**
 * TrustCore — Onboarding Layout
 *
 * Full-screen, sidebar-free layout for the onboarding wizard.
 */

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-start justify-center py-12 px-4">
      {children}
    </div>
  )
}
