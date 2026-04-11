/**
 * Locale-aware Story page
 * Accessible at /{locale}/story — provides the founding narrative.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Heart, Users, Shield, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.story' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LocaleStoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.story' });
  const isFr = locale === 'fr-CA';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full text-sm text-red-700 font-medium mb-6">
            <Heart className="h-4 w-4" />
            <span>{t('badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            {t('heroHeading')}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            {t('heroDescription')}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Origin Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            {isFr ? 'Comment tout a commencé' : 'Where it all began'}
          </h2>
          <div className="prose prose-slate max-w-none">
            {isFr ? (
              <>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Mike a passé des années à l&apos;intérieur — d&apos;abord comme agent de relations
                  de travail pour un syndicat national, puis comme avocat menant des enquêtes
                  et des évaluations en milieu de travail. Passer de travailler <em>dans</em> un
                  syndicat à travailler <em>avec</em> des syndicats lui a donné une vue sans filtre
                  de là où se trouvaient les frictions : les processus, les lacunes, les moments
                  où la bonne information n&apos;était tout simplement pas entre les bonnes mains.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Oby a pris un chemin différent. En tant que directeur des systèmes d&apos;information
                  d&apos;une association sportive nationale et bâtisseur SaaS chevronné, il a fait
                  carrière autour d&apos;une seule idée — que la technologie devrait être humaine.
                  Que les plateformes les plus puissantes sont celles que les gens utilisent
                  vraiment.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Quand leurs chemins se sont croisés, l&apos;opportunité était évidente.
                  Mike savait exactement ce qui était cassé. Oby savait exactement comment
                  le réparer.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed font-semibold">
                  UnionEyes est ce qui s&apos;est passé ensuite.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Mike spent years on the inside — first as a Labour Relations Officer for
                  a national union, then as a lawyer conducting workplace investigations
                  and assessments. Moving from working <em>in</em> a union to working <em>with</em> unions
                  gave him an unfiltered view of where the friction lived: the workflows,
                  the gaps, the moments where the right information simply wasn&apos;t in the
                  right hands.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Oby took a different path. As CIO of a national sporting association
                  and a seasoned SaaS builder, he made a career out of one idea — that
                  technology should feel human. That the most powerful platforms are the
                  ones people actually use.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  When their paths converged, the opportunity was obvious. Mike knew
                  exactly what was broken. Oby knew exactly how to fix it.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed font-semibold">
                  UnionEyes is what happened next.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Mission */}
        <section className="mb-16">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              {isFr ? 'Notre mission' : 'Our mission'}
            </h3>
            <p className="text-lg text-slate-700 leading-relaxed">
              {isFr
                ? "Mettre la même clarté, la même responsabilité et le même contrôle opérationnel que les grandes organisations tiennent pour acquis entre les mains de chaque syndicat — construit par quelqu'un qui l'a vécu et quelqu'un qui sait comment le faire grandir."
                : 'Put the same clarity, accountability, and operational control that large organizations take for granted into the hands of every union — built by someone who lived it, and someone who knows how to scale it.'}
            </p>
          </div>
        </section>

        {/* Core Principles */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            {isFr ? 'Ce en quoi nous croyons' : 'What we stand for'}
          </h2>
          <div className="space-y-6">
            {isFr ? (
              <>
                <PrincipleCard icon={<Users className="h-6 w-6" />}
                  title="Les organisateurs sont les acteurs centraux"
                  description="La technologie sert les gens, ne les remplace jamais. Les délégués prennent les décisions. Le système fournit un soutien. Il n'y a pas de 'gestionnaire de cas IA'. Il n'y en aura jamais." />
                <PrincipleCard icon={<Shield className="h-6 w-6" />}
                  title="Pas de surveillance, pas de métriques utilisées contre les travailleurs"
                  description="Nous ne suivons pas la 'productivité des organisateurs' ni les 'taux de fermeture des dossiers'. Nous ne construisons pas de classements. La santé du système, oui. La surveillance des personnes, jamais." />
                <PrincipleCard icon={<Heart className="h-6 w-6" />}
                  title="La dignité humaine passe en premier"
                  description="Chaque grief représente une personne lésée. Nous traitons cela avec le sérieux qu'il mérite. Pas de gamification. Pas de bonne humeur d'entreprise. Juste du respect." />
                <PrincipleCard icon={<Handshake className="h-6 w-6" />}
                  title="Gouvernance démocratique intégrée"
                  description="UnionEyes dispose d'une structure à actions spéciales. Les membres syndicaux élisent des représentants qui peuvent opposer leur veto à toute vente ou changement de mission. Ce n'est pas du marketing — c'est dans notre accord d'actionnaires." />
              </>
            ) : (
              <>
                <PrincipleCard icon={<Users className="h-6 w-6" />}
                  title="Organizers are the central actors"
                  description="Technology serves people, never replaces them. Stewards make the decisions. The system provides support. There is no 'AI case manager.' There never will be." />
                <PrincipleCard icon={<Shield className="h-6 w-6" />}
                  title="No surveillance, no weaponized metrics"
                  description="We don't track 'organizer productivity' or 'case closure rates.' We don't build leaderboards. System health, yes. People surveillance, never." />
                <PrincipleCard icon={<Heart className="h-6 w-6" />}
                  title="Human dignity comes first"
                  description="Every grievance represents a person who was wronged. We treat that with the seriousness it deserves. No gamification. No corporate cheerfulness. Just respect." />
                <PrincipleCard icon={<Handshake className="h-6 w-6" />}
                  title="Democratic governance baked in"
                  description="UnionEyes has a golden share structure. Union members elect representatives who can veto any sale or mission change. This isn't marketing—it's in our shareholder agreement." />
              </>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            {isFr ? 'Prêt à voir si nous sommes le bon partenaire?' : "Ready to see if we're the right fit?"}
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            {isFr
              ? "Nous ne faisons pas de démonstrations. Nous avons des conversations. Parlez-nous de vos défis. Nous serons honnêtes quant à savoir si UnionEyes peut vous aider."
              : "We don't do demos. We do conversations. Tell us about your challenges. We'll be honest about whether UnionEyes can help — or if something else would serve you better."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href={`/${locale}/pilot-request`}>
                {isFr ? 'Demander un projet pilote' : 'Request a pilot program'}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/${locale}/contact`}>
                {isFr ? 'Démarrer une conversation' : 'Start a conversation'}
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PrincipleCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-6 bg-white border border-slate-200 rounded-lg">
      <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-700">{description}</p>
      </div>
    </div>
  );
}
