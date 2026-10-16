"""Preserve failed role CLI invocation and finish corrected read-only gates."""

from pathlib import Path

from preflight import baseline, fresh
from validation import finish_role_and_whatif, load


fresh("CONCURRENCY_ROLE_QUERY_CORRECTION.json", baseline())
finish_role_and_whatif(load("AUTHORITY_BINDING.json"),
                      Path(load("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]))
