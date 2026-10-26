// ============================================================================
// REPRESENTATION PROTOCOL — CONFIGURATION SERVICE
// ============================================================================
// Server-side service for reading / writing the per-org representation
// protocol from `org_configurations`.
//
// Storage key:  category = "grievance", key = "representation_protocol"
// ============================================================================

import { db } from "@/db/db";
import { eq, and } from "drizzle-orm";
import { orgConfigurations } from "@/db/schema";
import { withRLSContext, type RLSTx } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import {
  type RepresentationProtocol,
  type ProtocolResolution,
  resolveStoredProtocol,
} from "./protocol-types";

const CONFIG_CATEGORY = "grievance";
const CONFIG_KEY = "representation_protocol";

export class RepresentationProtocolNotExecutableError extends Error {
  readonly code = "REPRESENTATION_PROTOCOL_NOT_EXECUTABLE";
  constructor(readonly status: string, readonly reason: string) {
    super(`Representation protocol is not executable (${status}: ${reason}).`);
    this.name = "RepresentationProtocolNotExecutableError";
  }
}

const protocolRow = (organizationId: string) =>
  and(
    eq(orgConfigurations.organizationId, organizationId),
    eq(orgConfigurations.category, CONFIG_CATEGORY),
    eq(orgConfigurations.key, CONFIG_KEY),
  );

async function readProtocolValue(organizationId: string): Promise<unknown | null> {
  const row = await db.query.orgConfigurations.findFirst({ where: protocolRow(organizationId) });
  return row?.value ?? null;
}

/** Reads the stored value and locks the row, so a decision is made against the value it will replace. */
async function readProtocolValueForUpdate(tx: RLSTx, organizationId: string): Promise<unknown | null> {
  const [row] = await tx.select().from(orgConfigurations).where(protocolRow(organizationId)).for("update");
  return row?.value ?? null;
}

// ============================================================================
// READ
// ============================================================================

/**
 * Resolve the protocol together with whether it may be used as institutional authority.
 */
export async function resolveRepresentationProtocol(
  organizationId: string,
): Promise<ProtocolResolution> {
  return resolveStoredProtocol(await readProtocolValue(organizationId));
}

/**
 * Authority-bearing callers (assignment, filing, escalation) must use this.
 * Fails closed when the protocol is missing, malformed, unapproved or self-approved.
 */
export async function requireExecutableRepresentationProtocol(
  organizationId: string,
): Promise<RepresentationProtocol> {
  const resolution = await resolveRepresentationProtocol(organizationId);
  if (!resolution.executable) {
    throw new RepresentationProtocolNotExecutableError(resolution.status, resolution.reason);
  }
  return resolution.protocol;
}

/**
 * DISPLAY ONLY. Falls back to the steward-led default when nothing valid is configured,
 * so the result must never be used to authorize an action. Use
 * `requireExecutableRepresentationProtocol` for authority.
 */
export async function getRepresentationProtocol(
  organizationId: string,
): Promise<RepresentationProtocol> {
  return (await resolveRepresentationProtocol(organizationId)).protocol;
}

// ============================================================================
// WRITE
// ============================================================================

/**
 * Save (upsert) the representation protocol for an organization.
 *
 * Any save replaces the stored value and therefore clears prior approval: the new
 * configuration is `pending_approval` until a different administrator approves it.
 */
export async function saveRepresentationProtocol(
  organizationId: string,
  protocol: RepresentationProtocol,
  updatedBy: string,
): Promise<void> {
  const configured: RepresentationProtocol = {
    ...protocol,
    approval: { configuredBy: updatedBy, configuredAt: new Date().toISOString() },
  };
  // The new configuration and its audit record commit together.
  await withRLSContext({ organizationId }, async (tx) => {
    await tx
      .insert(orgConfigurations)
      .values({
        organizationId,
        category: CONFIG_CATEGORY,
        key: CONFIG_KEY,
        value: configured,
        description: "Per-union representation protocol — defines who files and manages grievances.",
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [orgConfigurations.organizationId, orgConfigurations.category, orgConfigurations.key],
        set: { value: configured, updatedBy, updatedAt: new Date() },
      });
    await persistAtomicAudit(tx, {
      organizationId,
      userId: updatedBy,
      action: "representation_protocol.save",
      resourceType: "org_configurations",
      resourceId: CONFIG_KEY,
      details: { primaryRepresentative: protocol.primaryRepresentative, status: "pending_approval" },
    });
  });
}

