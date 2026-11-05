/**
 * The rows of /api/employers, /api/worksites, /api/units and /api/committees, as the union-structure screens read them.
 *
 * Each list is every page of the route's own list (lib/client/crud-lists.ts), and each row is checked as it is read: a column the database never
 * leaves empty that is missing is a malformed response, which the screen shows as an error, never a row completed with a guess. The columns are
 * the routes': the CRUD factory sends every column of the table except the ones a route omits, so anything else a screen shows (a worksite's
 * employer name, an employer's number of worksites) is derived from these lists, not read from a field that does not exist.
 */
import { fetchAllRows } from "@/lib/client/crud-lists";
import { asRecord, countOrNull, flagOrFalse, optionalString, requiredString } from "@/lib/client/row-fields";

export const PROVINCES = [
  { code: "ON", name: "Ontario" },
  { code: "QC", name: "Quebec" },
  { code: "BC", name: "British Columbia" },
  { code: "AB", name: "Alberta" },
  { code: "MB", name: "Manitoba" },
  { code: "SK", name: "Saskatchewan" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NB", name: "New Brunswick" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "YT", name: "Yukon" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
] as const;

/** The provinces to choose from, plus the stored value when it is not one of them (a record imported as "Ontario" must not show as blank). */
export function provinceChoices(current: string): ReadonlyArray<{ code: string; name: string }> {
  return current === "" || PROVINCES.some((province) => province.code === current)
    ? PROVINCES
    : [...PROVINCES, { code: current, name: current }];
}

/** employers.main_address and worksites.address: a jsonb object. The keys the forms do not edit are kept so a save does not drop them. */
export interface Address {
  street: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  extra: Record<string, unknown>;
}

export function toAddress(value: unknown): Address | null {
  if (value === null) return null;
  const record = asRecord(value, "address");
  const { street, city, province, postal_code: postalCode, ...extra } = record;
  const text = (entry: unknown) => (typeof entry === "string" && entry !== "" ? entry : null);
  return { street: text(street), city: text(city), province: text(province), postalCode: text(postalCode), extra };
}

export interface AddressFields {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}

export const EMPTY_ADDRESS_FIELDS: AddressFields = { street: "", city: "", province: "", postalCode: "" };

export function addressFieldsOf(address: Address | null): AddressFields {
  return {
    street: address?.street ?? "",
    city: address?.city ?? "",
    province: address?.province ?? "",
    postalCode: address?.postalCode ?? "",
  };
}

/**
 * The jsonb a save writes: what was typed, with the keys the form does not edit (unit, coordinates, country) kept from the stored address.
 * Nothing typed means no address. A new address is Canadian because the province list is: the stored country, when there is one, wins.
 */
export function toAddressPayload(fields: AddressFields, existing: Address | null): Record<string, unknown> | null {
  const typed: Record<string, string> = {};
  if (fields.street) typed.street = fields.street;
  if (fields.city) typed.city = fields.city;
  if (fields.province) typed.province = fields.province;
  if (fields.postalCode) typed.postal_code = fields.postalCode;
  if (Object.keys(typed).length === 0) return null;
  return { country: "Canada", ...existing?.extra, ...typed };
}

/** "Toronto, ON", whichever of the two the address holds, or a dash when it holds neither. */
export function formatLocation(address: Address | null): string {
  return [address?.city, address?.province].filter((part): part is string => Boolean(part)).join(", ") || "—";
}

/** A form field left blank is no value: the column is cleared with null, never filled with an empty string or a zero. */
export function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

export function integerOrNull(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

export interface EmployerRow {
  id: string;
  name: string;
  legalName: string | null;
  employerType: string;
  status: string;
  businessNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  mainAddress: Address | null;
  totalEmployees: number | null;
  unionizedEmployees: number | null;
  notes: string | null;
}

export function toEmployerRow(raw: unknown): EmployerRow {
  const row = asRecord(raw, "employer");
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    legalName: optionalString(row, "legalName"),
    employerType: requiredString(row, "employerType"),
    status: requiredString(row, "status"),
    businessNumber: optionalString(row, "businessNumber"),
    email: optionalString(row, "email"),
    phone: optionalString(row, "phone"),
    website: optionalString(row, "website"),
    mainAddress: toAddress(row.mainAddress ?? null),
    totalEmployees: countOrNull(row, "totalEmployees"),
    unionizedEmployees: countOrNull(row, "unionizedEmployees"),
    notes: optionalString(row, "notes"),
  };
}

/** The route leaves the site manager, the notes and the custom fields out of a worksite, so none of them is read or rewritten here. */
export interface WorksiteRow {
  id: string;
  employerId: string;
  name: string;
  code: string | null;
  status: string;
  address: Address | null;
  employeeCount: number | null;
}

export function toWorksiteRow(raw: unknown): WorksiteRow {
  const row = asRecord(raw, "worksite");
  return {
    id: requiredString(row, "id"),
    employerId: requiredString(row, "employerId"),
    name: requiredString(row, "name"),
    code: optionalString(row, "code"),
    status: requiredString(row, "status"),
    address: toAddress(row.address ?? null),
    employeeCount: countOrNull(row, "employeeCount"),
  };
}

export interface UnitRow {
  id: string;
  employerId: string;
  name: string;
  status: string;
}

export function toUnitRow(raw: unknown): UnitRow {
  const row = asRecord(raw, "bargaining unit");
  return {
    id: requiredString(row, "id"),
    employerId: requiredString(row, "employerId"),
    name: requiredString(row, "name"),
    status: requiredString(row, "status"),
  };
}

/** The route leaves the notes and the custom fields out of a committee, so neither is read or rewritten here. */
export interface CommitteeRow {
  id: string;
  name: string;
  committeeType: string;
  status: string;
  isOrganizationWide: boolean;
  unitId: string | null;
  worksiteId: string | null;
  mandate: string | null;
  meetingFrequency: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  maxMembers: number | null;
  currentMemberCount: number | null;
  requiresAppointment: boolean;
  requiresElection: boolean;
  termLength: number | null;
  contactEmail: string | null;
  description: string | null;
}

export function toCommitteeRow(raw: unknown): CommitteeRow {
  const row = asRecord(raw, "committee");
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    committeeType: requiredString(row, "committeeType"),
    status: requiredString(row, "status"),
    isOrganizationWide: flagOrFalse(row, "isOrganizationWide"),
    unitId: optionalString(row, "unitId"),
    worksiteId: optionalString(row, "worksiteId"),
    mandate: optionalString(row, "mandate"),
    meetingFrequency: optionalString(row, "meetingFrequency"),
    meetingDay: optionalString(row, "meetingDay"),
    meetingTime: optionalString(row, "meetingTime"),
    meetingLocation: optionalString(row, "meetingLocation"),
    maxMembers: countOrNull(row, "maxMembers"),
    currentMemberCount: countOrNull(row, "currentMemberCount"),
    requiresAppointment: flagOrFalse(row, "requiresAppointment"),
    requiresElection: flagOrFalse(row, "requiresElection"),
    termLength: countOrNull(row, "termLength"),
    contactEmail: optionalString(row, "contactEmail"),
    description: optionalString(row, "description"),
  };
}

async function loadRows<T>(path: string, read: (raw: unknown) => T): Promise<T[]> {
  return (await fetchAllRows<unknown>(path)).map(read);
}

export const loadEmployers = () => loadRows("/api/employers", toEmployerRow);
export const loadWorksites = () => loadRows("/api/worksites", toWorksiteRow);
export const loadUnits = () => loadRows("/api/units", toUnitRow);
export const loadCommittees = () => loadRows("/api/committees", toCommitteeRow);

/** What to tell the user about a failure: the route's own explanation when there is one. */
export function failureText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== "" ? error.message : fallback;
}
