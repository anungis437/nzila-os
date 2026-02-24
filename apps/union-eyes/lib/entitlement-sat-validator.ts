/**
 * SAT-based Entitlement Constraint Validator
 * 
 * Uses Boolean Satisfiability solving to validate that entitlement
 * constraints are consistent and user access patterns are satisfiable.
 * 
 * This runs at design-time/initialization to catch conflicts before
 * they cause runtime issues.
 */

import { GatedFeature, SubscriptionTier } from './services/entitlements';
import { UserRole } from './api-auth-guard';

/**
 * Literal representation for SAT solver
 * A literal is either a variable (positive) or its negation (negative)
 */
type Literal = {
  variable: string;
  negated: boolean;
};

/**
 * Clause is a disjunction (OR) of literals
 * A formula is satisfied if at least one literal in each clause is true
 */
type Clause = Literal[];
type Formula = Clause[];

/**
 * SAT Solver result
 */
interface SATResult {
  satisfiable: boolean;
  assignment?: Record<string, boolean>;
  conflicts?: string[];
  unsatisfiedClauses?: number[];
}

/**
 * Maps entitlements and roles to SAT variables
 */
class EntitlementSATEncoder {
  private variables: Map<string, number> = new Map();
  private variableToName: Map<number, string> = new Map();
  private nextVarId = 1;

  /**
   * Create a SAT variable for an entitlement
   */
  private createVariable(name: string): number {
    if (!this.variables.has(name)) {
      this.variables.set(name, this.nextVarId);
      this.variableToName.set(this.nextVarId, name);
      this.nextVarId++;
    }
    return this.variables.get(name)!;
  }

  /**
   * Get variable ID for an entitlement
   */
  getVariable(entitlement: string): number {
    return this.createVariable(entitlement);
  }

  /**
   * Encode "user has entitlement X" as a literal
   */
  hasEntitlement(entitlement: string): Literal {
    return { variable: `has_${entitlement}`, negated: false };
  }

  /**
   * Encode "user has role R" as a literal
   */
  hasRole(role: string): Literal {
    return { variable: `role_${role}`, negated: false };
  }

  /**
   * Encode "entitlement X requires entitlement Y"
   * (X → Y) is equivalent to (¬X ∨ Y)
   */
  requires(entitlement: string, requiredEntitlement: string): Clause {
    return [
      { variable: `has_${entitlement}`, negated: true },
      { variable: `has_${requiredEntitlement}`, negated: false },
    ];
  }

  /**
   * Encode "entitlement X is incompatible with entitlement Y"
   * (X → ¬Y) is equivalent to (¬X ∨ ¬Y)
   */
  incompatible(entitlement1: string, entitlement2: string): Clause {
    return [
      { variable: `has_${entitlement1}`, negated: true },
      { variable: `has_${entitlement2}`, negated: true },
    ];
  }

  /**
   * Encode "role R grants entitlement X"
   * (role_R → has_X) is equivalent to (¬role_R ∨ has_X)
   */
  roleGrants(role: string, entitlement: string): Clause {
    return [
      { variable: `role_${role}`, negated: true },
      { variable: `has_${entitlement}`, negated: false },
    ];
  }

  /**
   * Encode "tier T includes entitlement X"
   */
  tierIncludes(tier: SubscriptionTier, entitlement: string): Clause {
    return [
      { variable: `tier_${tier}`, negated: true },
      { variable: `has_${entitlement}`, negated: false },
    ];
  }
}

/**
 * Simple DPLL-based SAT solver
 * Handles CNF (Conjunctive Normal Form) formulas
 */
export class SATSolver {
  private encoder: EntitlementSATEncoder;

  constructor() {
    this.encoder = new EntitlementSATEncoder();
  }

  /**
   * Evaluate a literal given an assignment
   */
  private evaluateLiteral(literal: Literal, assignment: Record<string, boolean>): boolean {
    const value = assignment[literal.variable];
    return literal.negated ? !value : value;
  }

  /**
   * Evaluate a clause (OR of literals)
   */
  private evaluateClause(clause: Clause, assignment: Record<string, boolean>): boolean {
    if (clause.length === 0) return false;
    return clause.some(lit => this.evaluateLiteral(lit, assignment));
  }

