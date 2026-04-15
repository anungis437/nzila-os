import { sql } from "drizzle-orm";
import { db } from "../../db";
import type { EvidenceChainLink, EvidenceChainVerification } from "./types";

function toEvidenceChainLink(value: unknown): EvidenceChainLink | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const linkId = typeof record.linkId === "string" ? record.linkId : "";
  const organizationId = typeof record.organizationId === "string" ? record.organizationId : "";
  const entityType =
    record.entityType === "payroll_run" ||
    record.entityType === "remittance_run" ||
    record.entityType === "replay" ||
    record.entityType === "approval" ||
    record.entityType === "adjustment_run"
      ? record.entityType
      : null;
  const entityId = typeof record.entityId === "string" ? record.entityId : "";
  const manifestHash = typeof record.manifestHash === "string" ? record.manifestHash : "";
  const sealHash = typeof record.sealHash === "string" ? record.sealHash : "";

  if (!linkId || !organizationId || !entityType || !entityId || !manifestHash || !sealHash) {
    return null;
  }

  return {
    linkId,
    organizationId,
    entityType,
    entityId,
    parentLinkId: typeof record.parentLinkId === "string" ? record.parentLinkId : null,
    parentSealHash: typeof record.parentSealHash === "string" ? record.parentSealHash : null,
    manifestHash,
    sealHash,
    chainDepth: typeof record.chainDepth === "number" ? record.chainDepth : 1,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
  };
}

export function verifyEvidenceChainLinks(links: EvidenceChainLink[]): EvidenceChainVerification {
  if (links.length === 0) {
    return { valid: false, checkedLinks: 0, issues: ["No chain links found"] };
  }

  const byId = new Map(links.map((link) => [link.linkId, link]));
  const issues: string[] = [];
  let checkedLinks = 0;
  let brokenAt: string | undefined;

  for (const link of links) {
    checkedLinks += 1;
    if (!link.parentLinkId) continue;

    const parent = byId.get(link.parentLinkId);
    if (!parent) {
      brokenAt = brokenAt ?? link.linkId;
      issues.push(`Missing parent link ${link.parentLinkId} for ${link.linkId}`);
      continue;
    }

    if (parent.sealHash !== link.parentSealHash) {
      brokenAt = brokenAt ?? link.linkId;
      issues.push(`Parent seal hash mismatch for ${link.linkId}`);
    }

    if (link.chainDepth !== parent.chainDepth + 1) {
      brokenAt = brokenAt ?? link.linkId;
      issues.push(`Invalid chain depth transition for ${link.linkId}`);
    }
  }

  return {
    valid: issues.length === 0,
    checkedLinks,
    brokenAt,
    issues,
  };
}

export async function verifyEmployerExecutionEvidenceChain(
  organizationId: string,
  entityType: EvidenceChainLink["entityType"],
  entityId: string,
): Promise<EvidenceChainVerification> {
  const artifacts = await db.execute(
    sql`
      select manifest_json
      from employer_execution_artifacts
      where organization_id = ${organizationId}
        and artifact_type = 'evidence_manifest'
    `,
  );

  const links = artifacts
    .map((artifact) =>
      toEvidenceChainLink(((artifact as { manifest_json?: Record<string, unknown> }).manifest_json ?? {}).chainLink),
    )
    .filter((value): value is EvidenceChainLink => value !== null);

  const target = links.find((link) => link.entityType === entityType && link.entityId === entityId);
  if (!target) {
    return {
      valid: false,
      checkedLinks: 0,
      brokenAt: entityId,
      issues: [`No evidence chain link found for ${entityType}:${entityId}`],
    };
  }

  const walk: EvidenceChainLink[] = [];
  const byId = new Map(links.map((link) => [link.linkId, link]));
  let current: EvidenceChainLink | undefined = target;

  while (current) {
    walk.push(current);
    if (!current.parentLinkId) break;
    current = byId.get(current.parentLinkId);
    if (!current) break;
  }

  return verifyEvidenceChainLinks(walk);
}
