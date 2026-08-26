/**
 * CUPE 4373 demo — member persona resolver + member-scoped data filters.
 *
 * The demo fixture is steward-centric (every record is keyed on
 * `assignedSteward`, `worker`, etc.). For the member experience we want a
 * surface that shows only the items the logged-in member would see in real
 * life: their own messages, their own cases, and documents that are publicly
 * shareable with the bargaining unit.
 *
 * Because the fixture doesn't carry a member identity column, we map the
 * logged-in user to one of three personas by first-name match and fall back
 * to a deterministic anchor persona (Maya B.) so the surface always renders.
 */

import {
  demoCases,
  demoDocuments,
  inboxItems,
  type DemoCase,
  type DemoDocument,
  type InboxItem,
} from "@/lib/demo/cupe4373-demo";

export type DemoMemberPersonaKey = "maya" | "joseph" | "linda";

export type DemoMemberPersona = {
  key: DemoMemberPersonaKey;
  displayName: string; // matches inbox `from` + case `worker`
  firstName: string;
  role: string;
  unit: string;
};

const PERSONAS: Record<DemoMemberPersonaKey, DemoMemberPersona> = {
  maya: {
    key: "maya",
    displayName: "Maya B.",
    firstName: "Maya",
    role: "Registered Practical Nurse",
    unit: "Acute care services",
  },
  joseph: {
    key: "joseph",
    displayName: "Joseph T.",
    firstName: "Joseph",
    role: "Personal Support Worker",
    unit: "Long-Term Care",
  },
  linda: {
    key: "linda",
    displayName: "Linda G.",
    firstName: "Linda",
    role: "Registered Practical Nurse",
    unit: "5 East",
  },
};

const ANCHOR_PERSONA: DemoMemberPersonaKey = "maya";

/**
 * Resolve a logged-in user's name/email to a demo persona. Tries first-name
 * match (case-insensitive) against the persona list, then email-local-part,
 * then falls back to the anchor persona so the demo always has something to
 * render.
 */
export function resolveDemoMemberPersona(input: {
  fullName?: string | null;
  firstName?: string | null;
  email?: string | null;
}): DemoMemberPersona {
  const candidates: string[] = [];
  if (input.firstName) candidates.push(input.firstName);
  if (input.fullName) {
    const head = input.fullName.trim().split(/\s+/)[0];
    if (head) candidates.push(head);
  }
  if (input.email) {
    const local = input.email.split("@")[0] ?? "";
    candidates.push(local);
    // Common patterns: first.last, first_last
    const firstFromEmail = local.split(/[._-]/)[0];
    if (firstFromEmail) candidates.push(firstFromEmail);
  }

  for (const candidate of candidates) {
    const lower = candidate.trim().toLowerCase();
    if (!lower) continue;
    for (const persona of Object.values(PERSONAS)) {
      if (persona.firstName.toLowerCase() === lower) return persona;
    }
  }

  return PERSONAS[ANCHOR_PERSONA];
}

/** Inbox items the member would see: messages they sent + alerts on their cases. */
export function getMemberInboxItems(persona: DemoMemberPersona): InboxItem[] {
  const memberCaseIds = new Set(
    demoCases.filter((c) => c.worker === persona.displayName).map((c) => c.id),
  );

  return inboxItems.filter((item) => {
    // The member's own outbound messages
    if (item.channel === "member-message" && item.from === persona.displayName) {
      return true;
    }
    // Operational alerts tied to one of the member's cases
    if (
      item.channel === "operational-alert" &&
      item.linkedCaseId &&
      memberCaseIds.has(item.linkedCaseId)
    ) {
      return true;
    }
    // Case intake items filed *by* the member themselves
    if (
      item.channel === "case" &&
      item.fromContext.toLowerCase().includes(persona.displayName.toLowerCase())
    ) {
      return true;
    }
    return false;
  });
}

/** Cases where the member is the affected worker. */
export function getMemberCases(persona: DemoMemberPersona): DemoCase[] {
  return demoCases.filter((c) => c.worker === persona.displayName);
}

/**
 * Documents a member can see — only public/internal-shareable artifacts. We
 * intentionally exclude `team_confidential`, `case_restricted`, and
 * `privileged` documents (those are steward / Chief Steward scope).
 */
export function getMemberDocuments(): DemoDocument[] {
  return demoDocuments.filter((d) => d.privacyLabel === "public_internal");
}
