# MEIE Work Package — Commerce Engine Modernisation

> **Programme:** MEIE — Programme d'aide à la recherche industrielle (PARI-CNRC / IRAP)  
> **Projet:** Modernisation du moteur de commerce NzilaOS  
> **Numéro de projet:** NZL-2026-COM  
> **Date:** 2026-02-24  
> **Responsable:** NzilaOS Engineering  

---

## Table des matières

1. [Sommaire du lot de travail](#1-sommaire-du-lot-de-travail)
2. [Objectifs techniques](#2-objectifs-techniques)
3. [Description des travaux](#3-description-des-travaux)
4. [Livrables](#4-livrables)
5. [Jalons et échéancier](#5-jalons-et-échéancier)
6. [Indicateurs de performance](#6-indicateurs-de-performance)
7. [Registre des risques](#7-registre-des-risques)
8. [Ressources](#8-ressources)

---

## 1. Sommaire du lot de travail

Ce lot de travail couvre la modernisation complète du système de cotation
(quoting) de la plateforme NzilaOS, depuis l'audit du système existant
(Shop Quoter Tool V1 / ShopMoiÇa) jusqu'au déploiement d'un moteur de
commerce modulaire avec traçabilité complète.

### Portée

| Composante | Description |
|-----------|-------------|
| **Système source** | Shop Quoter Tool V1 — application React/Supabase de cotation de boîtes-cadeaux pour le marché québécois |
| **Système cible** | NzilaOS Commerce Engine — architecture modulaire avec machines à états, pistes d'audit, et isolation par organisation |
| **Juridiction fiscale** | Québec, Canada (TPS 5% + TVQ 9,975%) |
| **Intégrations** | Zoho CRM/Books/Inventory, Stripe, QuickBooks Online |

---

## 2. Objectifs techniques

### 2.1 Incertitudes technologiques (critères DET)

| # | Incertitude | État |
|---|-----------|------|
| IT-1 | Extraction d'un moteur de tarification déterministe à fonctions pures avec conformité fiscale québécoise | **Résolue** — `@nzila/pricing-engine` |
| IT-2 | Orchestration de cycle de vie commercial par machines à états déclaratives composables | **Résolue** — `@nzila/commerce-state` |
| IT-3 | Architecture de piste d'audit par preuves à chaîne de hachage intégrée au niveau cadriciel | **Résolue** — `@nzila/commerce-audit` + `@nzila/commerce-evidence` |
| IT-4 | Migration sans perte de données héritées avec établissement d'isolation par organisation | **Résolue** — supersédé par `apps/flow` |
| IT-5 | Portes de gouvernance configurables par organisation avec seuils de marge formels | **Résolue** — `@nzila/commerce-governance` |

### 2.2 Avancement technologique

Le projet fait avancer l'état des connaissances dans le domaine de
l'ingénierie de plateformes de commerce pour PME, spécifiquement :

1. **Machines à états composables** — les transitions de cycle de vie
   sont déclarées comme données (pas de code procédural), avec des gardes
   de gouvernance enfichables par organisation.

2. **Architecture à preuves** — chaque action matérielle produit un
   artefact de preuve scellé dans un pipeline d'emballage de preuves
   (`buildEvidencePackFromAction()` → `processEvidencePack()` → Azure Blob).

3. **Moteur de tarification pure** — calculs déterministes extraits
   du code hérité vers des fonctions pures avec typage strict et
   résultats discriminés.

---

## 3. Description des travaux

### 3.1 Phase 1 — Audit du système hérité (Terminée)

**Travaux réalisés :**

- Inventaire complet de 65+ fichiers UI, 30+ services d'affaires
- Identification de 6 fichiers avec accès BD direct dans la logique métier
- Cartographie de 9 fichiers d'intégration Zoho
- Documentation des 30+ migrations Supabase
- Évaluation des risques : injection SQL, pas de RLS, types dupliqués

**Livrable :** [`docs/commerce/LEGACY_REVIEW.md`](LEGACY_REVIEW.md)

### 3.2 Phase 2 — Modèle de domaine (Terminée)

**Travaux réalisés :**

- Extraction des entités de domaine : Quote, QuoteLine, Customer, Order,
  Invoice, Fulfillment, Approval
- Définition des types canoniques dans `@nzila/commerce-core/types`
- Création des schémas Zod pour validation aux frontières API
- Définition des énumérations : QuoteStatus (10 états), OrderStatus (9),
  InvoiceStatus (11), PricingTier (3), OrgRole (7)

**Livrables :**

- [`docs/commerce/DOMAIN_MODEL_DRAFT.md`](DOMAIN_MODEL_DRAFT.md)
- [`packages/commerce-core/src/types/index.ts`](../../packages/commerce-core/src/types/index.ts)
- [`packages/commerce-core/src/enums.ts`](../../packages/commerce-core/src/enums.ts)
- [`packages/commerce-core/src/schemas/index.ts`](../../packages/commerce-core/src/schemas/index.ts)

### 3.3 Phase 3 — Moteur central (Terminée)

**Travaux réalisés :**

- Extraction du moteur de tarification de `margin-solver.ts` hérité
- Implémentation de 8 fonctions publiques pures
- Conformité fiscale québécoise : TVQ = (base + TPS) × 9,975%
- Validation de marge plancher intégrée
- Analyse de seuil de rentabilité et optimisation de cible

**Livrables :**

- [`packages/pricing-engine/`](../../packages/pricing-engine/) — 10 fonctions exportées, 12 types
- [`packages/commerce-state/`](../../packages/commerce-state/) — machines à états déclaratives
- [`packages/commerce-audit/`](../../packages/commerce-audit/) — entrées d'audit avec chaînage de hachage
- [`packages/commerce-events/`](../../packages/commerce-events/) — bus d'événements + sagas

### 3.4 Phase 4 — Couche de gouvernance (Terminée)

**Travaux réalisés :**

- Portes de garde composables : seuil d'approbation, marge plancher,
  plafond de remise, validité de devis, complétude
- Politique configurable par organisation (`GovernancePolicy`)
- Constructeur de paquets de preuves commerciales
- Observabilité : journalisation structurée, métriques, spans, SLOs

**Livrables :**

- [`packages/commerce-governance/`](../../packages/commerce-governance/) — 7 gardes de gouvernance
- [`packages/commerce-evidence/`](../../packages/commerce-evidence/) — constructeur de paquets de preuves
- [`packages/commerce-observability/`](../../packages/commerce-observability/) — métriques + spans

### 3.5 Phase 5 — Adaptateur Shop Quoter (En cours)

**Travaux réalisés :**

- Schémas Zod pour validation des données héritées
- Fonctions de mappage pures (tier, status, client, items)
- Service adaptateur avec ports de référentiel injectés
- Import par lot avec diagnostics par enregistrement
- Mode de validation préliminaire (dry-run)

**Livrables :**

- [`apps/flow/`](../../apps/flow/) — adaptateur complet (supersède `@nzila/shop-quoter`)
- [`docs/commerce/IRAP_TECHNICAL_DESIGN.md`](IRAP_TECHNICAL_DESIGN.md) — conception technique IRAP

---

## 4. Livrables

### 4.1 Artefacts logiciels

| # | Livrable | Paquet | État |
|---|---------|--------|------|
| L1 | Types et schémas de domaine | `@nzila/commerce-core` | ✅ Terminé |
| L2 | Moteur de tarification | `@nzila/pricing-engine` | ✅ Terminé |
| L3 | Machines à états | `@nzila/commerce-state` | ✅ Terminé |
| L4 | Entrées d'audit | `@nzila/commerce-audit` | ✅ Terminé |
| L5 | Bus d'événements + sagas | `@nzila/commerce-events` | ✅ Terminé |
| L6 | Service de devis | `@nzila/commerce-services` | ✅ Terminé |
| L7 | Portes de gouvernance | `@nzila/commerce-governance` | ✅ Terminé |
| L8 | Paquets de preuves | `@nzila/commerce-evidence` | ✅ Terminé |
| L9 | Observabilité | `@nzila/commerce-observability` | ✅ Terminé |
| L10 | **Adaptateur Flow** (ex Shop Quoter) | **`apps/flow`** | ✅ **Terminé** |
| L11 | Tests d'intégration | `@nzila/commerce-integration-tests` | 🔄 En cours |

### 4.2 Documentation technique

| # | Document | Emplacement | État |
|---|---------|-------------|------|
| D1 | Audit du système hérité | `docs/commerce/LEGACY_REVIEW.md` | ✅ |
| D2 | Modèle de domaine | `docs/commerce/DOMAIN_MODEL_DRAFT.md` | ✅ |
| D3 | Glossaire du domaine | `docs/commerce/spec/GLOSSARY.md` | ✅ |
| D4 | Plan de portée organisationnelle | `docs/commerce/spec/ORG_SCOPE_PLAN.md` | ✅ |
| D5 | Analyse d'écart des machines à états | `docs/commerce/spec/STATE_MACHINE_GAP.md` | ✅ |
| D6 | **Conception technique IRAP** | **`docs/commerce/IRAP_TECHNICAL_DESIGN.md`** | ✅ |
| D7 | **ADR — Patron adaptateur** | **`docs/commerce/ADR/ADR-SQ-001-adapter-pattern.md`** | ✅ |
| D8 | **ADR — Extraction tarification** | **`docs/commerce/ADR/ADR-SQ-002-pricing-extraction.md`** | ✅ |
| D9 | **Lot de travail MEIE** | **`docs/commerce/meie/WP_DELIVERABLES.md`** | ✅ |

---

## 5. Jalons et échéancier

| Jalon | Description | Date prévue | État |
|-------|-----------|-------------|------|
| J1 | Audit complet du système hérité | 2026-01 | ✅ Terminé |
| J2 | Modèle de domaine canonique | 2026-01 | ✅ Terminé |
| J3 | Moteur central (pricing + state + audit) | 2026-02 | ✅ Terminé |
| J4 | Couche de gouvernance + preuves | 2026-02 | ✅ Terminé |
| J5 | **Adaptateur Shop Quoter** | **2026-02** | **✅ Terminé** |
| J6 | Tests d'intégration bout en bout | 2026-03 | 🔄 En cours |
| J7 | Migration de production | 2026-Q2 | 📅 Planifié |
| J8 | Décommissionnement du système hérité | 2026-Q3 | 📅 Planifié |

---

## 6. Indicateurs de performance

### 6.1 Métriques de qualité logicielle

| Métrique | Cible | Actuel |
|---------|-------|--------|
| Couverture de tests (pricing-engine) | ≥85% | En mesure |
| Couverture de tests (flow) | ≥80% | En mesure |
| Zéro `console.log` dans le code de production | 0 | Appliqué par tests de contrat |
| Violations de typage TypeScript | 0 | Appliqué par CI |
| Entrées d'audit par enregistrement migré | ≥2 | Vérifié |

### 6.2 Métriques de migration

| Métrique | Cible |
|---------|-------|
| Taux de migration réussie | ≥98% |
| Enregistrements avec avertissements | <10% |
| Temps de traitement par lot de 1000 | <30s |
| ID hérités traçables post-migration | 100% |

---

## 7. Registre des risques

| # | Risque | Probabilité | Impact | Mitigation |
|---|--------|------------|--------|-----------|
| R1 | Qualité des données héritées insuffisante | Moyenne | Élevé | Validation Zod + mode dry-run avant migration |
| R2 | Écarts de calcul fiscal entre ancien et nouveau système | Faible | Élevé | Tests de régression bit-à-bit + vérification ARC/ARQ |
| R3 | Dépassement de capacité mémoire pour lots volumineux | Faible | Moyen | Traitement séquentiel + chunking configurable |
| R4 | Perte de données pendant la migration | Faible | Critique | Préservation d'ID hérités + piste d'audit complète |
| R5 | Résistance au changement des utilisateurs | Moyenne | Moyen | Formation + période de fonctionnement parallèle |

---

## 8. Ressources

### 8.1 Équipe technique

| Rôle | Responsabilité |
|------|---------------|
| Architecte principal | Conception du moteur de commerce, revue des ADR |
| Développeur senior | Implémentation des paquets, tests |
| Analyste QA | Tests d'intégration, validation des migrations |
| Conseiller IRAP | Revue des livrables, alignement DET |

### 8.2 Infrastructure

| Ressource | Utilisation |
|----------|------------|
| Azure Blob Storage | Stockage des paquets de preuves scellés |
| PostgreSQL (Drizzle ORM) | Persistance des entités de commerce |
| Azure Key Vault | Gestion des secrets |
| GitHub Actions CI | Tests automatisés, vérification des contrats |

---

*Document préparé dans le cadre du Programme d'aide à la recherche industrielle (PARI-CNRC / IRAP).*  
*Fait partie de [NzilaOS](../../README.md).*