  /**
   * Check if all clauses are satisfied
   */
  private isSatisfied(formula: Formula, assignment: Record<string, boolean>): boolean {
    return formula.every(clause => this.evaluateClause(clause, assignment));
  }

  /**
   * DPLL algorithm - recursive SAT solver
   */
  private dpll(formula: Formula, assignment: Record<string, boolean>): SATResult {
    // Check if all clauses are satisfied
    if (this.isSatisfied(formula, assignment)) {
      return { satisfiable: true, assignment };
    }

    // Check for empty clause (unsatisfiable)
    for (let i = 0; i < formula.length; i++) {
      if (formula[i].length === 0) {
        return { 
          satisfiable: false, 
          conflicts: [`Clause ${i} is empty - unsatisfiable`],
          unsatisfiedClauses: [i]
        };
      }
    }

    // Find a literal to branch on
    const allVariables = new Set<string>();
    formula.forEach(clause => {
      clause.forEach(lit => allVariables.add(lit.variable));
    });

    // Find unassigned variable
    const unassigned = [...allVariables].find(v => !(v in assignment));
    if (!unassigned) {
      return { satisfiable: false };
    }

    // Try positive assignment first
    const posAssignment = { ...assignment, [unassigned]: true };
    const posResult = this.dpll(formula, posAssignment);
    if (posResult.satisfiable) return posResult;

    // Try negative assignment
    const negAssignment = { ...assignment, [unassigned]: false };
    return this.dpll(formula, negAssignment);
  }

  /**
   * Solve a SAT formula
   */
  solve(formula: Formula): SATResult {
    return this.dpll(formula, {});
  }
}

/**
 * Entitlement constraint definitions for Union Eyes
 */
interface EntitlementConstraint {
  entitlement: GatedFeature;
  requires?: GatedFeature[];
  incompatible?: GatedFeature[];
  minTier?: SubscriptionTier;
}

/**
 * Role-based access constraints
 */
interface RoleEntitlementMapping {
  role: UserRole;
  entitlements: GatedFeature[];
  impliedRoles?: UserRole[];
}

/**
 * Validates entitlement system for satisfiability
 */
export class EntitlementValidator {
  private solver: SATSolver;
  private constraints: EntitlementConstraint[];
  private roleMappings: RoleEntitlementMapping[];

  constructor(
    constraints: EntitlementConstraint[],
    roleMappings: RoleEntitlementMapping[]
  ) {
    this.solver = new SATSolver();
    this.constraints = constraints;
    this.roleMappings = roleMappings;
  }

  /**
   * Encode all constraints into SAT formula
   */
  private encode(): Formula {
    const formula: Formula = [];
    const encoder = new EntitlementSATEncoder();

    // Add requirement constraints
    for (const constraint of this.constraints) {
      if (constraint.requires) {
        for (const req of constraint.requires) {
          formula.push(encoder.requires(constraint.entitlement, req));
        }
      }
    }

    // Add incompatibility constraints
    for (const constraint of this.constraints) {
      if (constraint.incompatible) {
        for (const incompat of constraint.incompatible) {
          formula.push(encoder.incompatible(constraint.entitlement, incompat));
        }
      }
    }

    // Add role-based entitlement constraints
    for (const mapping of this.roleMappings) {
      for (const entitlement of mapping.entitlements) {
        formula.push(encoder.roleGrants(mapping.role, entitlement));
      }
    }

    return formula;
  }

  /**
   * Check if the entire entitlement system is consistent
   */
  validateSystem(): {
    isValid: boolean;
    conflicts?: string[];
    details?: string;
  } {
    const formula = this.encode();
    const result = this.solver.solve(formula);

    if (result.satisfiable) {
      return { isValid: true };
    }

    return {
      isValid: false,
      conflicts: result.conflicts,
      details: 'Entitlement system has unsatisfiable constraints. ' +
        'Some entitlement combinations cannot exist simultaneously.'
    };
  }

