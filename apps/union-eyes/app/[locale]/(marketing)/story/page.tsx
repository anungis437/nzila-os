/**
 * Locale-aware Story page
 * Accessible at /{locale}/story — provides translated header + full story content.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Heart, Users, Shield, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalloutPresets } from '@/components/marketing/human-centered-callout';

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
            {isFr ? 'Comment tout a commencé' : 'How this started'}
          </h2>
          <div className="prose prose-slate max-w-none">
            {isFr ? (
              <>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  En 2023, une déléguée syndicale d&apos;un syndicat de la santé en Ontario gérait 47 griefs
                  ouverts dans un fichier Excel partagé. Un jour, quelqu&apos;un a accidentellement supprimé
                  une colonne. Des semaines de documentation — disparues. Pas de sauvegarde. Pas de piste
                  d&apos;audit. Juste de la frustration et des membres qui attendent justice.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Pendant ce temps, l&apos;employeur disposait d&apos;un système RH sophistiqué qui suivait
                  chaque interaction, chaque délai, chaque échéance. Le déséquilibre de pouvoir
                  n&apos;était pas seulement dans la salle de réunion — il était dans les outils.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  C&apos;est alors que nous avons posé la question : <strong>Et si les syndicats avaient une infrastructure?</strong>
                </p>
                <p className="text-lg text-slate-700 leading-relaxed">
                  Pas un logiciel qui &laquo;perturbe&raquo; ou &laquo;évolue à grande échelle.&raquo; Pas un produit SaaS
                  conçu par des gens qui n&apos;ont jamais marché sur une ligne de piquetage.
                  Une <strong>infrastructure</strong> — celle que les services publics et les gouvernements ont.
                  Celle qui ne tombe pas en panne. Celle qui respecte le sérieux du travail.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  In 2023, a steward from a healthcare union in Ontario was managing 47 open
                  grievances in a shared Excel file. One day, someone accidentally deleted a
                  column. Weeks of documentation—gone. No backup. No audit trail. Just
                  frustration and members waiting for justice.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  Meanwhile, the employer had a sophisticated HR system that tracked every
                  interaction, every timeline, every deadline. The power imbalance wasn&apos;t just
                  in the boardroom—it was in the tools.
                </p>
                <p className="text-lg text-slate-700 leading-relaxed mb-4">
                  That&apos;s when we asked: <strong>What if unions had infrastructure?</strong>
                </p>
                <p className="text-lg text-slate-700 leading-relaxed">
                  Not software that &ldquo;disrupts&rdquo; or &ldquo;scales.&rdquo; Not a SaaS product designed by people
                  who&apos;ve never walked a picket line. <strong>Infrastructure</strong>—the kind that
                  utilities and governments have. The kind that doesn&apos;t break. The kind that
                  respects the seriousness of the work.
                </p>
              </>
            )}
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
                  description="Union Eyes dispose d'une structure à actions spéciales. Les membres syndicaux élisent des représentants qui peuvent opposer leur veto à toute vente ou changement de mission. Ce n'est pas du marketing — c'est dans notre accord d'actionnaires." />
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
                  description="Union Eyes has a golden share structure. Union members elect representatives who can veto any sale or mission change. This isn't marketing—it's in our shareholder agreement." />
              </>
            )}
          </div>
        </section>

        {/* Governance */}
        <section className="mb-16">
          <CalloutPresets.BuiltWithUnions />
          <div className="mt-6">
            <Button variant="outline" asChild>
              <Link href={`/${locale}/trust`}>
                {isFr ? 'Voir notre tableau de confiance →' : 'View our trust dashboard →'}
              </Link>
            </Button>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            {isFr ? 'Prêt à voir si nous sommes le bon partenaire?' : "Ready to see if we're the right fit?"}
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            {isFr
              ? "Nous ne faisons pas de démonstrations. Nous avons des conversations. Parlez-nous de vos défis. Nous serons honnêtes quant à savoir si Union Eyes peut vous aider."
              : "We don't do demos. We do conversations. Tell us about your challenges. We'll be honest about whether Union Eyes can help—or if something else would serve you better."}
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
