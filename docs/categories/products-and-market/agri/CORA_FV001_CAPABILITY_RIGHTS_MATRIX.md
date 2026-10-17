# Cora FV001 Capability and Rights Matrix

**Profile:** `FV001` — Climate FieldView Platform APIs
**Status:** Rights qualification only; no access or use is authorized.

## Technical capability is not a use right

Climate’s consumer Terms of Use say that, as between the FieldView customer
and Climate, the customer owns Customer Farm Data. The Terms describe
Customer Farm Data examples and allow the customer to request certain data
in the same format as uploaded. They separately define FieldView Generated
Works as Climate-owned material. The Terms also give Climate a license for
its own stated service, support, internal, research, and other purposes.

Those clauses do not grant Cora a license. The FAQ requires a platform
partner to agree to partner terms with Climate. The scope and content of
those terms, including rights in API-delivered data, are not publicly
established by the materials reviewed. A customer’s ownership statement,
OAuth consent, technical endpoint, or API export response is not a substitute
for those terms.

## Action-specific state

| Action / right                                                          | Public technical capability                                                                                                                                                                                                           | Cora right state                       | Gate                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read user-visible fields, boundaries, activities, and scouting data     | v4 read/list/get and raw-content endpoints are documented, subject to OAuth scopes and authenticated-user visibility.                                                                                                                 | `UNKNOWN`                              | Partner approval, applicable data license, user grant, and per-data-class use terms.                         |
| Persist source response beyond request processing                       | API responses and token persistence are technically possible; no partner data retention period or Cora retention entitlement is documented publicly.                                                                                  | `UNKNOWN`                              | Explicit term, duration, purpose, deletion, and backup treatment.                                            |
| Transform/normalize into Cora semantic objects                          | Cora can technically map public API shapes; Climate’s agreement for Cora’s transformation or derived representation is not established.                                                                                               | `UNKNOWN`                              | Rights for normalization, derived facts, semantic mapping, and retention of source payload.                  |
| Use FieldView Generated Works                                           | Generated Works are defined separately from Customer Farm Data and stated to be Climate-owned.                                                                                                                                        | `PROHIBITED_UNLESS_EXPRESSLY_LICENSED` | Written license covering each specific item and operation.                                                   |
| Export producer data to operator/recipient                              | v4 provides data exports and content retrieval. Customer may request specified data in same uploaded format under the consumer terms. Neither fact establishes that Cora can export API-derived data or provide it to an institution. | `UNKNOWN`                              | Partner contract, customer authorization, recipient-purpose permission, and format restrictions.             |
| Onward sharing / disclosure                                             | APIs expose data in an authenticated-user context; no Cora onward-sharing license is established.                                                                                                                                     | `UNKNOWN`                              | Express permission for named recipients, purposes, and data classes.                                         |
| Replacement-provider use                                                | No public clause reviewed grants Cora the right to transfer/use captured FieldView data with a replacement provider.                                                                                                                  | `UNKNOWN`                              | Express portability, replacement-provider, and independent-reader rights.                                    |
| Independent rehydration without FieldView                               | Cora can build this technically for a capsule; FieldView data rights after export/disconnect are not established.                                                                                                                     | `UNKNOWN`                              | Written independent rehydration and post-disconnect rights.                                                  |
| Retain after OAuth disconnect, account closure, or contract termination | No public API rule specifies Cora’s retention rights or exact revocation effects. Climate privacy terms allow some retention by Climate for stated reasons; those rules do not govern Cora.                                           | `UNKNOWN`                              | Explicit survival, deletion, expiry, backup, and post-termination terms.                                     |
| Delete when source record is removed or access is revoked               | v4 reviewed schema does not document land-record deletion events; no API revocation/deletion propagation contract was identified.                                                                                                     | `UNKNOWN`                              | Source deletion notification/reconciliation and Cora deletion obligations, including derived/capsule copies. |
| Commercial use                                                          | Public consumer Terms and API docs do not establish Cora’s commercial API/data license.                                                                                                                                               | `UNKNOWN`                              | Partner agreement expressly covers Cora’s commercial purpose.                                                |
| AI/model training, evaluation, inference, or derived model use          | No applicable Cora permission established by API docs, OAuth scopes, ownership statement, or privacy statement.                                                                                                                       | `UNKNOWN`                              | Express permission or exclusion for each AI/model use.                                                       |

## Climate privacy/account deletion is not Cora authorization

The public Privacy Statement describes how Climate processes personal data,
lists retention and consumer-rights mechanisms, and states that account
deactivation or permanent deletion can be requested. It also allows some
information to be retained by Climate for legal and internal operational
purposes. These clauses address Climate’s own service/account obligations;
they do not state what Cora must retain, delete, export, or continue using
after a user disconnects an application.

## Runtime policy

The provider-neutral connector governance contract remains controlling. A
future capability must carry distinct capability, source-right,
retention-right, transformation-right, disclosure-right,
rehydration-right, and freshness states. If a required right is unknown,
absent, expired, or outside scope, the operation must fail closed. No
positive state in this matrix should be inferred from a working API call.

**Current conclusion:** No live FieldView data operation is authorized for
Cora by this public-document qualification.
