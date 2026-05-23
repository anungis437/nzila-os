/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * institutional trust for democratic infrastructure.
 *
 * Role coordination surface
 *
 * Coordination posture: representation workflow, case management, intake choreography,
 * and operational coordination across federation, leadership, member, and staff touchpoints.
 *
 * Governance posture: bylaw-aligned procedural cadence, constitutional consistency,
 * accountability surfaces, and compliance choreography across jurisdictions and mandates.
 *
 * Continuity posture: institutional memory preservation, succession-aware handoff,
 * stewardship of representational records, and procedural continuity across mandates.
 */
/**
 * Locale-aware For CLC page.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, QrCode, Users, ShieldCheck, ClipboardList } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  clcBoothNarrativeSystem,
  executiveBriefingPacks,
  executiveEngagementChoreography,
  leadClassificationSystem,
  objectionHandlingFramework,
  pilotConversationPathway,
  postConferenceContinuityCampaigns,
  procurementFollowUpInfrastructure,
  qrJourneyArchitecture,
  stakeholderTalkTrackSystem,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const CLC_COPY = {
  'en-CA': {
    title: 'CLC Field Activation | UnionEyes',
    description:
      'Convention-ready executive engagement, QR journeys, and procurement-safe follow-up architecture for CLC field conversion.',
    badge: 'CLC Conversion System',
    heading: 'Convention-ready continuity modernization activation.',
    descriptionHero:
      'A calm, strategic field system that turns convention conversations into executive trust, procurement curiosity, and structured pilot exploration.',
    ctaProof: 'Executive proof path',
    ctaPilot: 'Pilot exploration path',
    tabNarrative: 'Narrative',
    tabEngagement: 'Engagement',
    tabConversion: 'Conversion',
    tabFollowUp: 'Follow-Up',
    narrativeRhythm: 'Canonical Booth Narrative Rhythm',
    narrativeHeading: 'Distinctive continuity narrative for CLC field presence',
    stageLabel: 'Stage',
    engagementChoreography: 'Executive Engagement Choreography',
    engagementHeading: 'Stakeholder-specific entry points without sales theatrics',
    outcomeLabel: 'Outcome:',
    talkTrackHeading: 'Stakeholder talk-track system',
    qrJourneyLabel: 'QR Journey Architecture',
    qrJourneyHeading: 'Intentional conference journeys with continuity context',
    objectionHeading: 'Objection-handling framework',
    pilotPathwayHeading: 'Pilot conversation pathway',
    briefingPacksHeading: 'Executive Briefing Packs',
    procurementHeading: 'Procurement follow-up infrastructure',
    leadClassificationHeading: 'Lead classification system',
    postConferenceHeading: 'Post-conference continuity campaigns',
  },
  'fr-CA': {
    title: 'Activation terrain CLC | UnionEyes',
    description:
      'Architecture de conversion conventionnelle avec engagement executif, parcours QR et suivi achats gouvernable.',
    badge: 'Systeme de conversion CLC',
    heading: 'Activation de modernisation prete pour la convention.',
    descriptionHero:
      'Un systeme terrain calme et strategique qui transforme les conversations en confiance executive et exploration pilote structuree.',
    ctaProof: 'Parcours de preuve executive',
    ctaPilot: 'Parcours d exploration pilote',
    tabNarrative: 'Narratif',
    tabEngagement: 'Engagement',
    tabConversion: 'Conversion',
    tabFollowUp: 'Suivi',
    narrativeRhythm: 'Rythme narratif canonique du kiosque',
    narrativeHeading: 'Narratif distinctif de continuite pour la presence terrain CLC',
    stageLabel: 'Etape',
    engagementChoreography: 'Choregraphie d engagement executif',
    engagementHeading: 'Points d entree par partie prenante sans theatrale commerciale',
    outcomeLabel: 'Resultat :',
    talkTrackHeading: 'Systeme de points de discussion par partie prenante',
    qrJourneyLabel: 'Architecture des parcours QR',
    qrJourneyHeading: 'Parcours de conference intentionnels avec contexte de continuite',
    objectionHeading: 'Cadre de traitement des objections',
    pilotPathwayHeading: 'Parcours de conversation pilote',
    briefingPacksHeading: 'Dossiers de breffage executif',
    procurementHeading: 'Infrastructure de suivi des achats',
    leadClassificationHeading: 'Systeme de classification des pistes',
    postConferenceHeading: 'Campagnes de continuite post-conference',
  },
  it: {
    title: 'Attivazione campo CLC | UnionEyes',
    description:
      'Architettura convention-ready con engagement executive, percorsi QR e follow-up procurement governance-safe.',
    badge: 'Sistema conversione CLC',
    heading: 'Attivazione modernizzazione pronta per convention.',
    descriptionHero:
      'Un sistema campo calmo e strategico che converte conversazioni in fiducia executive e esplorazione pilota strutturata.',
    ctaProof: 'Percorso prove executive',
    ctaPilot: 'Percorso esplorazione pilota',
    tabNarrative: 'Narrativa',
    tabEngagement: 'Engagement',
    tabConversion: 'Conversione',
    tabFollowUp: 'Follow-up',
    narrativeRhythm: 'Ritmo narrativo stand canonico',
    narrativeHeading: 'Narrativa di continuita per presenza CLC',
    stageLabel: 'Fase',
    engagementChoreography: 'Coreografia engagement executive',
    engagementHeading: 'Ingressi stakeholder senza teatralita commerciale',
    outcomeLabel: 'Esito:',
    talkTrackHeading: 'Sistema talk-track stakeholder',
    qrJourneyLabel: 'Architettura percorsi QR',
    qrJourneyHeading: 'Percorsi conference con contesto continuita',
    objectionHeading: 'Framework gestione obiezioni',
    pilotPathwayHeading: 'Percorso conversazione pilota',
    briefingPacksHeading: 'Pacchetti briefing executive',
    procurementHeading: 'Infrastruttura follow-up procurement',
    leadClassificationHeading: 'Sistema classificazione lead',
    postConferenceHeading: 'Campagne continuita post-conference',
  },
  pt: {
    title: 'Ativacao de campo CLC | UnionEyes',
    description:
      'Arquitetura pronta para convencao com engajamento executivo, jornadas QR e follow-up de compras governance-safe.',
    badge: 'Sistema de conversao CLC',
    heading: 'Ativacao de modernizacao pronta para convencao.',
    descriptionHero:
      'Um sistema de campo calmo e estrategico que converte conversas em confianca executiva e exploracao piloto estruturada.',
    ctaProof: 'Caminho de prova executiva',
    ctaPilot: 'Caminho de exploracao piloto',
    tabNarrative: 'Narrativa',
    tabEngagement: 'Engajamento',
    tabConversion: 'Conversao',
    tabFollowUp: 'Follow-up',
    narrativeRhythm: 'Ritmo narrativo canonico de estande',
    narrativeHeading: 'Narrativa distintiva de continuidade para presenca CLC',
    stageLabel: 'Etapa',
    engagementChoreography: 'Coreografia de engajamento executivo',
    engagementHeading: 'Pontos de entrada por stakeholder sem teatro comercial',
    outcomeLabel: 'Resultado:',
    talkTrackHeading: 'Sistema de fala por stakeholder',
    qrJourneyLabel: 'Arquitetura de jornada QR',
    qrJourneyHeading: 'Jornadas intencionais de conferencia com contexto de continuidade',
    objectionHeading: 'Framework de tratamento de objecoes',
    pilotPathwayHeading: 'Caminho de conversa piloto',
    briefingPacksHeading: 'Pacotes de briefing executivo',
    procurementHeading: 'Infraestrutura de follow-up de compras',
    leadClassificationHeading: 'Sistema de classificacao de leads',
    postConferenceHeading: 'Campanhas de continuidade pos-conferencia',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = CLC_COPY[locale as keyof typeof CLC_COPY] ?? CLC_COPY['en-CA'];
  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/for-clc'),
  };
}

export default async function LocaleForCLCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = CLC_COPY[locale as keyof typeof CLC_COPY] ?? CLC_COPY['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeroSection
        imageUrl={heroImagery.governance}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.descriptionHero}
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={`/${locale}/proof?context=executive`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.ctaProof}
            </Link>
            <Link href={`/${locale}/institutional-continuity-risk?context=conference`} className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              {copy.ctaPilot}
            </Link>
          </div>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="narrative" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="narrative" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabNarrative}
              </TabsTrigger>
              <TabsTrigger value="engagement" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabEngagement}
              </TabsTrigger>
              <TabsTrigger value="conversion" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabConversion}
              </TabsTrigger>
              <TabsTrigger value="followup" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabFollowUp}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="narrative" className="space-y-12">
            <section>
              <div className="flex items-center gap-2 mb-3 text-electric">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs uppercase tracking-widest font-semibold">{copy.narrativeRhythm}</span>
              </div>
              <h2 className="text-3xl font-bold text-navy mb-4">{copy.narrativeHeading}</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {clcBoothNarrativeSystem.map((stage, index) => (
                  <article key={stage} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{copy.stageLabel} {index + 1}</p>
                    <h3 className="text-sm font-bold text-navy">{stage}</h3>
                  </article>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-12">
            <section>
              <div className="flex items-center gap-2 mb-3 text-electric">
                <Users className="h-4 w-4" />
                <span className="text-xs uppercase tracking-widest font-semibold">{copy.engagementChoreography}</span>
              </div>
              <h2 className="text-3xl font-bold text-navy mb-4">{copy.engagementHeading}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {executiveEngagementChoreography.map((item) => (
                  <article key={item.stakeholder} className="p-5 rounded-2xl border border-gray-100 bg-gray-50">
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{item.emotionalEntry}</p>
                    <h3 className="text-sm font-bold text-navy mb-2">{item.stakeholder}</h3>
                    <p className="text-sm text-gray-600 mb-1">{item.openingMove}</p>
                    <p className="text-xs text-gray-700"><span className="font-semibold">{copy.outcomeLabel}</span> {item.engagementOutcome}</p>
                  </article>
                ))}
              </div>

              <h3 className="text-xl font-bold text-navy mt-8 mb-3">{copy.talkTrackHeading}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {stakeholderTalkTrackSystem.map((track) => (
                  <article key={track.stakeholder} className="p-5 rounded-2xl border border-gray-100 bg-white">
                    <h4 className="text-sm font-bold text-navy mb-2">{track.stakeholder}</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {track.focusAreas.map((focus) => (
                        <li key={focus}>• {focus}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="conversion" className="space-y-12">
            <section>
              <div className="flex items-center gap-2 mb-3 text-electric">
                <QrCode className="h-4 w-4" />
                <span className="text-xs uppercase tracking-widest font-semibold">{copy.qrJourneyLabel}</span>
              </div>
              <h2 className="text-3xl font-bold text-navy mb-4">{copy.qrJourneyHeading}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {qrJourneyArchitecture.map((journey) => (
                  <article key={journey.journey} className="p-5 rounded-2xl border border-gray-100 bg-white">
                    <h3 className="text-sm font-bold text-navy mb-2">{journey.journey}</h3>
                    <p className="text-xs text-gray-600 mb-2">{journey.purpose}</p>
                    <Link href={`/${locale}${journey.destination}`} className="text-sm font-semibold text-electric hover:text-blue-700 inline-flex items-center gap-1">
                      {journey.destination} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </article>
                ))}
              </div>

              <h3 className="text-xl font-bold text-navy mt-8 mb-3">{copy.objectionHeading}</h3>
              <div className="space-y-3">
                {objectionHandlingFramework.map((item) => (
                  <article key={item.concern} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-sm font-bold text-navy mb-1">{item.concern}</p>
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{item.handling}</p>
                    <p className="text-sm text-gray-600">{item.response}</p>
                  </article>
                ))}
              </div>

              <h3 className="text-xl font-bold text-navy mt-8 mb-3">{copy.pilotPathwayHeading}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {pilotConversationPathway.map((step, index) => (
                  <div key={step} className="p-3 rounded-lg border border-gray-100 bg-white text-sm text-navy font-semibold">
                    {index + 1}. {step}
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="followup" className="space-y-12">
            <section className="grid lg:grid-cols-2 gap-8">
              <article className="p-6 rounded-2xl border border-gray-100 bg-white">
                <div className="flex items-center gap-2 mb-3 text-electric">
                  <ClipboardList className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest font-semibold">{copy.briefingPacksHeading}</span>
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  {executiveBriefingPacks.map((item) => (
                    <div key={item} className="p-2 rounded bg-gray-50 border border-gray-100">{item}</div>
                  ))}
                </div>
              </article>

              <article className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-navy mb-3">{copy.procurementHeading}</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {procurementFollowUpInfrastructure.map((item) => (
                    <div key={item} className="p-2 rounded bg-white border border-gray-100">{item}</div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid lg:grid-cols-2 gap-8">
              <article className="p-6 rounded-2xl border border-gray-100 bg-white">
                <h3 className="text-lg font-bold text-navy mb-3">{copy.leadClassificationHeading}</h3>
                <div className="space-y-2">
                  {leadClassificationSystem.map((item) => (
                    <div key={item.segment} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-sm font-semibold text-navy">{item.segment}</p>
                      <p className="text-xs text-gray-600">{item.meaning}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-navy mb-3">{copy.postConferenceHeading}</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {postConferenceContinuityCampaigns.map((item) => (
                    <div key={item} className="p-2 rounded bg-white border border-gray-100">{item}</div>
                  ))}
                </div>
              </article>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
