/**
 * Reads the pension routes' answers for the pension consoles.
 *
 * Every pension list route answers its rows as the withApi body's `data` (an array), at most 200 a page, with `offset` for the rest.
 * Postgres numeric columns arrive as strings ("250000.00"): they are parsed here, once, because adding them as they arrive concatenates them.
 * A figure a row does not hold is null, never zero.
 */
import { ApiShapeError, isRecord, readApiError } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';

export const PENSION_PAGE = 200;
const MAX_PAGES = 50;

export interface PensionPlan {
  id: string;
  planName: string;
  planType: string;
  status: string;
  description: string | null;
  /** Counted from enrolments; the route sends it to an administrator only. */
  activeMembers: number | null;
  /** Recorded by an administrator; the route sends it to an administrator only. */
  totalAssets: number | null;
  fundingStatus: number | null;
}

export interface PensionContribution {
  id: string;
  memberName: string;
  period: string;
  amount: number;
  paymentStatus: string;
  paymentDate: string | null;
}

export interface BenefitClaim {
  id: string;
  memberName: string;
  claimType: string;
  status: string;
  amount: number;
  submittedDate: string;
  processedDate: string | null;
}

export interface PensionMember {
  id: string;
  planId: string;
  name: string;
  planName: string;
  enrollmentDate: string;
  membershipStatus: string;
  yearsOfService: number;
  vestingStatus: string;
}

export interface T4ARecord {
  id: string;
  memberName: string;
  taxYear: number;
  pensionIncome: number;
  status: string;
  generatedDate: string | null;
}

/** A failure the server explained: its words are shown as they came. */
export class PensionServerMessage extends Error {}

function numberOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new ApiShapeError(`${key} is not a number`);
  return parsed;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = numberOrNull(row, key);
  if (value === null) throw new ApiShapeError(`${key} is missing`);
  return value;
}

function requiredDate(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key);
  if (Number.isNaN(new Date(value).getTime())) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

function optionalDate(row: Record<string, unknown>, key: string): string | null {
  const value = optionalString(row, key);
  if (value !== null && Number.isNaN(new Date(value).getTime())) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

export function readPlan(value: unknown): PensionPlan {
  const row = asRecord(value, 'pension plan');
  return {
    id: requiredString(row, 'id'),
    planName: requiredString(row, 'planName'),
    planType: requiredString(row, 'planType'),
    status: requiredString(row, 'status'),
    description: optionalString(row, 'description'),
    activeMembers: numberOrNull(row, 'activeMembers'),
    totalAssets: numberOrNull(row, 'totalAssets'),
    fundingStatus: numberOrNull(row, 'fundingStatus'),
  };
}

export function readContribution(value: unknown): PensionContribution {
  const row = asRecord(value, 'contribution');
  return {
    id: requiredString(row, 'id'),
    memberName: requiredString(row, 'memberName'),
    period: requiredString(row, 'period'),
    amount: requiredNumber(row, 'amount'),
    paymentStatus: requiredString(row, 'paymentStatus'),
    paymentDate: optionalDate(row, 'paymentDate'),
  };
}

export function readClaim(value: unknown): BenefitClaim {
  const row = asRecord(value, 'benefit claim');
  return {
    id: requiredString(row, 'id'),
    memberName: requiredString(row, 'memberName'),
    claimType: requiredString(row, 'claimType'),
    status: requiredString(row, 'status'),
    amount: requiredNumber(row, 'amount'),
    submittedDate: requiredDate(row, 'submittedDate'),
    processedDate: optionalDate(row, 'processedDate'),
  };
}

export function readPensionMember(value: unknown): PensionMember {
  const row = asRecord(value, 'pension member');
  return {
    id: requiredString(row, 'id'),
    planId: requiredString(row, 'planId'),
    name: requiredString(row, 'name'),
    planName: requiredString(row, 'planName'),
    enrollmentDate: requiredDate(row, 'enrollmentDate'),
    membershipStatus: requiredString(row, 'membershipStatus'),
    yearsOfService: requiredNumber(row, 'yearsOfService'),
    vestingStatus: requiredString(row, 'vestingStatus'),
  };
}

export function readT4a(value: unknown): T4ARecord {
  const row = asRecord(value, 'T4A record');
  return {
    id: requiredString(row, 'id'),
    memberName: requiredString(row, 'memberName'),
    taxYear: requiredNumber(row, 'taxYear'),
    pensionIncome: requiredNumber(row, 'pensionIncome'),
    status: requiredString(row, 'status'),
    generatedDate: optionalDate(row, 'generatedDate'),
  };
}

/** The rows of a pension list route: its `data`. */
export function readPensionRows(body: unknown): unknown[] {
  if (isRecord(body) && Array.isArray(body.data)) return body.data;
  throw new ApiShapeError('no list');
}

export interface PensionDocument {
  id: string;
  name: string;
  fileType: string;
  createdAt: string;
}

/** A row of the document repository: the name is the stored title, else the name, else the file name. */
export function readPensionDocument(value: unknown): PensionDocument {
  const row = asRecord(value, 'document');
  const filename = optionalString(row, 'filename');
  return {
    id: requiredString(row, 'id'),
    name: optionalString(row, 'title') ?? optionalString(row, 'name') ?? filename ?? 'Document',
    fileType: filename?.split('.').pop() ?? 'file',
    createdAt: requiredDate(row, 'createdAt'),
  };
}

/** Every row of a pension list route, a page at a time: a page shorter than the limit is the last one. */
export async function fetchPensionRows<T>(path: string, read: (row: unknown) => T, fallback: string): Promise<T[]> {
  const rows: T[] = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch(`${path}${separator}limit=${PENSION_PAGE}&offset=${page * PENSION_PAGE}`);
    if (!response.ok) throw new PensionServerMessage(await readApiError(response, fallback));
    const batch = readPensionRows(await response.json());
    rows.push(...batch.map(read));
    if (batch.length < PENSION_PAGE) return rows;
  }
  throw new ApiShapeError('too many rows');
}
