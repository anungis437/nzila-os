/**
 * Client-Facing Proposal Presentation
 *
 * Public page showing 3 tiered proposals (Canva-inspired visual layout).
 * For $5000+ mandates, premium tier includes visual mockup badge.
 * 
 * Route: /proposal/[token]
 * No authentication required — accessed via secure token.
 */
import { getOrgBranding, getOrgSettings } from '@nzila/platform-commerce-org/service'
import type { OrgCommerceSettings } from '@nzila/platform-commerce-org/types'

// ── Demo proposal data (will be replaced with DB lookup) ───────────────────

interface ProposalOption {
  tier: 'BUDGET' | 'STANDARD' | 'PREMIUM'
  label: string
  tagline: string
  lines: Array<{
    name: string
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  gst: number
  qst: number
  total: number
  includesVisualMockup: boolean
  features: string[]
}

function makeFmt(settings: OrgCommerceSettings) {
  return (n: number) =>
    new Intl.NumberFormat(settings.locale, {
      style: 'currency',
      currency: settings.currency,
    }).format(n)
}

// Demo data generator for the 3 proposals
function getDemoProposals(): ProposalOption[] {
  return [
    {
      tier: 'BUDGET',
      label: 'Essentiel',
      tagline: 'L\'efficacité à prix accessible',
      lines: [
        { name: 'Interior Directional Sign', description: 'Signalisation intérieure', quantity: 8, unitPrice: 150, lineTotal: 1200 },
        { name: 'Wall Bracket Kit', description: 'Kit de support mural', quantity: 4, unitPrice: 35, lineTotal: 140 },
      ],
      subtotal: 1340,
      gst: 67,
      qst: 133.72,
      total: 1540.72,
      includesVisualMockup: false,
      features: [
        'Produits standards en stock',
        'Délai de livraison: 5-7 jours',
        'Installation non incluse',
        'Garantie fabricant standard',
      ],
    },
    {
      tier: 'STANDARD',
      label: 'Professionnel',
      tagline: 'Le meilleur rapport qualité-prix',
      lines: [
        { name: 'Large Exterior Sign', description: 'Enseigne extérieure grand format', quantity: 2, unitPrice: 1200, lineTotal: 2400 },
        { name: 'Heavy-Duty Shelving Unit', description: 'Étagère robuste industrielle', quantity: 4, unitPrice: 450, lineTotal: 1800 },
        { name: 'Ergonomic Chair', description: 'Chaise ergonomique premium', quantity: 3, unitPrice: 850, lineTotal: 2550 },
      ],
      subtotal: 6750,
      gst: 337.50,
      qst: 673.31,
      total: 7760.81,
      includesVisualMockup: true,
      features: [
        'Mélange de gammes optimisé',
        'Délai de livraison: 3-5 jours',
        'Installation disponible',
        'Service après-vente dédié',
        'Montage visuel du projet',
      ],
    },
    {
      tier: 'PREMIUM',
      label: 'Prestige',
      tagline: 'L\'excellence pour vos projets d\'envergure',
      lines: [
        { name: 'Executive Desk', description: 'Bureau exécutif haut de gamme', quantity: 2, unitPrice: 2200, lineTotal: 4400 },
        { name: 'Ergonomic Chair', description: 'Chaise ergonomique premium', quantity: 4, unitPrice: 850, lineTotal: 3400 },
        { name: 'Industrial Drill Press', description: 'Perceuse industrielle précision', quantity: 1, unitPrice: 4500, lineTotal: 4500 },
      ],
      subtotal: 12300,
      gst: 615,
      qst: 1226.93,
      total: 14141.93,
      includesVisualMockup: true,
      features: [
        'Produits de gamme supérieure',
        'Délai de livraison prioritaire: 2-3 jours',
        'Installation et mise en service incluses',
        'Gestionnaire de compte dédié',
        'Montage visuel + rendu 3D',
        'Garantie étendue 3 ans',
      ],
    },
  ]
}

function getExpirationDate() {
  return new Date(Date.now() + 30 * 86400000).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
}

const tierColors = {
  BUDGET: {
    gradient: 'from-gray-50 to-white',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    accent: 'text-gray-600',
    button: 'bg-gray-800 hover:bg-gray-700 text-white',
    headerBg: 'bg-gray-50',
  },
  STANDARD: {
    gradient: 'from-blue-50 to-white',
    border: 'border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    headerBg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
  },
  PREMIUM: {
    gradient: 'from-amber-50 to-white',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    headerBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
  },
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: _token } = await params

  // For demo: use hardcoded proposals. In production, look up proposals by token.
  const proposals = getDemoProposals()

