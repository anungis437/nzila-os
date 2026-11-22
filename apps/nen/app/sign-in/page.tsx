import Link from 'next/link'
import { SignIn } from '@nzila/platform-auth/entra/components/sign-in'
export const dynamic = 'force-dynamic'
export default async function Login({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === 'fr' ? 'fr' : 'en'
  return <main lang={lang}><header className="topline"><Link className="wordmark" href={`/?lang=${lang}`}>NZILA <span>ECONOMIC NETWORK</span></Link></header><section className="login"><p className="eyebrow">BLACK ENTERPRISE</p><h1>{lang==='fr'?'Votre espace.':'Your business. Your space.'}</h1><SignIn forceRedirectUrl={`/workbench?lang=${lang}`} /></section></main>
}
