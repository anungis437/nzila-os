# UE invoice generation — ambiguous active subscription guard

Source commits: `3d8694d4aff8faccc35bd9fa9292d073958b35cc`, `a43d0f7e00c9abf96738875ef4f51547d2e3f902`.

The invoice-generation service previously used `limit(1)` for active subscriptions, silently choosing an arbitrary pricing plan when multiple active subscriptions existed. The service now reads at most two active subscriptions scoped to the requested organization and refuses generation if more than one exists. A regression test asserts refusal before plan lookup, ledger append or invoice audit.

**Qualification:** Source-level implementation and regression-test authoring only. The test has not been observed passing at this HEAD. Native PostgreSQL 15/16 concurrency, tenant-context enforcement, atomic authorization and HTTP/staging proof are outstanding. The read-before-write race, invoice uniqueness and exactly-once issuance remain unresolved; this guard does not establish those properties.

No frozen 777-defect register, 150-item index or qualification artifact was edited. No defect is marked CLOSED and no independent institutional decision is inferred.
