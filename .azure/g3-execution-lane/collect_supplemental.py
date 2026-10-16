"""Preserve the empty NAT query and capture a corrected bounded meter query."""

import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent


def main():
    query = {
        "api-version": "2023-01-01-preview", "currencyCode": "CAD",
        "$filter": "serviceName eq 'NAT Gateway' and priceType eq 'Consumption' and "
                   "(armRegionName eq 'canadacentral' or armRegionName eq 'Global')",
    }
    url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode(query)
    with urllib.request.urlopen(url, timeout=60) as response:
        raw = response.read(1_000_001)
    if len(raw) > 1_000_000:
        raise RuntimeError("SUPPLEMENTAL_PRICING_SIZE_EXCEEDED")
    data = json.loads(raw)
    if data.get("NextPageLink") or not data.get("Items"):
        raise RuntimeError("SUPPLEMENTAL_PRICING_EMPTY_OR_INCOMPLETE")
    with (HERE / "PUBLIC_CAD_NAT_CORRECTED.json").open("x", encoding="utf-8") as file:
        json.dump({"url": url, "rawResponseSha256": hashlib.sha256(raw).hexdigest(),
                   "response": data,
                   "priorEmptyQueryPreserved": "PUBLIC_CAD_PRICING.json:observations[nat]"}, file, indent=2)
        file.write("\n")
    print("CORRECTED_NAT_PRIMARY_METERS = PASS; original empty query retained")


if __name__ == "__main__":
    main()
