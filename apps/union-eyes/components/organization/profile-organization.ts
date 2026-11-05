/**
 * What the components that show where the signed-in user stands in the organization hierarchy read from the application's own routes.
 *
 * Both routes answer plain JSON, not withApi's envelope: GET /api/users/me/profile gives { organization: { id, name, slug, type } | null } and
 * GET /api/organizations/{id}/path gives { data: [organization...] }, with omittedAncestorCount when the caller may not see every ancestor.
 * A failed call or a body that is neither is an error for the caller to show: a path that could not be read is not an empty path, and a profile
 * that could not be read is not a profile with no organization.
 */
import { ApiShapeError, isRecord, readApiError } from "@/lib/client/api-envelope";
import { asRecord, optionalString, requiredString } from "@/lib/client/row-fields";

export interface ProfileOrganization {
  id: string;
  name: string;
  slug: string | null;
  type: string | null;
}

export interface OrganizationPath {
  entries: { id: string; name: string }[];
  /** Ancestors the caller may not see: the path starts below them. */
  omittedAncestors: number;
}

export const reasonOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : "The request failed");

async function readJson(path: string): Promise<unknown> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  return response.json();
}

/** The organization the profile names, or null when it names none. */
export async function readProfileOrganization(): Promise<ProfileOrganization | null> {
  const body = await readJson("/api/users/me/profile");
  if (!isRecord(body) || body.organization === undefined) throw new ApiShapeError("no organization");
  if (body.organization === null) return null;
  const organization = asRecord(body.organization, "organization");
  return {
    id: requiredString(organization, "id"),
    name: requiredString(organization, "name"),
    slug: optionalString(organization, "slug"),
    type: optionalString(organization, "type"),
  };
}

/** The organizations from the top of the hierarchy down to the one asked for. */
export async function readOrganizationPath(organizationId: string): Promise<OrganizationPath> {
  const body = await readJson(`/api/organizations/${encodeURIComponent(organizationId)}/path`);
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no path");
  const entries = body.data.map((raw) => {
    const row = asRecord(raw, "organization");
    return { id: requiredString(row, "id"), name: requiredString(row, "name") };
  });
  const omitted = body.omittedAncestorCount;
  if (omitted !== undefined && (typeof omitted !== "number" || !Number.isInteger(omitted) || omitted < 0)) {
    throw new ApiShapeError("omittedAncestorCount is not a count");
  }
  return { entries, omittedAncestors: omitted ?? 0 };
}
