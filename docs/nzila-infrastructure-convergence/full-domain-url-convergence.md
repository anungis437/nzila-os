# Full Domain / URL Convergence

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: production domains cut over in Cloudflare (zone e411d21f) to the prod app FQDNs; managed certs for www.nzilaventures.com and partners.nzilaventures.com Succeeded; both 200 + valid TLS. Apex is PARTIAL (Pending). Internal apps restricted-ingress.
