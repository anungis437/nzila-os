"""Recover only missing public captures without overwriting successful ones."""

import urllib.parse

from collect_public import DOCS, FILTERS, fetch
from prepare import HERE, baseline, fresh, load, sha, write


def main():
    fresh("CONCURRENCY_PUBLIC_SUPPLEMENT.json", baseline())
    extra = {
        "PE_CORRECTED": "serviceFamily eq 'Networking' and contains(meterName, 'Private') and priceType eq 'Consumption'",
        "VM_BOUND": "serviceName eq 'Virtual Machines' and armRegionName eq 'canadacentral' and armSkuName eq 'Standard_B2s' and priceType eq 'Consumption'",
    }
    ledger = []
    for name, query in {**FILTERS, **extra}.items():
        path = HERE / "public" / ("PRICE_" + name + ".json")
        if path.exists():
            ledger.append({"name": name, "status": "PREVIOUS_SUCCESS_PRESERVED", "sha256": sha(path),
                           "NextPageLink": load(path).get("NextPageLink")})
            continue
        url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode({
            "api-version": "2023-01-01-preview", "currencyCode": "'CAD'", "$filter": query})
        try:
            raw, final = fetch(url)
            write(path, raw)
            ledger.append({"name": name, "status": "PASS", "url": url, "finalUrl": final, "sha256": sha(path)})
        except (OSError, ValueError) as error:
            ledger.append({"name": name, "status": "FAIL_EXPLICIT", "url": url, "errorType": type(error).__name__})
    for name, url in DOCS.items():
        path = HERE / "public" / (name + ".txt")
        ledger.append({"name": name, "url": url, "status": "PASS" if path.exists() else "FAIL_RETAINED_404",
                       "sha256": sha(path) if path.exists() else None})
    fresh("PUBLIC_SOURCE_LEDGER.json", {
        "requests": ledger, "initialCollectorFailure": "PUBLIC_BANDWIDTH_API_HTTP429_AFTER_FIVE_PRICING_SUCCESSES",
        "publicSource404": "CSE_SOURCE_DOWNLOAD_GO_NOT_FOUND_NO_SOURCE_CLAIM",
        "cloudControlPlaneCalls": 0, "registryDataPlaneCalls": 0,
    })
    print("PUBLIC_SUPPLEMENT_CAPTURE_RECORDED_WITH_EXPLICIT_FAILURES")


if __name__ == "__main__":
    main()
