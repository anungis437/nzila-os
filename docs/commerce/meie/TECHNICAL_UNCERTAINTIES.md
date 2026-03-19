# MEIE — Fiche des incertitudes technologiques (DET)

> **Programme:** PARI-CNRC / IRAP  
> **Projet:** NZL-2026-COM  
> **Date:** 2026-02-24  

---

## Incertitudes technologiques identifiées

### IT-1 : Moteur de tarification déterministe avec conformité fiscale québécoise

**Énoncé :** Pouvait-on extraire la logique de tarification du système hérité
(`margin-solver.ts`) en un moteur à fonctions pures tout en maintenant la
précision fiscale bit-à-bit sous les règles de l'Agence du revenu du Québec ?

**Formule clé :**

```text
COGS = Σ(coûtUnitaire × quantité) + (emballage + main-d'œuvre + expédition) × nbBoîtes
PrixAvantTaxe = COGS ÷ (1 − margeObjectif%)
TPS = PrixAvantTaxe × tauxTPS                          (5%)
TVQ = (PrixAvantTaxe + TPS) × tauxTVQ                  (9,975%)
PrixFinal = PrixAvantTaxe + TPS + TVQ
```

**Résolution :** Le moteur `@nzila/pricing-engine` implémente la formule comme
un ensemble de fonctions pures avec typage strict (`PricingResult<T>` — union
discriminée succès/erreur). Les tests vérifient la conformité avec l'ordre de
calcul ARQ (TVQ appliquée sur base + TPS).

**Référence code :**
[`packages/pricing-engine/src/pricing-engine.ts`](../../packages/pricing-engine/src/pricing-engine.ts)
lignes 73–140

**État :** ✅ **Résolue**

---

### IT-2 : Orchestration par machines à états déclaratives

**Énoncé :** Pouvait-on remplacer la gestion procédurale du cycle de vie
commercial (chaînes if/else dans `workflow-engine.ts`) par des machines à
états déclaratives composables avec des gardes de gouvernance enfichables ?

**Résolution :** Le paquet `@nzila/commerce-state` implémente des machines à
états paramétriques avec :

- Transitions déclarées comme données (tableau de `TransitionDef`)
- Gardes évaluées séquentiellement (interface `Guard<TState, TEntity>`)
- Résultats typés (`TransitionResult<TState>` — union discriminée)
- Fonction `attemptTransition()` agnostique de l'entité
- Fonction `getAvailableTransitions()` pour l'UI

**Référence code :** [`packages/commerce-state/`](../../packages/commerce-state/)

**État :** ✅ **Résolue**

---

### IT-3 : Piste d'audit à chaîne de hachage

**Énoncé :** L'intégration d'une piste d'audit résistante à la falsification
au niveau du cadre de commerce (pas comme couche externe) était-elle
réalisable sans impact de performance inacceptable ?

**Résolution :** Le paquet `@nzila/commerce-audit` fournit :

- `buildTransitionAuditEntry()` — produit une entrée d'audit pour chaque
  transition de machine à états
- `buildActionAuditEntry()` — pour les actions non-transition (CRUD)
- `hashAuditEntry()` — hachage SHA-256 pour chaînage
- `computeAuditTrailHash()` — hachage agrégé de la piste
- `COMMERCE_CONTROL_MAPPINGS` — mappage vers les familles de contrôle OS-core

Le paquet `@nzila/commerce-evidence` construit des paquets de preuves
scellés via le pipeline d'evidence de `@nzila/os-core`.

**Référence code :**

- [`packages/commerce-audit/src/audit.ts`](../../packages/commerce-audit/src/audit.ts)
- [`packages/commerce-evidence/src/evidence.ts`](../../packages/commerce-evidence/src/evidence.ts)

**État :** ✅ **Résolue**

---

### IT-4 : Migration sans perte avec isolation par organisation

**Énoncé :** Les données héritées (réparties sur 6+ tables Supabase avec
schémas incohérents, types dupliqués, et frontières client/utilisateur
floues) pouvaient-elles être migrées sans perte vers le modèle NzilaOS
tout en établissant l'isolation par organisation ?

**Défis identifiés :**

- Deux définitions de type `Product` incompatibles dans le système hérité
- Colonne `proposals` JSONB dans `quotes` vs table `proposals` séparée
- Mélange `import.meta.env.VITE_*` (client) et `process.env.*` (serveur)
- 26 des 31 fichiers source utilisent `console.log`
- Pas de notion d'organisation dans le modèle hérité

**Résolution :** Le paquet `@nzila/shop-quoter` (désormais supersédé par `apps/flow`) résout via :

1. Schémas Zod pour validation au point d'entrée
2. Fonctions de mappage pures avec repli sûr pour valeurs inconnues
3. Préservation des ID héritées dans `externalIds`/`metadata`
4. Mode de validation préliminaire (dry-run) pour pré-vérification
5. Import par lot avec rapports de diagnostic par enregistrement
6. Injection de `OrgContext.orgId` pour chaque opération

**Référence code :** [`apps/flow/`](../../apps/flow/) (supersède `packages/shop-quoter/`)

**État :** ✅ **Résolue**

---

### IT-5 : Portes de gouvernance configurables par organisation

**Énoncé :** Pouvait-on implémenter des règles de gouvernance commerciale
(seuils d'approbation, marges plancher, plafonds de remise) comme des
gardes composables intégrées aux machines à états, configurables par
organisation ?

**Résolution :** Le paquet `@nzila/commerce-governance` implémente :

- `createApprovalRequiredGate()` — bloque l'acceptation au-delà du seuil
- `createMarginFloorGate()` — bloque la sortie de tarification si marge insuffisante
- `createDiscountCapGate()` — limite les remises selon le rôle
- `createQuoteValidityGate()` — valide la période de validité
- `createQuoteCompletenessGate()` — vérifie la présence de lignes
- `createOrderCompletenessGate()` — nombre minimum de lignes
- `createHighValueGate()` — exige un rôle élevé pour les transactions importantes
- `withGovernanceGates()` — injecte les gardes dans une définition de machine

Toutes les gardes sont des prédicats purs. Les seuils sont configurables
via `GovernancePolicy`, résolue avec des défauts sensibles via `resolvePolicy()`.

**Référence code :** [`packages/commerce-governance/src/gates.ts`](../../packages/commerce-governance/src/gates.ts)

**État :** ✅ **Résolue**

---

## Tableau récapitulatif

| IT | Incertitude | État | Livrable principal |
|----|-----------|------|--------------------|
| IT-1 | Tarification déterministe | ✅ Résolue | `@nzila/pricing-engine` |
| IT-2 | Machines à états | ✅ Résolue | `@nzila/commerce-state` |
| IT-3 | Piste d'audit à chaîne de hachage | ✅ Résolue | `@nzila/commerce-audit` + `@nzila/commerce-evidence` |
| IT-4 | Migration sans perte | ✅ Résolue | `apps/flow` (ex `@nzila/shop-quoter`) |
| IT-5 | Portes de gouvernance | ✅ Résolue | `@nzila/commerce-governance` |

---

*Document préparé conformément aux exigences du programme PARI-CNRC / IRAP
pour la documentation des incertitudes technologiques.*
