"""Public CAD retail observations, bounded pagination and explicit failures."""

import datetime
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


HERE = Path(__file__).resolve().parent
QUERIES = {
    "ACA": "serviceName eq 'Azure Container Apps'",
    "DNS": "serviceName eq 'Azure DNS'",
    "ILB": "serviceName eq 'Load Balancer'",
    "FIREWALL": "serviceName eq 'Azure Firewall'",
    "VM": "serviceName eq 'Virtual Machines' and armSkuName eq 'Standard_B2s'",
    "DISK": "serviceName eq 'Storage' and contains(productName, 'Managed Disks')",
    "KEYVAULT": "serviceName eq 'Key Vault'",
}


def main():
    phase = sys.argv[1] if len(sys.argv) == 2 else "initial"
    if phase not in {"initial", "supplemental", "infrastructure"}:
        raise RuntimeError("usage: public_prices.py [supplemental|infrastructure]")
    supplemental = phase != "initial"
    queries = {
        "ILB": "contains(productName, 'Load Balancer')",
        "FIREWALL_PRIMARY": "serviceName eq 'Azure Firewall' and meterName eq 'Basic Data Processed'",
        "VAULT_OPERATIONS_PRIMARY": "serviceName eq 'Key Vault' and meterName eq 'Operations'",
    } if supplemental else QUERIES
    if phase == "infrastructure":
        prior = json.loads((HERE / "PUBLIC_CAD_PRICING.json").read_text())
        rows = [
            row for item in prior["observations"] if item["component"] == "FIREWALL"
            for page in item["pages"] for row in page["response"]["Items"]
            if row["meterName"] == "Basic Data Processed"
        ]
        if len(rows) != 1:
            raise RuntimeError("exact Basic firewall meter unresolved")
        queries = {
            "PROVIDER_EGRESS_IP": "serviceName eq 'Virtual Network' and contains(meterName, 'IP')",
            "FIREWALL_BY_METER": "meterId eq '" + rows[0]["meterId"] + "'",
        }
    observations = []
    for name, query in queries.items():
        region = "" if supplemental else " and (armRegionName eq 'canadacentral' or armRegionName eq '')"
        full = "(" + query + ")" + region + " and priceType eq 'Consumption'"
        url = "https://prices.azure.com/api/retail/prices?" + urllib.parse.urlencode({
            "api-version": "2023-01-01-preview", "currencyCode": "CAD", "$filter": full,
        })
        result = {"component": name, "filter": full, "pages": [], "complete": False}
        for page in range(3):
            try:
                with urllib.request.urlopen(url, timeout=45) as response:
                    data = json.load(response)
            except urllib.error.HTTPError as error:
                result["error"] = {"type": "HTTPError", "status": error.code, "url": url}
                break
            except urllib.error.URLError as error:
                result["error"] = {"type": "URLError", "reason": str(error.reason), "url": url}
                break
            result["pages"].append({"url": url, "response": data})
            url = data.get("NextPageLink")
            if not url:
                result["complete"] = True
                break
        observations.append(result)
        print(name, "COMPLETE" if result["complete"] else "UNRESOLVED",
              sum(len(x["response"]["Items"]) for x in result["pages"]), flush=True)
    name = {
        "initial": "PUBLIC_CAD_PRICING.json",
        "supplemental": "PUBLIC_CAD_PRICING_SUPPLEMENTAL.json",
        "infrastructure": "PUBLIC_CAD_PRICING_INFRASTRUCTURE.json",
    }[phase]
    with (HERE / name).open("x", encoding="utf-8") as file:
        json.dump({
            "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "currency": "CAD", "publicUnauthenticatedRequests": True,
            "observations": observations, "azureResourceCalls": 0,
        }, file, indent=2)
        file.write("\n")


if __name__ == "__main__":
    main()
