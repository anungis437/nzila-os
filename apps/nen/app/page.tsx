import Link from 'next/link'
const copy = {
  en: {
    nav: 'Nzila Economic Network', tag: 'BLACK ENTERPRISE · CANADA · AFRICA · DIASPORA',
    title: 'Black business. Built to last.',
    intro: 'Find our businesses. Win bigger contracts. Build the wealth we keep.',
    work: 'Enter your business workspace', discover: 'Find Black enterprises',
    journeys: [['Discover', 'Find businesses and partners across the diaspora.'], ['Win', 'Source opportunities. Build stronger bids together.'], ['Own', 'Grow capital, acquire businesses and pass ownership forward.']],
    status: 'Private research release · Real company data is not enabled', french: 'Français',
  },
  fr: {
    nav: 'Réseau économique Nzila', tag: 'ENTREPRISES NOIRES · CANADA · AFRIQUE · DIASPORA',
    title: 'Nos entreprises. Notre avenir.',
    intro: 'Découvrir nos entreprises. Remporter de plus grands contrats. Bâtir un patrimoine durable.',
    work: 'Accéder à mon espace entreprise', discover: 'Découvrir les entreprises noires',
    journeys: [['Découvrir', 'Trouver des entreprises et des partenaires dans la diaspora.'], ['Gagner', 'Découvrir des occasions et répondre ensemble aux appels d’offres.'], ['Transmettre', 'Faire croître le capital, acquérir des entreprises et préparer la relève.']],
    status: 'Version de recherche privée · Aucune donnée réelle d’entreprise', french: 'English',
  },
} as const
export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = (await searchParams).lang === 'fr' ? 'fr' : 'en'
  const c = copy[lang]
  return <main lang={lang}>
    <header className="topline"><span className="wordmark">NZILA <span>ECONOMIC NETWORK</span></span><nav><Link href={lang === 'en' ? '/?lang=fr' : '/?lang=en'}>{c.french}</Link><Link href={`/sign-in?lang=${lang}`}>{lang === 'fr' ? 'Connexion' : 'Sign in'}</Link></nav></header>
    <section className="hero"><p className="eyebrow">{c.tag}</p><h1>{c.title}</h1><p className="intro">{c.intro}</p><div className="actions"><Link className="primary" href={`/workbench?lang=${lang}`}>{c.work}</Link><a className="secondary" href="#journeys">{c.discover}</a></div></section>
    <section id="journeys" className="journeys" aria-label="Network opportunities">{c.journeys.map((j, i)=><article key={i}><span className="number">0{i+1}</span><h2>{j[0]}</h2><p>{j[1]}</p></article>)}</section>
    <footer>{c.status}</footer>
  </main>
}
