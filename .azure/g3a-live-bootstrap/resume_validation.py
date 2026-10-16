"""Complete policy/default-effect review before provider validation."""

from pathlib import Path

from preflight import baseline, fresh
from validation import finish_policy_and_reads, load


fresh("CONCURRENCY_POLICY_CONTINUATION.json", baseline())
finish_policy_and_reads(load("AUTHORITY_BINDING.json"), load("POLICY_ASSIGNMENTS.json")["value"],
                        Path(load("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]))
