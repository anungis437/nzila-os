/**
 * Executive "Today" view model (frozen destination 1).
 *
 * Every card carries an explicit source state. Numbers are shown only when they
 * come from a real organization-scoped source; otherwise the card says what is
 * unavailable and why. There are no defaults, no zero-fills and no decorative
 * priorities. Pure function so it can be tested without a database.
 */
import type { LeadershipDashboardPayload } from '../services/dashboard-kpi-service';
import { loadVerifiedMandates } from './mandate';

export type TodayCardState = 'SOURCED' | 'LIMITED' | 'UNAVAILABLE';

export type TodayCardId =
  | 'decisions'
  | 'service-exceptions'
  | 'active-matters'
  | 'obligations'
  | 'meetings'
  | 'commitments';

export interface TodayCard {
  id: TodayCardId;
  state: TodayCardState;
  /** Present only when sourced from a real record set. */
  value?: number;
  href?: string;
}

export interface TodayModel {
  mandateStatus: 'NO_VERIFIED_MANDATE' | 'MANDATE_PRESENT';
  cards: TodayCard[];
  provenance: { generatedAt: string; cacheHit: boolean; sources: { table: string; rowCount: number }[] } | null;
}

export async function hasVerifiedMandate(userId: string, organizationId: string): Promise<boolean> {
  return (await loadVerifiedMandates(userId, organizationId)).length > 0;
}

export function buildExecutiveToday(input: {
  metrics: LeadershipDashboardPayload | null;
  mandatePresent: boolean;
  canSeeFinance: boolean;
}): TodayModel {
  const { metrics } = input;
  const sourced = (id: TodayCardId, value: number | undefined, href: string): TodayCard =>
    value === undefined ? { id, state: 'UNAVAILABLE', href } : { id, state: 'SOURCED', value, href };

  return {
    mandateStatus: input.mandatePresent ? 'MANDATE_PRESENT' : 'NO_VERIFIED_MANDATE',
    cards: [
      // No motion/decision store exists (O05): never imply an empty queue.
      { id: 'decisions', state: 'UNAVAILABLE', href: '/dashboard/governance' },
      sourced('service-exceptions', metrics?.kpi.overdueCases, '/dashboard/leadership'),
      sourced('active-matters', metrics?.kpi.activeGrievances, '/dashboard/leadership'),
      { id: 'obligations', state: 'LIMITED', href: '/dashboard/priorities' },
      { id: 'meetings', state: 'LIMITED', href: '/dashboard/committees' },
      input.canSeeFinance
        ? { id: 'commitments', state: 'UNAVAILABLE', href: '/dashboard/finance' }
        : { id: 'commitments', state: 'UNAVAILABLE' },
    ],
    provenance: metrics
      ? {
          generatedAt: metrics.provenance.generatedAt,
          cacheHit: metrics.provenance.cache?.hit ?? false,
          sources: metrics.provenance.sources.map((s) => ({ table: s.table, rowCount: s.rowCount })),
        }
      : null,
  };
}

const COPY = {
  en: {
    title: 'Today',
    eyebrow: 'Executive',
    intro: 'Decisions, priorities, obligations and exceptions for your institution. Each card states where its information comes from, or that it is not available.',
    mandateTitle: 'Your mandate',
    NO_VERIFIED_MANDATE: 'No verified office, term or delegation is on file for you. Actions that require institutional authority (adopting decisions, approving expenditure, signing, certifying) are disabled. Read-only aggregates below are limited to your organization.',
    MANDATE_PRESENT: 'A verified mandate is on file. Each action is still evaluated against your active office, delegation and limits.',
    states: { SOURCED: 'From records', LIMITED: 'Limited', UNAVAILABLE: 'Not available' },
    open: 'Open',
    unavailableValue: 'Not available',
    cards: {
      decisions: { title: 'Decisions awaiting you', body: 'No institutional decision workflow is connected, so no pending-decision count is shown. This is not an empty queue.' },
      'service-exceptions': { title: 'Service exceptions', body: 'Open grievances past their response deadline (aggregate only; case details need a separate grant).' },
      'active-matters': { title: 'Open representation matters', body: 'Grievances currently open in your organization (aggregate only).' },
      obligations: { title: 'Obligations and priorities', body: 'Commitments and deadlines are tracked in Priorities. They are not summarised here.' },
      meetings: { title: 'Governance meetings', body: 'Committee meetings, minutes and action items are in Committees. Quorum and notice are not verified.' },
      commitments: { title: 'Financial commitments', body: 'No budget or expenditure-approval records exist, so no commitments or balances are shown.' },
    },
    provenance: 'Source data',
    generated: 'Generated',
    cached: 'cached',
    live: 'live',
    rows: 'records',
    sourceError: 'Service figures could not be loaded. They are shown as not available rather than as zero.',
  },
  fr: {
    title: "Aujourd'hui",
    eyebrow: 'Direction',
    intro: "Décisions, priorités, obligations et exceptions de votre organisation. Chaque carte indique la provenance de son information, ou précise qu'elle n'est pas disponible.",
    mandateTitle: 'Votre mandat',
    NO_VERIFIED_MANDATE: "Aucune fonction, aucun mandat ni aucune délégation vérifiés ne sont au dossier pour vous. Les actions qui exigent une autorité institutionnelle (adopter une décision, approuver une dépense, signer, certifier) sont désactivées. Les données agrégées ci-dessous sont limitées à votre organisation.",
    MANDATE_PRESENT: 'Un mandat vérifié est au dossier. Chaque action est tout de même évaluée selon votre fonction active, votre délégation et vos limites.',
    states: { SOURCED: 'Issu des dossiers', LIMITED: 'Limité', UNAVAILABLE: 'Non disponible' },
    open: 'Ouvrir',
    unavailableValue: 'Non disponible',
    cards: {
      decisions: { title: 'Décisions en attente', body: "Aucun processus décisionnel institutionnel n'est raccordé : aucun nombre de décisions en attente n'est affiché. Ce n'est pas une file vide." },
      'service-exceptions': { title: 'Exceptions de service', body: "Griefs ouverts dont le délai de réponse est dépassé (données agrégées; les détails d'un dossier exigent une autorisation distincte)." },
      'active-matters': { title: 'Dossiers de représentation ouverts', body: 'Griefs actuellement ouverts dans votre organisation (données agrégées).' },
      obligations: { title: 'Obligations et priorités', body: "Les engagements et échéances sont suivis dans Priorités. Ils ne sont pas résumés ici." },
      meetings: { title: 'Réunions de gouvernance', body: "Les réunions, procès-verbaux et actions des comités sont dans Comités. Le quorum et l'avis ne sont pas vérifiés." },
      commitments: { title: 'Engagements financiers', body: "Aucun dossier de budget ou d'approbation de dépense n'existe : aucun engagement ni solde n'est affiché." },
    },
    provenance: 'Données sources',
    generated: 'Généré',
    cached: 'en cache',
    live: 'en direct',
    rows: 'enregistrements',
    sourceError: "Les chiffres de service n'ont pas pu être chargés. Ils sont indiqués comme non disponibles plutôt que comme zéro.",
  },
} as const;

export function getTodayCopy(locale: string) {
  return COPY[locale.toLowerCase().startsWith('fr') ? 'fr' : 'en'];
}
