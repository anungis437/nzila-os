"""Complete relevant public pricing pagination; no authenticated endpoints."""

import urllib.parse

from collect_public import fetch
from prepare import HERE, baseline, ensure, fresh, load, sha, write


def main():
    fresh("CONCURRENCY_PUBLIC_FINISH.json", baseline())
    query = "productName eq 'Virtual Network Private Link' and priceType eq 'Consumption'"
    url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode({
        "api-version": "2023-01-01-preview", "currencyCode": "'CAD'", "$filter": query,
    })
    raw, final = fetch(url)
    path = HERE / "public" / "PRICE_PE_PROCESSING.json"
    write(path, raw)
    sources = [{"path": str(path), "url": url, "finalUrl": final, "sha256": sha(path)}]
    next_url = load(HERE / "public" / "PRICE_BANDWIDTH.json").get("NextPageLink")
    page = 2
    while next_url:
        parsed = urllib.parse.urlsplit(next_url)
        ensure(parsed.scheme == "https" and parsed.hostname == "prices.azure.com" and page <= 8,
               "PUBLIC_PAGINATION_HOST_OR_BOUND")
        raw, final = fetch(next_url)
        path = HERE / "public" / ("PRICE_BANDWIDTH_PAGE" + str(page) + ".json")
        write(path, raw)
        sources.append({"path": str(path), "url": next_url, "finalUrl": final, "sha256": sha(path)})
        next_url = load(path).get("NextPageLink")
        page += 1
    fresh("PUBLIC_PRICING_PAGINATION.json", {"status": "PASS", "sources": sources,
          "bandwidthPaginationComplete": next_url is None, "authenticatedCalls": 0})
    print("RELEVANT_PUBLIC_PRICING_PAGINATION_COMPLETE")


if __name__ == "__main__":
    main()
