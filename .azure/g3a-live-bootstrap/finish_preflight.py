"""Continue read-only preflight using preserved numeric-string usage evidence."""

from datetime import datetime, timezone
import json

from preflight import HERE, baseline, finish_quota_and_handler, fresh


def value(name):
    return json.loads((HERE / name).read_text())["value"]


def main():
    fresh("CONCURRENCY_PREFLIGHT_NUMERIC_CORRECTION.json", baseline())
    authority = json.loads((HERE / "AUTHORITY_BINDING.json").read_text())
    cidr = json.loads((HERE / "CIDR_SELECTION.json").read_text())
    finish_quota_and_handler(value("PRINCIPAL.json"), value("QUOTA_CLI.json"), value("COMPUTE_USAGE.json"),
                            cidr["chosen"], authority["resourceGroupCandidate"])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        fresh("PREFLIGHT_FINAL_STOP.json", {"status": "STOP_BEFORE_MUTATION", "reason": str(error),
              "authorityConsumed": False, "AZURE_MUTATIONS": 0,
              "utc": datetime.now(timezone.utc).isoformat()})
        raise
