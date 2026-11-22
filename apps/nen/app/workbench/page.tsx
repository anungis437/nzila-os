import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
export const dynamic = 'force-dynamic'
export default async function Workbench({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === 'fr' ? 'fr' : 'en'
  const { userId, orgId } = await auth()
  if (!userId) redirect(`/sign-in?lang=${lang}`)
  // Session alone cannot grant tenant-specific NEN data access. Zero customer data is loaded.
  const fr = lang === 'fr'
  return <main lang={lang} className="workbench"><header className="topline"><Link className="wordmark" href={`/?lang=${lang}`}>NZILA <span>ECONOMIC NETWORK</span></Link></header>
    <section className="hero small"><p className="eyebrow">{fr?'ESPACE ENTREPRISE':'BUSINESS WORKSPACE'}</p><h1>{fr?'Bâtissons ensemble.':'Build together.'}</h1><p className="intro">{orgId ? (fr?'Organisation active reconnue. Les données commerciales seront activées après validation des autorisations NEN.':'Organization selected. Commercial records will open after NEN mandate validation.') : (fr?'Choisissez une organisation autorisée pour continuer.':'Select an authorized organization to continue.')}</p></section>
    <section className="journeys"><article><h2>{fr?'Identité':'Business Passport'}</h2><p>{fr?'Identité commerciale et droits de partage.':'Portable business identity and sharing rights.'}</p></article><article><h2>{fr?'Contrats':'Deal Room'}</h2><p>{fr?'Appels d’offres et partenariats.':'Sourcing and collaborative bids.'}</p></article><article><h2>{fr?'Propriété':'Ownership'}</h2><p>{fr?'Croissance, acquisitions et relève.':'Growth, acquisitions and succession.'}</p></article></section><footer>{fr?'Accès aux données réelles : en attente de certification.':'Real-data access: pending certification.'}</footer>
  </main>
}
