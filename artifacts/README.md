# Artifacts

Working artifact outputs for pilots, QA, and supporting operational flows.

## Areas

- [ai-dev-agent/](./ai-dev-agent/) - Agent-generated development artifacts
- [commercial/](./commercial/) - Commercial artifacts and assets
- [ue-pilot-dryrun/](./ue-pilot-dryrun/) - Union Eyes pilot dry-run outputs
- [ue-pilot-launch/](./ue-pilot-launch/) - Union Eyes launch-phase artifacts
- [ue-qa/](./ue-qa/) - QA artifacts and evidence

## Runtime/Debug Buckets

- [runtime/](./runtime/) - Consolidated runtime/debug artifacts
	- [runtime/ci-debug/](./runtime/ci-debug/) - CI troubleshooting outputs
	- [runtime/logs/](./runtime/logs/) - Execution logs and captures
	- [runtime/ue-pw/](./runtime/ue-pw/) - Playwright outputs (set 1)
	- [runtime/ue-pw2/](./runtime/ue-pw2/) - Playwright outputs (set 2)
	- [runtime/ue-srv/](./runtime/ue-srv/) - Service runtime captures (set 1)
	- [runtime/ue-srv2/](./runtime/ue-srv2/) - Service runtime captures (set 2)
	- [runtime/ue3/](./runtime/ue3/) - Additional Union Eyes runtime artifacts

## Optimization Notes

This folder is intentionally environment-oriented. Instead of deep nesting, categories reflect execution surfaces (pilot, QA, runtime, commercial) for quick triage.
