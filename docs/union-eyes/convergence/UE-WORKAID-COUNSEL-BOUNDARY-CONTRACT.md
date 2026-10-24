# UE WorkAid — Counsel-Side Trust Boundary (Normative Contract)

**Status:** SPECIFIED. Union-side enforcement is implemented and tested; the counsel-side authenticator is **not built** and is owned by the WorkAid/counsel interface. Until it exists and is qualified, every counsel-attributed act is refused.
**Branch evidence:** `agents/ue-authority-kernel`. Related candidate (read only, not merged): `agents/workaid-prep-20261023`.

## 1. Principle

The union can **receive** counsel's acts. It can never **create** them. No union principal — however senior, however administrative — can accept a referral as counsel, issue a counsel disclosure, or read counsel-controlled material by inheriting union permissions.

## 2. What the union side enforces today (tested)

| Rule | Mechanism | Evidence |
|---|---|---|
| The acceptor is never a parameter | `recordCounselAcceptance(exec, deps, {organizationId, matterId})` takes the acceptor from the transaction's authenticated principal only | `authority-kernel-actor.pglite.test.ts`, `authority-kernel-resources.pglite.test.ts` |
| A verified counsel session is required | `requireCounselSession` calls the injected `CounselIdentityVerifier`; with none configured it refuses (`COUNSEL_NOT_VERIFIABLE`) | same |
| Union members are not excluded by status, but union authority never stands in for counsel's | `evaluateCounselCapacity` (`counsel-boundary.ts`) via `requireCounselSession`: the member, the referrer and an adverse party are refused (`COUNSEL_IS_PARTY`, `COUNSEL_ADVERSE`); a member with any capacity other than `member`, a live mandate, or a live relationship to the underlying case is refused (`COUNSEL_CONFLICTING_CAPACITY`, `COUNSEL_HOLDS_UNION_MANDATE`, `COUNSEL_CASE_RELATIONSHIP`); a plain member needs a live, matter-bound `member_counsel` engagement recording an information barrier (`COUNSEL_NEEDS_SEPARATE_CAPACITY`, `COUNSEL_NO_INFORMATION_BARRIER`); an unknown matter cannot clear a member (`COUNSEL_CONFLICT_UNVERIFIABLE`) | `counsel-boundary.test.ts`, resources suite |
| Counsel is neither the member nor the referrer | database CHECK `ue_authority_workaid_acceptor_chk` | resources suite |
| The actor columns cannot be forged | trigger `ue_authority_guard_actor` binds `counsel_accepted_by` and `issued_by` to the session principal | actor suite |
| Counsel material is unreachable | `workaid:read_counsel_material` is always denied; after acceptance `case:read_privileged` is denied to everyone (`COUNSEL_CONTROLLED`) | kernel + resources suites |
| Counsel disclosures name a recipient | `ue_authority_consent_shape_chk` | storage suite |
| Counsel authentication is envelope + signature + single use | `authenticateCounselAssertion` validates the envelope, calls the injected `CounselAssertionVerifier`, and consumes the nonce through the injected `CounselNonceStore` last; any missing port, bad signature or thrown error is a refusal | `counsel-boundary.test.ts` |

## 3. What the counsel-side integration MUST provide (not built)

1. **A separate authentication domain.** Counsel principals are authenticated by the counsel-side system (for example Clio coexistence) with credentials that are not valid for any Union Eyes route. External counsel's principal ids do not appear as members of the organization; a union member acting as counsel does so only under a member-counsel engagement (section 2).
2. **A signed assertion for every counsel act**, authenticated by `authenticateCounselAssertion` (`lib/authority/counsel-boundary.ts`): issuer on an explicit allow-list; audience `union-eyes/counsel-intake`; bound to exactly one organization and one matter; lifetime at most 5 minutes; not issued in the future; single-use nonce; subject a valid principal id.
3. **A `CounselAssertionVerifier` implementation** that checks the assertion signature with keys managed outside Union Eyes, and a `CounselIdentityVerifier` (`isCounselFor`, and `engagement` for members) that returns true only for the asserted subject, for that matter.
4. **A durable, shared `CounselNonceStore`** whose `consume` is atomic and returns true exactly once per nonce. **Not built:** the kernel ships the port and the contract, and no durable implementation, so with none configured every counsel act is refused.
5. **A durable engagement register** (matter-specific appointment, capacity, information barrier, term, revocation) behind `CounselIdentityVerifier.engagement`. **Not built:** it needs a governed migration of the kernel storage.
6. **Key custody, rotation and revocation** owned by the counsel-side operator; compromise handling must disable the issuer on the allow-list.

## 4. Acceptance tests the integration must pass before privileged actions unblock

A union administrator supplying counsel's id is refused; an assertion for another matter or organization is refused; a replayed nonce is refused; an expired assertion is refused; a union member who is a party, holds a conflicting union capacity or mandate, or relates to the case is refused even when vouched by the verifier; a plain member is cleared only under a live matter-bound member-counsel engagement with an information barrier; an assertion from an issuer not on the allow-list is refused; counsel acceptance does not reduce the member's access to their own non-privileged submissions; and the audit record names the counsel subject and the assertion id.

## 5. Open decisions (owner: WorkAid + privacy/legal review)

Which counsel-side system is authoritative; where the allow-list lives; whether counsel may be a member of a *different* organization; the member-facing consent wording.
