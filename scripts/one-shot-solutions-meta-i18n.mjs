/**
 * One-shot idempotent script: adds marketing.solutions metadata keys
 * to apps/union-eyes/messages/en-CA.json and fr-CA.json.
 *
 * Run: node scripts/one-shot-solutions-meta-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'apps', 'union-eyes', 'messages');

const enSolutions = {
  index: {
    metaTitle: "Solutions | UnionEyes",
    metaDescription: "Institutional continuity and governance intelligence solutions for every stakeholder: union executives, governance leaders, operations, technology, policy, and procurement.",
  },
  executive: {
    metaTitle: "Union Executive Leadership | Solutions | UnionEyes",
    metaDescription: "Preserve strategic continuity, lead through leadership transitions, and maintain institutional coherence. UnionEyes for union executive leaders.",
  },
  governance: {
    metaTitle: "Governance Leadership | Solutions | UnionEyes",
    metaDescription: "Modernize governance operations with explainable intelligence, full audit trails, and democratic oversight controls. UnionEyes for governance leaders.",
  },
  operations: {
    metaTitle: "Operations Leadership | Solutions | UnionEyes",
    metaDescription: "Maintain operational coherence across distributed teams and leadership transitions. UnionEyes for operations leaders.",
  },
  labour: {
    metaTitle: "Policy & Labour Leadership | Solutions | UnionEyes",
    metaDescription: "Advance labour-safe modernization with human oversight, anti-surveillance safeguards, and democratic governance controls.",
  },
  technology: {
    metaTitle: "Technology Leadership | Solutions | UnionEyes",
    metaDescription: "Governance-safe AI with full explainability, enterprise security, and Canadian data residency. UnionEyes for technology leaders in labour organizations.",
  },
  procurement: {
    metaTitle: "Procurement Stakeholders | Solutions | UnionEyes",
    metaDescription: "Procurement-ready governance, clear implementation scope, and measurable value for institutional deployments.",
  },
};

const frSolutions = {
  index: {
    metaTitle: "Solutions | UnionEyes",
    metaDescription: "Solutions de continuit\u00e9 institutionnelle et d\u2019intelligence de gouvernance pour chaque partie prenante\u00a0: dirigeants syndicaux, responsables de gouvernance, op\u00e9rations, technologie, politiques et approvisionnement.",
  },
  executive: {
    metaTitle: "Direction ex\u00e9cutive syndicale | Solutions | UnionEyes",
    metaDescription: "Pr\u00e9servez la continuit\u00e9 strat\u00e9gique, dirigez \u00e0 travers les transitions de leadership et maintenez la coh\u00e9rence institutionnelle. UnionEyes pour les dirigeants syndicaux.",
  },
  governance: {
    metaTitle: "Direction de la gouvernance | Solutions | UnionEyes",
    metaDescription: "Modernisez les op\u00e9rations de gouvernance avec une intelligence explicable, des pistes d\u2019audit compl\u00e8tes et des contr\u00f4les de surveillance d\u00e9mocratique. UnionEyes pour les responsables de gouvernance.",
  },
  operations: {
    metaTitle: "Direction des op\u00e9rations | Solutions | UnionEyes",
    metaDescription: "Maintenez la coh\u00e9rence op\u00e9rationnelle \u00e0 travers les \u00e9quipes distribu\u00e9es et les transitions de leadership. UnionEyes pour les responsables des op\u00e9rations.",
  },
  labour: {
    metaTitle: "Direction des politiques et du travail | Solutions | UnionEyes",
    metaDescription: "Faites progresser la modernisation respectueuse du travail avec une surveillance humaine, des protections contre la surveillance et des contr\u00f4les de gouvernance d\u00e9mocratique.",
  },
  technology: {
    metaTitle: "Direction technologique | Solutions | UnionEyes",
    metaDescription: "IA gouvern\u00e9e en toute s\u00e9curit\u00e9 avec explicabilit\u00e9 compl\u00e8te, s\u00e9curit\u00e9 d\u2019entreprise et r\u00e9sidence des donn\u00e9es au Canada. UnionEyes pour les responsables technologiques des organisations syndicales.",
  },
  procurement: {
    metaTitle: "Parties prenantes \u00e0 l\u2019approvisionnement | Solutions | UnionEyes",
    metaDescription: "Gouvernance pr\u00eate pour l\u2019approvisionnement, p\u00e9rim\u00e8tre d\u2019impl\u00e9mentation clair et valeur mesurable pour les d\u00e9ploiements institutionnels.",
  },
};

function patch(file, solutions) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!data.marketing) data.marketing = {};
  // Idempotent: overwrite solutions sub-object entirely
  data.marketing.solutions = solutions;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`patched ${file.split(/[/\\]/).slice(-3).join('/')}`);
}

patch(join(root, 'en-CA.json'), enSolutions);
patch(join(root, 'fr-CA.json'), frSolutions);
