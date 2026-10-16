"""Capture public first-byte evidence without Azure account or data-plane calls."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\f78ad0bc-4f6c-4d02-85d7-1626538aca7e\Pasted text #1.txt")
CURRENT = "74f1d89ae43d1e8d1d0ffd921d3c0df3ce3decd8"
TAGGED = "aa2eb2a9724ca074044c7b8c31dfbaa4196e7942"
ALLOWED_HOSTS = {"raw.githubusercontent.com", "api.github.com", "learn.microsoft.com", "prices.azure.com"}


def ensure(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def baseline():
    result = []
    for root in (ROOT, Path(r"C:\APPS\nzila-os")):
        item = {"path": str(root)}
        for key, args in (("head", ["rev-parse", "HEAD"]), ("branch", ["branch", "--show-current"]),
                          ("status", ["--no-pager", "status", "--short"])):
            run = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, timeout=60)
            ensure(run.returncode == 0, "CONCURRENCY_READ_FAILED")
            item[key] = run.stdout.strip().splitlines() if key == "status" else run.stdout.strip()
        result.append(item)
    ensure(result[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           result[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ACTIVE_CONCURRENCY_DRIFT")
    return result


def capture(name, url, ledger):
    parsed = urlsplit(url)
    ensure(parsed.scheme == "https" and parsed.hostname in ALLOWED_HOSTS, "PUBLIC_HOST_NOT_ALLOWED")
    request = Request(url, headers={"User-Agent": "Nzila-local-firstbyte-source-qualification"})
    with urlopen(request, timeout=120) as response:
        final = urlsplit(response.url)
        ensure(final.scheme == "https" and final.hostname in ALLOWED_HOSTS, "PUBLIC_REDIRECT_NOT_ALLOWED")
        raw = response.read()
        content_type = response.headers.get("Content-Type")
    target = HERE / "public" / name
    with target.open("xb") as file:
        file.write(raw)
    ledger.append({"url": url, "path": str(target), "sha256": sha(target), "bytes": len(raw),
                   "contentType": content_type, "capturedUTC": datetime.now(timezone.utc).isoformat()})
    print("CAPTURED " + name, flush=True)
    return raw


def main():
    fresh("CONCURRENCY_COLLECT.json", baseline())
    fresh("AUTHORITY_BINDING.json", {"path": str(AUTHORITY), "sha256": sha(AUTHORITY),
          "scope": "LOCAL_SOURCE_FIXTURES_PUBLIC_DOCS_PRICING_ONLY",
          "AzureEntraRegistryCallsAuthorized": False,
          "priorTransactionRoot": "0c216d4b17146236bf632640df6fef84c31deea7a9d814637e14714f6e0859a4"})
    (HERE / "public").mkdir(exist_ok=False)
    ledger = []
    capture("CURRENT_COMMIT.json",
            f"https://api.github.com/repos/Azure/custom-script-extension-linux/commits/{CURRENT}", ledger)
    capture("TAGS.json", "https://api.github.com/repos/Azure/custom-script-extension-linux/tags?per_page=10", ledger)
    for label, commit in (("CURRENT", CURRENT), ("V2_1_17", TAGGED)):
        for path in ("main/files.go", "main/exec.go", "main/main.go", "main/cmds.go",
                     "main/handlersettings.go", "main/schema.go", "pkg/download/save.go",
                     "pkg/download/blobwithmsitoken.go", "pkg/download/retry.go", "pkg/download/downloader.go"):
            capture(label + "_" + path.replace("/", "_"),
                    f"https://raw.githubusercontent.com/Azure/custom-script-extension-linux/{commit}/{path}", ledger)
    for name, url in (
        ("CSE_LINUX.html", "https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/custom-script-linux"),
        ("GET_BLOB.html", "https://learn.microsoft.com/en-us/rest/api/storageservices/get-blob"),
        ("BLOB_VERSIONING.html", "https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview"),
        ("BLOB_PRIVATE_ENDPOINT.html", "https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints"),
        ("BLOB_RBAC.html", "https://learn.microsoft.com/en-us/azure/storage/blobs/assign-azure-role-data-access"),
    ):
        capture(name, url, ledger)
    query = {"api-version": "2023-01-01-preview", "currencyCode": "'CAD'",
             "$filter": "serviceName eq 'Storage' and armRegionName eq 'canadacentral' and "
                        "priceType eq 'Consumption' and skuName eq 'Hot LRS'"}
    url = "https://prices.azure.com/api/retail/prices?" + urlencode(query)
    pages = []
    while url:
        ensure(url not in pages and len(pages) < 20, "PUBLIC_PRICE_PAGINATION_INVALID")
        pages.append(url)
        raw = capture(f"PRICE_BLOB_PAGE{len(pages)}.json", url, ledger)
        url = json.loads(raw)["NextPageLink"]
    fresh("PUBLIC_SOURCE_LEDGER.json", {"sources": ledger, "pricePages": pages,
          "pricePaginationComplete": True, "AzureEntraRegistryCalls": 0})
    print("PUBLIC_SOURCE_CAPTURE_COMPLETE", flush=True)


if __name__ == "__main__":
    main()