  // Try to load org branding (fallback to defaults for demo)
  let branding: { logoInitials: string; displayName: string } = { logoInitials: 'SM', displayName: 'ShopMoiCa' }
  let settings: OrgCommerceSettings | null = null
  try {
    const b = await getOrgBranding('11111111-1111-1111-1111-111111111111')
    branding = { logoInitials: b.logoInitials ?? 'SM', displayName: b.displayName }
    settings = await getOrgSettings('11111111-1111-1111-1111-111111111111')
  } catch {
    // Use defaults
  }

  const fmt = settings
    ? makeFmt(settings)
    : (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)

  const expirationDate = getExpirationDate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">{branding.logoInitials}</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg">{branding.displayName}</span>
              <p className="text-xs text-gray-500">Proposition commerciale</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Réf: PROP-2026-001</p>
            <p className="text-xs text-gray-400">
              Valide jusqu&apos;au {expirationDate}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Votre proposition sur mesure
          </h1>
          <p className="text-gray-600 leading-relaxed">
            Nous avons préparé 3 options adaptées à vos besoins. Chaque proposition
            respecte vos critères de budget, volume et qualité.
          </p>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Préparé pour
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Entreprise</p>
              <p className="font-medium text-gray-900">Constructions ABC Inc.</p>
            </div>
            <div>
              <p className="text-gray-500">Contact</p>
              <p className="font-medium text-gray-900">Jean Tremblay</p>
            </div>
          </div>
        </div>

        {/* 3 Proposals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {proposals.map((proposal) => {
            const colors = tierColors[proposal.tier]
            return (
              <div
                key={proposal.tier}
                className={`bg-gradient-to-b ${colors.gradient} rounded-2xl border-2 ${colors.border} overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow ${
                  proposal.tier === 'STANDARD' ? 'lg:-mt-4 lg:mb-4 ring-2 ring-blue-200' : ''
                }`}
              >
                {/* Ribbon for recommended */}
                {proposal.tier === 'STANDARD' && (
                  <div className="bg-blue-600 text-white text-center py-1.5 text-xs font-bold tracking-wider uppercase">
                    Recommandé
                  </div>
                )}

                {/* Header */}
                <div className={`${colors.headerBg} px-6 py-6 text-center`}>
                  <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${colors.badge} mb-3`}>
                    {proposal.label}
                  </span>
                  <p className="text-sm text-gray-500 mb-4">{proposal.tagline}</p>
                  <p className="text-4xl font-bold text-gray-900">{fmt(proposal.total)}</p>
                  <p className="text-xs text-gray-400 mt-1">TPS + TVQ incluses</p>
                </div>

                {/* Features */}
                <div className="px-6 py-5 border-t border-gray-100 flex-1">
                  <ul className="space-y-2.5">
                    {proposal.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <svg className={`h-4 w-4 ${colors.accent} shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Items Summary */}
                <div className="px-6 py-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Détail des articles
                  </h4>
                  <div className="space-y-2">
                    {proposal.lines.map((line, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <div>
                          <p className="text-gray-800">{line.name}</p>
                          <p className="text-xs text-gray-500">{line.quantity}× @ {fmt(line.unitPrice)}</p>
                        </div>
                        <p className="font-mono text-gray-900">{fmt(line.lineTotal)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Sous-total</span>
                      <span className="font-mono">{fmt(proposal.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>TPS (5%)</span>
                      <span className="font-mono">{fmt(proposal.gst)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>TVQ (9.975%)</span>
                      <span className="font-mono">{fmt(proposal.qst)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100">
                      <span>Total</span>
                      <span className="font-mono">{fmt(proposal.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Visual Mockup Badge */}
                {proposal.includesVisualMockup && (
                  <div className={`mx-6 mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3`}>
                    <div className="rounded-lg bg-amber-100 p-2">
                      <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Montage visuel inclus</p>
                      <p className="text-xs text-amber-600">Visualisez votre projet avant de commander</p>
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="px-6 pb-6">
                  <button
                    className={`w-full px-6 py-3 rounded-xl font-semibold text-sm ${colors.button} transition-colors shadow-sm`}
                  >
                    Choisir cette option
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-gray-500 max-w-xl mx-auto">
          <p>
            Toutes les propositions sont valides 30 jours. Les prix incluent la TPS et la TVQ.
            Pour toute question, contactez-nous à{' '}
            <a href="mailto:ventes@shopmoica.ca" className="text-blue-600 hover:underline">
              ventes@shopmoica.ca
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} {branding.displayName}. Tous droits réservés.</p>
          <p>Propulsé par Nzila OS</p>
        </div>
      </footer>
    </div>
  )
}
