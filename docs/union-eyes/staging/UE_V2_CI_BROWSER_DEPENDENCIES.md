# Browser qualification runner dependency recovery

Browser QA on source `597efd5f13579b1bd84fbfac114926d920fb2cfa` and its authorization
branch failed before tests, twice: Ubuntu's `mirror+file` APT transport retained
`azure.archive.ubuntu.com`, whose DNS lookup failed on the hosted runners. The
fallback URLs in the error text did not establish a successful fallback. The
[measured failure and fixture receipt](evidence/ue-v2-browser-runner-mirror-20261111.json)
records the actual runs and dependency phase.

The E2E workflow now selects the official `https://archive.ubuntu.com/ubuntu`
and `https://security.ubuntu.com/ubuntu` transport URIs directly before both
browser dependency-install paths. Both endpoints answered HTTP 200 during the
repair. The helper is restricted to root on Ubuntu GitHub-hosted Linux runners. It
preserves package suites, components and `Signed-By` directives, leaves other
repositories unchanged, and is idempotent. It adds no trust bypass, TLS exception,
package omission, test filter or secret permission. Existing Playwright dependency
installation, browser installation, timeouts and assertions remain unchanged.

The disposable source-configuration probe passed. Corrective CI must still
install the dependencies and run every existing browser suite successfully;
neither a fixture check nor a vendor DNS failure qualifies staging acceptance.

The direct-archive candidate `762a28d7782c825c93e3c80b240fcf24ada5e550`
still failed in [run 43040090860](https://github.com/anungis437/nzila-os/actions/runs/43040090860):
the runner resolver also failed for `archive.ubuntu.com`. The helper now obtains
fresh public IPv4 answers for only the two fixed Ubuntu hosts from Google's
[validated HTTPS DNS API](https://developers.google.com/speed/public-dns/docs/doh/json).
It retains default certificate verification, requests DNS validation, rejects
private addresses, truncated responses and expired answers, and changes only
its marked entries in the disposable runner's hosts file. Other host entries,
system DNS configuration and repository trust remain unchanged. Existing
unowned Ubuntu overrides cause a failure for review. Self-hosted runners are
refused.

The URI rewrite matches complete transport tokens, addressing the security
scan's substring-matching finding without suppressing the alert. Six offline
regression checks run before either privileged bootstrap step. The latest
[source-only receipt](evidence/ue-v2-browser-runner-dns-20261111.json) records
these checks; complete hosted CI and real staging qualification remain pending.
