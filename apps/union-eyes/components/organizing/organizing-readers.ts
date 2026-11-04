/**
 * Reads the rows GET /api/organizing/campaigns answers (the crud factory's list of organizing_campaigns), for the organizing consoles.
 *
 * The consoles used to read the Django model's field names (campaignStatus, targetEmployerName, workplaceCity, estimatedEligibleWorkers,
 * cardsSignedCount, cardsSignedPercentage, cardCheckDeadline, ...), none of which this table has, so every campaign read as undefined and
 * the first search crashed on `undefined.toLowerCase()`. The table's own columns are read here, and a figure a row does not hold is null.
 */
import { asRecord, countOrNull, optionalString, requiredCount, requiredString } from '@/lib/client/row-fields';

export interface Campaign {
  id: string;
  campaignName: string;
  campaignCode: string;
  campaignType: string;
  status: string;
  targetEmployer: string;
  workplaceLocation: string;
  industry: string | null;
  priority: string | null;
  estimatedUnitSize: number;
  targetCardCount: number | null;
  cardsSigned: number | null;
  teamSize: number | null;
  campaignStartDate: string | null;
  targetCardDeadline: string | null;
  filingDate: string | null;
  electionDate: string | null;
  certificationDate: string | null;
  campaignEndDate: string | null;
  organizingStrategy: string | null;
  keyIssues: string[];
  contactsIdentified: number | null;
  contactsCommitted: number | null;
  houseVisitsCompleted: number | null;
  workplaceMeetingsHeld: number | null;
  electionEligibleVoters: number | null;
  votesForUnion: number | null;
  votesAgainstUnion: number | null;
  electionResult: string | null;
}

function textList(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : [];
}

export function readCampaign(value: unknown): Campaign {
  const row = asRecord(value, 'campaign');
  return {
    id: requiredString(row, 'id'),
    campaignName: requiredString(row, 'campaignName'),
    campaignCode: requiredString(row, 'campaignCode'),
    campaignType: requiredString(row, 'campaignType'),
    status: requiredString(row, 'status'),
    targetEmployer: requiredString(row, 'targetEmployer'),
    workplaceLocation: requiredString(row, 'workplaceLocation'),
    industry: optionalString(row, 'industry'),
    priority: optionalString(row, 'priority'),
    estimatedUnitSize: requiredCount(row, 'estimatedUnitSize'),
    targetCardCount: countOrNull(row, 'targetCardCount'),
    cardsSigned: countOrNull(row, 'cardsSigned'),
    teamSize: Array.isArray(row.organizingTeam) ? row.organizingTeam.length : null,
    campaignStartDate: optionalString(row, 'campaignStartDate'),
    targetCardDeadline: optionalString(row, 'targetCardDeadline'),
    filingDate: optionalString(row, 'filingDate'),
    electionDate: optionalString(row, 'electionDate'),
    certificationDate: optionalString(row, 'certificationDate'),
    campaignEndDate: optionalString(row, 'campaignEndDate'),
    organizingStrategy: optionalString(row, 'organizingStrategy'),
    keyIssues: textList(row, 'keyIssues'),
    contactsIdentified: countOrNull(row, 'contactsIdentified'),
    contactsCommitted: countOrNull(row, 'contactsCommitted'),
    houseVisitsCompleted: countOrNull(row, 'houseVisitsCompleted'),
    workplaceMeetingsHeld: countOrNull(row, 'workplaceMeetingsHeld'),
    electionEligibleVoters: countOrNull(row, 'electionEligibleVoters'),
    votesForUnion: countOrNull(row, 'votesForUnion'),
    votesAgainstUnion: countOrNull(row, 'votesAgainstUnion'),
    electionResult: optionalString(row, 'electionResult'),
  };
}

/** Signed cards as a share of the estimated unit, computed from the two counts the row holds; null when either is missing or the unit is empty. */
export function signingPercent(campaign: Campaign): number | null {
  if (campaign.cardsSigned === null || campaign.estimatedUnitSize <= 0) return null;
  return (campaign.cardsSigned / campaign.estimatedUnitSize) * 100;
}

/** Where the card target sits on the unit, in percent, when the campaign has one. */
export function targetPercent(campaign: Campaign): number | null {
  if (campaign.targetCardCount === null || campaign.estimatedUnitSize <= 0) return null;
  return (campaign.targetCardCount / campaign.estimatedUnitSize) * 100;
}

export const formatStatusLabel = (status: string) =>
  status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** A `date` column is a calendar day with no zone: it is shown as that day, not shifted into the viewer's zone (which would read a day early in Canada). */
export const formatCampaignDate = (value: string | null) =>
  value === null ? 'Not set' : new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
