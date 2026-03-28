# Nzila OS — OPA Authorization Policy
#
# Open Policy Agent rules for RBAC enforcement.
# Complements the TypeScript policy engine in @nzila/os-core/policy.
# Used in CI validation and future Kubernetes sidecar integration.

package nzila.authz

import rego.v1

# ── Default deny ──────────────────────────────────────────────────────────────

default allow := false

# ── Role hierarchy ────────────────────────────────────────────────────────────

role_hierarchy := {
  "super_admin": ["admin", "finance_admin", "governance_admin", "ai_admin", "ml_admin", "partner_admin", "viewer"],
  "admin": ["finance_admin", "governance_admin", "viewer"],
  "finance_admin": ["viewer"],
  "governance_admin": ["viewer"],
  "ai_admin": ["viewer"],
  "ml_admin": ["viewer"],
  "partner_admin": ["viewer"],
  "supervisor": ["case_manager", "viewer"],
  "case_manager": ["viewer"],
  "viewer": [],
}

# Check if role A inherits role B (transitive, non-recursive)
inherits(role_a, role_b) if {
  reachable := graph.reachable(role_hierarchy, {role_a})
  role_b in reachable
  role_b != role_a
}

# ── Scope permissions ─────────────────────────────────────────────────────────

scope_permissions := {
  "governance:read":  ["viewer", "governance_admin", "admin", "super_admin"],
  "governance:write": ["governance_admin", "admin", "super_admin"],
  "finance:read":     ["viewer", "finance_admin", "admin", "super_admin"],
  "finance:write":    ["finance_admin", "admin", "super_admin"],
  "evidence:read":    ["viewer", "governance_admin", "admin", "super_admin"],
  "evidence:write":   ["governance_admin", "admin", "super_admin"],
  "ai:read":          ["viewer", "ai_admin", "admin", "super_admin"],
  "ai:invoke":        ["ai_admin", "admin", "super_admin"],
  "ml:read":          ["viewer", "ml_admin", "admin", "super_admin"],
  "ml:invoke":        ["ml_admin", "admin", "super_admin"],
  "admin:read":       ["admin", "super_admin"],
  "admin:write":      ["super_admin"],
  "partners:read":    ["partner_admin", "admin", "super_admin"],
  "partners:write":   ["partner_admin", "admin", "super_admin"],
}

# ── Allow rules ───────────────────────────────────────────────────────────────

# Allow if user has direct scope permission
allow if {
  input.scope
  input.role in scope_permissions[input.scope]
}

# Allow if user's role inherits a role with permission
allow if {
  input.scope
  some permitted_role in scope_permissions[input.scope]
  inherits(input.role, permitted_role)
}

# ── Org scoping invariant ─────────────────────────────────────────────────────
# CRITICAL: Every data access must be scoped to an organization

org_scoped if {
  input.org_id
  input.org_id != ""
}

deny_reason := "Missing org_id: all data access must be org-scoped" if {
  not org_scoped
}

# ── High-risk operation detection ─────────────────────────────────────────────

high_risk_operations := {
  "governance:write",
  "evidence:write",
  "admin:write",
  "finance:write",
  "ai:invoke",
}

requires_mfa if {
  input.scope in high_risk_operations
  not input.mfa_verified
}

step_up_required if {
  requires_mfa
}

# ── Decision output ──────────────────────────────────────────────────────────

decision := {
  "allowed": allow,
  "org_scoped": org_scoped,
  "step_up_required": step_up_required,
  "deny_reasons": deny_reasons,
}

deny_reasons contains reason if {
  not allow
  reason := sprintf("Role '%s' lacks scope '%s'", [input.role, input.scope])
}

deny_reasons contains reason if {
  reason := deny_reason
}
