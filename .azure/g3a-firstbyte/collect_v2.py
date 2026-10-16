"""Bind proof pricing to StorageV2 rather than legacy Blob Storage meters."""

import json
from urllib.parse import urlencode

from collect import baseline, capture, ensure, fresh


def main():
    fresh("CONCURRENCY_STORAGE_V2.json", baseline())
    query = {"api-version": "2023-01-01-preview", "currencyCode": "'CAD'",
             "$filter": "serviceName eq 'Storage' and armRegionName eq 'canadacentral' and "
                        "priceType eq 'Consumption' and productName eq 'General Block Blob v2'"}
    url = "https://prices.azure.com/api/retail/prices?" + urlencode(query)
    sources, pages = [], []
    while url:
        ensure(url not in pages and len(pages) < 20, "PUBLIC_PRICE_PAGINATION_INVALID")
        pages.append(url)
        raw = capture(f"PRICE_STORAGE_V2_PAGE{len(pages)}.json", url, sources)
        url = json.loads(raw)["NextPageLink"]
    fresh("PUBLIC_STORAGE_V2_LEDGER.json", {"sources": sources, "pages": pages,
          "paginationComplete": True, "reason": "EXACT_STORAGEV2_PRODUCT_BINDING_NOT_LEGACY_BLOB_STORAGE"})


if __name__ == "__main__":
    main()
