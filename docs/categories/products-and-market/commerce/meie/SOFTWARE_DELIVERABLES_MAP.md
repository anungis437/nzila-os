# MEIE — Cartographie des livrables logiciels

> **Projet:** NZL-2026-COM  
> **Date:** 2026-02-24  
>
> **Note:** Le paquet `@nzila/shop-quoter` référencé ci-dessous a été supersédé par `apps/flow` (vertical commerce complet).

---

## Architecture des paquets du moteur de commerce

```text
                    ┌─────────────────────────┐
                    │    @nzila/commerce-core  │  Couche Domaine
                    │  types • enums • schemas │  (zéro dépendance runtime)
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼──────┐ ┌────────▼─────────┐ ┌──────▼──────────┐
   │ pricing-engine   │ │ commerce-state   │ │ commerce-audit  │
   │ Tarification     │ │ Machines à états │ │ Piste d'audit   │
   │ pure             │ │ déclaratives     │ │ chaîne hachage  │
   └──────────┬──────┘ └────────┬─────────┘ └──────┬──────────┘
              │                  │                   │
              └──────────────────┼───────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼──────┐ ┌────────▼─────────┐ ┌──────▼──────────┐
   │ commerce-       │ │ commerce-        │ │ commerce-       │
   │ governance      │ │ services         │ │ events          │
   │ Gardes de       │ │ Orchestration    │ │ Bus + sagas     │
   │ gouvernance     │ │ cycle de vie     │ │                 │
   └─────────────────┘ └────────┬─────────┘ └────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼──────┐ ┌────────▼─────────┐ ┌──────▼──────────┐
   │ commerce-       │ │ shop-quoter      │ │ commerce-       │
   │ evidence        │ │ ADAPTATEUR       │ │ observability   │
   │ Paquets de      │ │ Legacy → NzilaOS │ │ Métriques +     │
   │ preuves         │ │                  │ │ spans + SLOs    │
   └─────────────────┘ └──────────────────┘ └─────────────────┘
```

## Inventaire des fichiers source

### @nzila/shop-quoter (nouveau)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/types.ts` | ~210 | Types hérités, config, schémas Zod |
| `src/mapper.ts` | ~230 | Fonctions de mappage pures |
| `src/adapter.ts` | ~250 | Service adaptateur avec ports |
| `src/index.ts` | ~35 | Export barrel |
| `src/mapper.test.ts` | ~200 | Tests unitaires mapper |
| `src/adapter.test.ts` | ~200 | Tests d'intégration adapter |

### @nzila/pricing-engine (existant)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/pricing-engine.ts` | 345 | Calculs de tarification |
| `src/types.ts` | 105 | Types d'entrée/sortie |
| `src/index.ts` | 30 | Export barrel |

### @nzila/commerce-services (existant)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/quote-service.ts` | 501 | Orchestration du cycle de vie devis |
| `src/order-service.ts` | — | Service de commandes |
| `src/invoice-service.ts` | — | Service de facturation |

### @nzila/commerce-governance (existant)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/gates.ts` | 381 | 7 gardes de gouvernance composables |

---

## Matrice de traçabilité (Incertitude → Code)

| Incertitude | Fichier source principal | Fonction(s) clé(s) |
|------------|-------------------------|-------------------|
| IT-1 | `pricing-engine/src/pricing-engine.ts` | `calculateTierPricing()`, `calculateQuebecTaxes()` |
| IT-2 | `commerce-state/src/*.ts` | `attemptTransition()`, `getAvailableTransitions()` |
| IT-3 | `commerce-audit/src/audit.ts` | `buildTransitionAuditEntry()`, `hashAuditEntry()` |
| IT-4 | `shop-quoter/src/adapter.ts` | `importRequest()`, `importBatch()`, `validateLegacyData()` |
| IT-5 | `commerce-governance/src/gates.ts` | `createApprovalRequiredGate()`, `createMarginFloorGate()` |

---

*Cartographie des livrables pour le lot de travail MEIE NZL-2026-COM.*
