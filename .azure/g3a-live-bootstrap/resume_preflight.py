"""Resume read-only census after preserving a CLI syntax failure."""

from datetime import datetime, timezone
import json

from preflight import HERE, baseline, complete_reads, fresh


def main():
    fresh("CONCURRENCY_PREFLIGHT_CORRECTION.json", baseline())
    principal = json.loads((HERE / "PRINCIPAL.json").read_text())["value"]
    complete_reads(principal)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        fresh("PREFLIGHT_CORRECTED_STOP.json", {
            "status": "STOP_BEFORE_MUTATION", "reason": str(error), "authorityConsumed": False,
            "AZURE_MUTATIONS": 0, "utc": datetime.now(timezone.utc).isoformat()})
        raise
