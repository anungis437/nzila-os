# 17 - Gate 6 Bilingual Mobile Recording Readiness

## Gate Status

`LIUNA_GATE_6_BILINGUAL_MOBILE_RECORDING = READY_WITH_LIMITATIONS`

This gate prepares bilingual recording language and mobile recording constraints. It does not prove full bilingual production UI readiness or a completed mobile E2E journey.

## English Recording Language

Required opening:
"This is a synthetic executive walkthrough for discussion. It does not use LIUNA production data and does not represent a LIUNA deployment, endorsement, or legal compliance certification."

Required continuity wording:
"Union Eyes helps an authorized successor review selected matters, documents, deadlines, history, and next actions when institutional responsibilities change."

Required confidentiality wording:
"Restricted records remain governed by configured access rules. Privileged or highly sensitive records require explicit authority and further validation before any sensitive pilot."

Required central/local wording:
"Central visibility can be configured for summary oversight without assuming unrestricted access to raw local records."

## French-Canadian Recording Language

Required opening:
"Il s'agit d'une presentation synthetique pour discussion. Elle n'utilise pas de donnees de production de LIUNA et ne represente pas un deploiement, une approbation ou une certification juridique de LIUNA."

Required continuity wording:
"Union Eyes aide un successeur autorise a examiner des dossiers selectionnes, les documents, les echeances, l'historique et les prochaines actions lorsque les responsabilites institutionnelles changent."

Required confidentiality wording:
"Les dossiers restreints demeurent regis par les regles d'acces configurees. Les dossiers privilegies ou hautement sensibles exigent une autorite explicite et une validation supplementaire avant tout projet pilote sensible."

Required central/local wording:
"La visibilite centrale peut etre configuree pour une surveillance sommaire sans supposer un acces illimite aux dossiers locaux bruts."

## Mobile Recording Constraints

If the recording uses a mobile viewport:
- use only the synthetic scenario from Gate 1;
- show short labels and avoid dense legal wording on-screen;
- narrate limitations rather than placing them in small mobile text;
- avoid claiming French/mobile completion unless the exact mobile flow is executed;
- avoid using CUPE, CLC convention, or other prior-pilot labels as LIUNA proof.

## Vocabulary Lock

Allowed terms:
- institutional continuity;
- successor reviewer;
- authorized access;
- central summary visibility;
- local raw-detail boundary;
- synthetic scenario;
- discovery.

Avoid in spoken or visual copy:
- built for LIUNA;
- approved by LIUNA;
- privilege-safe;
- fully compliant;
- complete legal hold;
- AI decides;
- central leaders can see everything.

## Validation

`tooling/contract-tests/liuna-readiness-pack-contract.test.ts` verifies:
- all LIUNA readiness pack files exist;
- the recording script includes required disclaimers;
- the claim lock preserves blocked claims;
- the bilingual/mobile gate preserves English and French-Canadian required wording;
- the pack keeps LIUNA tenant, endorsement, legal-compliance, and production-readiness caveats visible.

`apps/union-eyes/e2e/liuna-bilingual-mobile-transition.spec.ts` now defines the product-level proof hook for English and French-Canadian mobile continuity/case/document routes at a phone viewport.

Local execution on 2026-08-27 passed both locales after resolving the Union Eyes Next config dependency boundary: `immutable` was added as a direct `apps/union-eyes` dependency and the webpack `js-yaml` alias was switched to the package-root export (`require.resolve('js-yaml')`) to comply with the js-yaml exports map. Both `en-CA` and `fr-CA` continuity/case/document routes now render at the phone viewport with no horizontal overflow and no forbidden engineering vocabulary in the rendered copy.

This is now classified as `CLOSED_FOR_TARGETED_MOBILE_ROUTE_SET`, bounded to the continuity/case/document route set exercised by the E2E.

## Claim Impact

Allowed after this gate:
- "The LIUNA recording pack includes English and French-Canadian wording."
- "Mobile recording use is bounded by a written constraint checklist."
- "The pack has a contract test protecting required disclaimers and claim locks."
- "The targeted bilingual mobile continuity/case/document route set has been executed at a phone viewport in both `en-CA` and `fr-CA`."

Still prohibited:
- "The full LIUNA mobile UI journey is proven."
- "The product is fully bilingual for LIUNA operations."
- "The recording can omit limitations because they are covered elsewhere."