  /**
   * Check if a specific role can access a specific entitlement
   */
  canRoleAccessEntitlement(
    role: UserRole,
    entitlement: string
  ): { possible: boolean; requires?: string[] } {
    const formula: Formula = [];
    const encoder = new EntitlementSATEncoder();

    // User has the role
    formula.push([encoder.hasRole(role)]);

    // User wants the entitlement
    formula.push([{ variable: `has_${entitlement}`, negated: false }]);

    // Add all system constraints
    const systemConstraints = this.encode();
    formula.push(...systemConstraints);

    const result = this.solver.solve(formula);

    if (result.satisfiable) {
      // Find what other entitlements are required
      const requires: string[] = [];
      const assignment = result.assignment || {};
      
      for (const [key, value] of Object.entries(assignment)) {
        if (key.startsWith('has_') && value) {
          const ent = key.replace('has_', '');
          if (ent !== entitlement) {
            // Check if this is required by looking at constraints
            const constraint = this.constraints.find(c => c.entitlement === entitlement);
            if (constraint?.requires?.includes(ent as GatedFeature)) {
              requires.push(ent);
            }
          }
        }
      }

      return { possible: true, requires };
    }

    return { possible: false };
  }

  /**
   * Check if multiple entitlements can be held simultaneously
   */
  areEntitlementsCompatible(entitlements: string[]): boolean {
    const formula: Formula = [];
    const encoder = new EntitlementSATEncoder();

    // User wants all these entitlements
    for (const ent of entitlements) {
      formula.push([encoder.hasEntitlement(ent)]);
    }

    // Add all system constraints
    const systemConstraints = this.encode();
    formula.push(...systemConstraints);

    const result = this.solver.solve(formula);
    return result.satisfiable;
  }

  /**
   * Find the minimum set of entitlements needed to access a target
   */
  getRequiredEntitlements(targetEntitlement: string): string[] {
    const required: Set<string> = new Set([targetEntitlement]);
    const queue = [targetEntitlement];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const constraint = this.constraints.find(c => c.entitlement === current);
      
      if (constraint?.requires) {
        for (const req of constraint.requires) {
          if (!required.has(req)) {
            required.add(req);
            queue.push(req);
          }
        }
      }
    }

    return [...required];
  }
}

/**
 * Create default Union Eyes entitlement constraints
 */
export function createUnionEyesEntitlements(): {
  constraints: EntitlementConstraint[];
  roleMappings: RoleEntitlementMapping[];
} {
  const constraints: EntitlementConstraint[] = [
    // AI features are already properly gated by subscription tier
    // These constraints ensure logical dependencies are satisfied
    
    // Advanced features require basic features (from TIER_FEATURES)
    {
      entitlement: 'advanced_analytics',
      requires: ['ai_search'], // Semantic search requires base search
    },
    {
      entitlement: 'predictive_models',
      requires: ['advanced_analytics'],
    },
    {
      entitlement: 'bulk_export',
      requires: ['api_access'],
    },
    {
      entitlement: 'webhooks',
      requires: ['api_access'],
    },

    // Some feature combinations are incompatible
    // (e.g., certain integrations might conflict)
    // This is handled at runtime by checking both aren&apos;t active
    // For SAT validation, we focus on dependency constraints
  ];

  const roleMappings: RoleEntitlementMapping[] = [
    {
      role: 'member',
      entitlements: ['ai_search'], // Basic AI access
    },
    {
      role: 'steward',
      entitlements: ['ai_search', 'ai_summarize', 'ai_classify'],
    },
    {
      role: 'organizer' as UserRole,
      entitlements: ['ai_search', 'ai_summarize', 'ai_classify', 'ai_extract_clauses'],
    },
    {
      role: 'business_rep' as UserRole,
      entitlements: ['ai_search', 'ai_summarize', 'ai_classify', 'ai_extract_clauses', 'ai_match_precedents', 'ai_semantic_search', 'advanced_analytics', 'api_access'],
    },
    {
      role: 'admin',
      entitlements: ['ai_search', 'ai_summarize', 'ai_classify', 'ai_extract_clauses', 'ai_match_precedents', 'ai_semantic_search', 'ai_mamba', 'ai_feedback', 'ai_ingest', 'advanced_analytics', 'predictive_models', 'custom_workflows', 'api_access', 'webhooks', 'bulk_export', 'third_party_integrations'],
    },
  ];

  return { constraints, roleMappings };
}

/**
 * Validate the Union Eyes entitlement system
 */
export function validateUnionEyesEntitlements(): {
  isValid: boolean;
  conflicts?: string[];
  details?: string;
} {
  const { constraints, roleMappings } = createUnionEyesEntitlements();
  const validator = new EntitlementValidator(constraints, roleMappings);
  return validator.validateSystem();
}
