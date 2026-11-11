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
repair. The helper is restricted to root on Ubuntu GitHub Actions runners. It
preserves package suites, components and `Signed-By` directives, leaves other
repositories unchanged, and is idempotent. It adds no trust bypass, TLS exception,
package omission, test filter or secret permission. Existing Playwright dependency
installation, browser installation, timeouts and assertions remain unchanged.

The disposable source-configuration probe passed. Corrective CI must still
install the dependencies and run every existing browser suite successfully;
neither a fixture check nor a vendor DNS failure qualifies staging acceptance.
