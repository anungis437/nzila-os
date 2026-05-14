
// One-shot script: synchronise en/fr/en-CA/fr-CA messages.
//   - Add 19 missing keys to en.json + fr.json (mirror en-CA / fr-CA shape)
//   - Restore proper FR diacritics in fr-CA.json (and seed fr.json with diacritics)
// Idempotent: safe to re-run.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const messagesDir = path.resolve(here, "..", "messages");

const PHASE6_PILOT_EN = {
  leadershipTitle: "Leadership transition continuity scenarios",
  frictionTitle: "Governance friction simulation flows",
  onboardingTitle: "Onboarding continuity intelligence",
  federationTitle: "Federation-scale continuity scenarios",
  decisionTitle: "Executive decision pathway systems",
  stabilizationMoveLabel: "Stabilization move:",
  manageThroughLabel: "Manage through:",
};

const PHASE6_TRUST_EN = {
  tabScenario: "Scenario Intelligence",
  leadershipTitle: "Leadership transition continuity scenarios",
  leadershipDesc:
    "These scenarios model familiar institutional transition moments and show calm continuity responses that preserve governance coherence.",
  frictionTitle: "Governance friction simulation flows",
  disruptionTitle: "Operational disruption modeling",
  stabilizationTitle: "Organizational stabilization simulation",
  committeeTitle: "Committee coordination simulations",
  stabilizationMoveLabel: "Stabilization move:",
  manageThroughLabel: "Manage through:",
  stabilizeWithLabel: "Stabilize with:",
};

const PHASE6_PILOT_FR = {
  leadershipTitle: "Scénarios de continuité lors des transitions de leadership",
  frictionTitle: "Flux de simulation des frictions de gouvernance",
  onboardingTitle: "Intelligence de continuité pour l’intégration",
  federationTitle: "Scénarios de continuité à l’échelle fédérative",
  decisionTitle: "Systèmes de parcours de décision exécutive",
  stabilizationMoveLabel: "Action de stabilisation :",
  manageThroughLabel: "Gérer par :",
};

const PHASE6_TRUST_FR = {
  tabScenario: "Intelligence de scénarios",
  leadershipTitle: "Scénarios de continuité lors des transitions de leadership",
  leadershipDesc:
    "Ces scénarios reflètent des transitions institutionnelles réelles et montrent des réponses calmes qui préservent la cohérence de gouvernance.",
  frictionTitle: "Flux de simulation des frictions de gouvernance",
  disruptionTitle: "Modélisation des perturbations opérationnelles",
  stabilizationTitle: "Simulation de stabilisation organisationnelle",
  committeeTitle: "Simulations de coordination des comités",
  stabilizationMoveLabel: "Action de stabilisation :",
  manageThroughLabel: "Gérer par :",
  stabilizeWithLabel: "Stabiliser avec :",
};

const NAV_PROOF_EN = "Proof";
const NAV_PROOF_FR = "Preuves";
const FOOTER_INSTPROOF_EN = "Institutional Proof";
const FOOTER_INSTPROOF_FR = "Preuves institutionnelles";

/**
 * Insert `entries` (object) into `target` immediately after the key `afterKey`,
 * preserving order. If `afterKey` not found, appends at end.
 * Existing keys are overwritten with the new value.
 */
function insertAfter(target, afterKey, entries) {
  const out = {};
  let inserted = false;
  for (const [k, v] of Object.entries(target)) {
    if (entries.hasOwnProperty(k)) continue; // skip; will be re-added in proper position
    out[k] = v;
    if (k === afterKey) {
      for (const [nk, nv] of Object.entries(entries)) out[nk] = nv;
      inserted = true;
    }
  }
  if (!inserted) {
    for (const [nk, nv] of Object.entries(entries)) out[nk] = nv;
  }
  return out;
}

function patch(file, lang) {
  const allowedFiles = new Set(["en.json", "fr.json", "en-CA.json", "fr-CA.json"]);
  if (!allowedFiles.has(file)) {
    throw new Error(`Disallowed file argument: ${file}`);
  }

  const filePaths = {
    "en.json": path.join(messagesDir, "en.json"),
    "fr.json": path.join(messagesDir, "fr.json"),
    "en-CA.json": path.join(messagesDir, "en-CA.json"),
    "fr-CA.json": path.join(messagesDir, "fr-CA.json"),
  };

  const filePath = filePaths[file];
  // nosemgrep
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const m = json.marketing;

  const navProof = lang.startsWith("fr") ? NAV_PROOF_FR : NAV_PROOF_EN;
  const footerProof = lang.startsWith("fr") ? FOOTER_INSTPROOF_FR : FOOTER_INSTPROOF_EN;
  const pilot = lang.startsWith("fr") ? PHASE6_PILOT_FR : PHASE6_PILOT_EN;
  const trust = lang.startsWith("fr") ? PHASE6_TRUST_FR : PHASE6_TRUST_EN;

  // marketing.nav.proof — after "insights"
  m.nav = insertAfter(m.nav, "insights", { proof: navProof });

  // marketing.footer.institutionalProof — after "insights"
  m.footer = insertAfter(m.footer, "insights", { institutionalProof: footerProof });

  // marketing.pilotRequest.phase6 — after "step6"
  m.pilotRequest = insertAfter(m.pilotRequest, "step6", { phase6: pilot });

  // marketing.trust.phase6 — append (after defensibilityDesc which is last)
  m.trust = insertAfter(m.trust, "defensibilityDesc", { phase6: trust });

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log("patched:", file);
}

patch("en.json", "en");
patch("fr.json", "fr");
patch("en-CA.json", "en");
patch("fr-CA.json", "fr");

console.log("done");
