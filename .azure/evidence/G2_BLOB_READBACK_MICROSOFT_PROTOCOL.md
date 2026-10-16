# Microsoft ACR private blob data-path contract

Reviewed on 2026-10-11 for `G2_STAGE2A_PRIVATE_BLOB_READBACK_CLOSURE`.
This is documentary evidence, not a runtime PASS or permission to mutate state.

Microsoft's [dedicated data endpoint documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-dedicated-data-endpoints)
(page metadata updated 2026-06-23) describes authentication/content discovery
against the login server, then a 307 redirect to the region-scoped data
endpoint for layer blob downloads. A temporary download link is issued by
ACR. Its query and signature remain memory-only in this observer.

Microsoft's [Private Endpoint documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-private-endpoints)
describes one private IP for the global registry endpoint and another per
geo-replica data endpoint. Dedicated data endpoints are enabled automatically
for Private Endpoint configurations. Client private DNS and reachability must
cover both endpoint classes; presenting the login hostname to the data
endpoint is not an equivalent TLS/HTTP request.

Current read-only ARM correlation in
[fresh mapping evidence](G2_BLOB_READBACK_DNS_ENDPOINT_MAPPING.json)
reconciles these endpoint classes with exact private DNS A records, the
Private Endpoint NIC's private-link FQDN/IP mappings, and the DNS zone group:

| Endpoint | Expected private IP |
|---|---|
| nzilag2tzo75uuozprbo.azurecr.io | 10.90.2.5 |
| nzilag2tzo75uuozprbo.canadacentral.data.azurecr.io | 10.90.2.4 |

The observer will separately verify builder-side resolution, certificate/SNI,
HTTP status and byte/hash behavior. It must stop on any unexpected host,
mapping or response. There is no authorized DNS, firewall, Private Link,
network bypass, RBAC, import or staging repair in this slice.