export type ProtocolApprovalResult =
  | { ok: true; approvedAt: string }
  | { ok: false; code: "NOT_FOUND" | "NOT_PENDING" | "SELF_APPROVAL_FORBIDDEN"; message: string };

/**
 * Controlled adoption of a historical (pre-provenance) configuration: the settings are preserved
 * exactly, the submitting administrator becomes the recorded author, and approval is still
 * required from a different administrator. Nothing is approved automatically.
 */
export async function submitLegacyRepresentationProtocolForApproval(
  organizationId: string,
  submitterId: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_LEGACY"; message: string }> {
  return withRLSContext({ organizationId }, async (tx) => {
    const current = resolveStoredProtocol(await readProtocolValueForUpdate(tx, organizationId));
    if (current.status !== "legacy_unapproved") {
      return { ok: false as const, code: "NOT_LEGACY" as const, message: "Only a historical configuration without provenance can be submitted this way." };
    }
    const submitted: RepresentationProtocol = {
      ...current.protocol,
      approval: { configuredBy: submitterId, configuredAt: new Date().toISOString() },
    };
    await tx.update(orgConfigurations).set({ value: submitted, updatedAt: new Date() }).where(protocolRow(organizationId));
    await persistAtomicAudit(tx, {
      organizationId,
      userId: submitterId,
      action: "representation_protocol.submit_legacy",
      resourceType: "org_configurations",
      resourceId: CONFIG_KEY,
      details: { status: "pending_approval" },
    });
    return { ok: true as const };
  });
}

/**
 * Independent approval of the currently stored protocol. The approver must differ
 * from whoever configured it.
 */
export async function approveRepresentationProtocol(
  organizationId: string,
  approverId: string,
): Promise<ProtocolApprovalResult> {
  // The stored value is locked while it is judged, so what is approved is exactly what the approver's decision was
  // made against; a save that lands in between waits and is then judged on its own.
  return withRLSContext({ organizationId }, async (tx): Promise<ProtocolApprovalResult> => {
    const current = resolveStoredProtocol(await readProtocolValueForUpdate(tx, organizationId));
    if (current.status === "missing" || current.status === "invalid") {
      return { ok: false, code: "NOT_FOUND", message: "No valid protocol configuration is awaiting approval." };
    }
    if (current.status === "legacy_unapproved") {
      return { ok: false, code: "NOT_FOUND", message: "A historical configuration must first be submitted for approval by an administrator." };
    }
    if (current.status === "approved") {
      return { ok: false, code: "NOT_PENDING", message: "The current protocol is already approved." };
    }
    const configuredBy = current.protocol.approval?.configuredBy;
    if (!configuredBy || configuredBy === approverId) {
      return { ok: false, code: "SELF_APPROVAL_FORBIDDEN", message: "A protocol must be approved by someone other than its author." };
    }
    const approvedAt = new Date().toISOString();
    const approved: RepresentationProtocol = {
      ...current.protocol,
      approval: { ...current.protocol.approval!, approvedBy: approverId, approvedAt },
    };
    await tx.update(orgConfigurations).set({ value: approved, updatedAt: new Date() }).where(protocolRow(organizationId));
    await persistAtomicAudit(tx, {
      organizationId,
      userId: approverId,
      action: "representation_protocol.approve",
      resourceType: "org_configurations",
      resourceId: CONFIG_KEY,
      details: { configuredBy, primaryRepresentative: current.protocol.primaryRepresentative },
    });
    return { ok: true, approvedAt };
  });
}

// ============================================================================
// DELETE (reset to default)
// ============================================================================

/**
 * Remove the custom protocol, reverting the org to the default steward-led model.
 */
export async function resetRepresentationProtocol(
  organizationId: string,
  actorUserId: string,
): Promise<void> {
  await withRLSContext({ organizationId }, async (tx) => {
    await tx.delete(orgConfigurations).where(protocolRow(organizationId));
    await persistAtomicAudit(tx, {
      organizationId,
      userId: actorUserId,
      action: "representation_protocol.reset",
      resourceType: "org_configurations",
      resourceId: CONFIG_KEY,
      details: {},
    });
  });
}
