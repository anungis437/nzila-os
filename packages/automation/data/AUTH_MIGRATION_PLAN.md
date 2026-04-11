# Auth Migration Plan
**Date:** 2026-02-17  
**Status:** READY TO START  
**Prerequisites:** ✅ Data migration complete (364 tables, 6,981 rows migrated)

---

## Overview

Both platforms need auth migration to Django + Clerk:

| Platform | Current Auth | Target Auth | Complexity | User Count |
|----------|-------------|-------------|------------|------------|
| **UnionEyes** | ✅ Clerk (already) | Clerk + Django | **LOW** | ~23 (profiles table) |
| **ABR Insights** | Supabase Auth | Clerk + Django | **MEDIUM-HIGH** | ~11 (profiles table) |

---

## Phase 1: UnionEyes Auth Integration (PRIORITY: HIGH)

### Current State
- ✅ UE already uses Clerk in frontend (`@clerk/nextjs`)
- ✅ `UserUuidMapping` table maps `clerk_user_id` → `user_uuid` (migrated: 1 row)
- ✅ `Profiles` model exists (23 rows migrated)
- ✅ Django Clerk auth backend scaffolded in `tech-repo-scaffold/django-backbone/apps/auth_core/`

### Tasks

#### 1.1 Django Settings Configuration
- [ ] Copy Clerk auth backend from scaffold to UE Django backend
- [ ] Configure `CLERK_JWKS_URL` and `CLERK_SECRET_KEY` in Django settings
- [ ] Add `ClerkAuthentication` to DRF `DEFAULT_AUTHENTICATION_CLASSES`
- [ ] Add `ClerkJWTMiddleware` to Django middleware stack
- [ ] Set up CORS for Next.js frontend → Django API

#### 1.2 User Model Mapping
- [ ] Create Django custom User model that syncs with `Profiles`
- [ ] Link `UserUuidMapping.clerk_user_id` to Django User
- [ ] Create API endpoint to sync Clerk user metadata → Django
- [ ] Set up webhook handler for Clerk user events (created, updated, deleted)

#### 1.3 Permission System
- [ ] Review existing RBAC models (roles, permissions in auth_core)
- [ ] Implement Django permissions/groups based on Clerk metadata
- [ ] Create middleware to attach organization context to requests
- [ ] Test permission checks in views

#### 1.4 Frontend Integration
- [ ] Update Next.js API client to send Clerk JWT in Authorization header
- [ ] Test authenticated API calls from frontend → Django
- [ ] Verify organization-scoped data access
- [ ] Test SSO flows if applicable

#### 1.5 Testing
- [ ] Unit tests for Clerk auth backend
- [ ] Integration tests for JWT validation
- [ ] E2E tests for login → API call → data access
- [ ] Test anonymous access restrictions

**Estimated Duration:** 2-3 days  
**Complexity:** LOW (Clerk already in use)

---

## Phase 2: ABR Insights Auth Migration (PRIORITY: MEDIUM)

### Current State
- ❌ ABR uses Supabase Auth (`@supabase/ssr`, `@supabase/auth-helpers-nextjs`)
- ✅ `Profiles` model exists (11 rows migrated)
- ✅ RBAC models migrated: `Roles` (8), `Permissions` (106), `RolePermissions` (222), `UserRoles` (10)
- ⚠️ **Risk:** SAML SSO (`@node-saml`) and Azure AD MSAL (`@azure/msal-node`) integrations need migration

### Tasks

#### 2.1 Clerk Setup (Frontend)
- [ ] Install `@clerk/nextjs` in ABR frontend
- [ ] Remove `@supabase/ssr`, `@supabase/auth-helpers-nextjs`
- [ ] Replace Supabase Auth components with Clerk components
- [ ] Configure Clerk middleware in Next.js `middleware.ts`
- [ ] Update auth UI (login, signup, profile pages)

#### 2.2 Clerk Enterprise Configuration (SSO)
- [ ] Set up SAML SSO connections in Clerk dashboard (replaces `@node-saml`)
- [ ] Set up Azure AD connection in Clerk dashboard (replaces `@azure/msal-node`)
- [ ] Configure organization SSO settings
- [ ] Test SSO flows end-to-end

#### 2.3 Django Backend Configuration
- [ ] Copy Clerk auth backend from scaffold to ABR Django backend
- [ ] Configure `CLERK_JWKS_URL` and `CLERK_SECRET_KEY`
- [ ] Add `ClerkAuthentication` to DRF settings
- [ ] Add `ClerkJWTMiddleware` to middleware
- [ ] Set up CORS for Next.js frontend → Django API

