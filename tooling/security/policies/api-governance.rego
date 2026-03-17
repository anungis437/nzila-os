# Nzila OS — API Governance Policy
#
# Rate limiting, allowed endpoints, and API security rules.

package nzila.api_governance

import rego.v1

# ── Rate limit tiers ─────────────────────────────────────────────────────────

rate_limits := {
  "public":       {"requests_per_minute": 60,  "burst": 10},
  "authenticated": {"requests_per_minute": 200, "burst": 50},
  "admin":        {"requests_per_minute": 500, "burst": 100},
  "system":       {"requests_per_minute": 1000, "burst": 200},
  "webhook":      {"requests_per_minute": 100, "burst": 20},
}

# ── Required headers ─────────────────────────────────────────────────────────

required_headers := ["x-request-id"]

required_headers_authenticated := [
  "x-request-id",
  "x-org-id",
  "authorization",
]

missing_headers contains header if {
  some header in required_headers
  not input.headers[header]
}

missing_auth_headers contains header if {
  input.authenticated
  some header in required_headers_authenticated
  not input.headers[header]
}

# ── Blocked patterns ─────────────────────────────────────────────────────────

blocked_paths := [
  "/api/admin/",
  "/api/internal/",
  "/.env",
  "/debug/",
  "/phpinfo",
  "/wp-admin",
  "/wp-login",
]

path_blocked if {
  some blocked in blocked_paths
  startswith(input.path, blocked)
  not input.role in ["admin", "super_admin", "system"]
}

# ── CORS policy ──────────────────────────────────────────────────────────────

allowed_origins := [
  "https://nzila.app",
  "https://console.nzila.app",
  "https://partners.nzila.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]

cors_allowed if {
  some origin in allowed_origins
  input.origin == origin
}

# ── Decision output ──────────────────────────────────────────────────────────

rate_limit_tier := "system" if { input.role == "system" }
rate_limit_tier := "admin" if { input.role in ["admin", "super_admin"] }
rate_limit_tier := "authenticated" if { input.authenticated; not input.role in ["admin", "super_admin", "system"] }
rate_limit_tier := "public" if { not input.authenticated }

default request_allowed := true
request_allowed := false if { path_blocked }

decision := {
  "allowed": request_allowed,
  "rate_limit": rate_limits[rate_limit_tier],
  "missing_headers": missing_headers | missing_auth_headers,
  "cors_allowed": cors_allowed,
  "path_blocked": path_blocked,
}
