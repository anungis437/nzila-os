/** Privacy projection for equity snapshots. Raw snapshot rows must never leave the service boundary. */
export const EQUITY_MINIMUM_CELL_SIZE = 10;
export const EQUITY_SUPPRESSION_POLICY_VERSION = 'ue-equity-small-cell-v1';

export type EquitySnapshotRecord = Record<string, unknown>;

const COUNT_FIELDS = [
  'womenCount', 'menCount', 'nonBinaryCount', 'genderNotDisclosed',
  'visibleMinorityCount', 'indigenousCount', 'personsWithDisabilitiesCount', 'lgbtq2PlusCount',
  'firstNationsCount', 'inuitCount', 'metisCount', 'multipleEquityGroupsCount',
  'executiveBoardWomen', 'executiveBoardVisibleMinority', 'executiveBoardIndigenous',
  'stewardsWomen', 'stewardsVisibleMinority',
  'totalConsentGiven',
] as const;

const GENDER_PARTITION = ['womenCount', 'menCount', 'nonBinaryCount', 'genderNotDisclosed'] as const;

export interface EquitySnapshotProjection {
  data: EquitySnapshotRecord;
  suppression: {
    policyVersion: string;
    minimumCellSize: number;
    fields: string[];
    complementaryFields: string[];
  };
}

const numeric = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Suppresses non-zero cells below ten. For the mutually-exclusive gender partition, if one or more primary cells are suppressed and the
 * total is exposed, an additional smallest publishable cell is suppressed so subtraction cannot recover a single hidden value. Pay-rate
 * aggregates are withheld whenever the corresponding population count is hidden.
 */
export function projectEquitySnapshot(
  row: EquitySnapshotRecord,
  minimumCellSize: number = EQUITY_MINIMUM_CELL_SIZE,
): EquitySnapshotProjection {
  if (!Number.isInteger(minimumCellSize) || minimumCellSize < EQUITY_MINIMUM_CELL_SIZE) {
    throw new Error(`Equity minimum cell size must be an integer of at least ${EQUITY_MINIMUM_CELL_SIZE}`);
  }
  const data = { ...row };
  const primary = new Set<string>();
  const complementary = new Set<string>();
  const totalMembers = numeric(row.totalMembers);
  if (totalMembers !== null && totalMembers < minimumCellSize) {
    for (const field of COUNT_FIELDS) primary.add(field);
    data.totalMembers = null;
  }
  for (const field of COUNT_FIELDS) {
    const value = numeric(row[field]);
    if (value !== null && value > 0 && value < minimumCellSize) primary.add(field);
  }

  const hiddenGender = GENDER_PARTITION.filter((field) => primary.has(field));
  if (hiddenGender.length > 0 && numeric(row.totalMembers) !== null) {
    const candidates = GENDER_PARTITION
      .filter((field) => !primary.has(field))
      .map((field) => ({ field, value: numeric(row[field]) }))
      .filter((entry): entry is { field: (typeof GENDER_PARTITION)[number]; value: number } => entry.value !== null && entry.value > 0)
      .sort((a, b) => a.value - b.value || a.field.localeCompare(b.field));
    if (candidates[0]) complementary.add(candidates[0].field);
  }

  const hidden = new Set([...primary, ...complementary]);
  for (const field of hidden) data[field] = null;
  if (hidden.has('womenCount')) data.avgHourlyRateWomen = null;
  if (hidden.has('menCount')) data.avgHourlyRateMen = null;
  if (hidden.has('womenCount') || hidden.has('menCount')) data.genderPayGapPercentage = null;

  return {
    data,
    suppression: {
      policyVersion: EQUITY_SUPPRESSION_POLICY_VERSION,
      minimumCellSize,
      fields: [...hidden].sort(),
      complementaryFields: [...complementary].sort(),
    },
  };
}