#### 2.4 User Data Migration (Supabase → Clerk)
- [ ] **Export user data from Supabase Auth** (email, metadata, created_at)
- [ ] **Script to bulk-create users in Clerk** via Clerk API
- [ ] Map Supabase `auth.users.id` → Clerk user ID → Django `Profiles.id`
- [ ] Create `UserMapping` table if needed (similar to UE's `UserUuidMapping`)
- [ ] Migrate user metadata (roles, permissions, organization memberships)

#### 2.5 RLS Policy → Django Permissions Migration
- [ ] Audit all Supabase RLS policies in `001_initial_schema.sql`
- [ ] Translate RLS policies to Django permissions/groups
- [ ] Implement organization-scoped querysets in Django views
- [ ] Test data isolation between organizations

#### 2.6 Frontend Integration
- [ ] Update API client to send Clerk JWT instead of Supabase token
- [ ] Replace Supabase auth hooks with Clerk hooks
- [ ] Test authenticated API calls
- [ ] Verify organization-scoped data access

#### 2.7 Testing
- [ ] Unit tests for auth backend
- [ ] Integration tests for SSO flows
- [ ] E2E tests covering:
   - Email/password login
   - SAML SSO login
   - Azure AD login
   - Organization role-based access
   - Multi-tenant data isolation
- [ ] Load test JWT validation performance

**Estimated Duration:** 1-2 weeks  
**Complexity:** MEDIUM-HIGH (Supabase → Clerk migration + SSO setup)

---

## Rollout Strategy

### UE Rollout (Recommended: Incremental)
1. Deploy Django backend with Clerk auth (no frontend changes yet)
2. Test with internal team using existing Clerk tokens
3. Route 10% of API traffic through Django (canary)
4. Monitor auth success rates, latency, errors
5. Gradual rollout to 100%

### ABR Rollout (Recommended: Parallel Auth)
1. **Phase A:** Deploy Clerk in parallel with Supabase Auth
   - Frontend supports both auth providers
   - New users → Clerk
   - Existing users → Supabase (for 2 weeks)
2. **Phase B:** User migration window
   - Email existing users to re-authenticate → migrates them to Clerk
   - Automated migration script for inactive users
3. **Phase C:** Cutover
   - Disable Supabase Auth
   - Remove Supabase dependencies
   - All users on Clerk

---

## Technical Dependencies

### Environment Variables (Both Platforms)
```bash
# Django settings
CLERK_JWKS_URL=https://YOUR_CLERK_DOMAIN/.well-known/jwks.json
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Frontend (.env.local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### Python Packages (Add to requirements.txt)
```
PyJWT==2.8.0
cryptography==42.0.0
requests==2.31.0
djangorestframework==3.14.0
django-cors-headers==4.3.1
```

### Frontend Packages (Add to package.json)
```json
{
  "@clerk/nextjs": "^5.0.0"  // ABR only (UE already has it)
}
```

### Remove from ABR Frontend
```json
{
  "@supabase/ssr": "^0.7.0",
  "@supabase/auth-helpers-nextjs": "^0.10.0",
  "@node-saml/node-saml": "^5.0.0",
  "@azure/msal-node": "^2.15.0"
}
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **User lockout during migration** | HIGH | Parallel auth + gradual rollout + rollback plan |
| **SSO integration issues (ABR)** | MEDIUM | Test SSO in Clerk sandbox first, E2E testing |
| **Session token incompatibility** | MEDIUM | Thorough JWT validation testing, token refresh flows |
| **Permission mapping errors** | MEDIUM | Unit tests for every RLS → Django permission mapping |
| **Performance degradation** | LOW | Load test JWT validation, cache JWKS, monitor latency |

---

## Success Criteria

### UE Auth Migration Complete When:
- ✅ 100% of API requests authenticate via Clerk JWT
- ✅ All permission checks work correctly
- ✅ Zero auth-related errors in production (7-day window)
- ✅ API response times within 10% of baseline
- ✅ All E2E tests passing

### ABR Auth Migration Complete When:
- ✅ 100% of users migrated from Supabase → Clerk
- ✅ Supabase Auth fully disabled and removed
- ✅ SAML SSO and Azure AD working in Clerk
- ✅ All RBAC policies enforced correctly in Django
- ✅ Zero auth-related errors in production (7-day window)
- ✅ All E2E tests passing

---

## Next Steps (IMMEDIATE)

1. **UE Auth Integration** (Start Now)
   - Copy Clerk auth files from scaffold → UE backend
   - Configure Django settings
   - Test JWT validation locally
   - Deploy to staging

2. **ABR Clerk Setup** (Parallel work)
   - Create Clerk application in dashboard
   - Configure SSO connections
   - Plan user migration script

3. **Documentation**
   - API authentication guide for frontend devs
   - RBAC permission reference
   - Troubleshooting guide

---

**Owner:** Nzila Automation Team  
**Review Date:** 2026-02-18 (daily standup)
