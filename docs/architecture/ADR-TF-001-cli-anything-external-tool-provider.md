# ADR-TF-001: CLI-Anything as an External Tool Provider

> **Status:** Proposed (pilot; maintainers own acceptance)
> **Date:** 2026-10-16
> **Branch:** `agents/cli-anything-integration`
> **Scope:** Architecture decision only. No runtime executor, no installation, no deployment.

## Context

[CLI-Anything](https://github.com/HKUDS/CLI-Anything) (Apache-2.0) is a methodology plus
plugin for generating stateful, JSON-emitting CLI "harnesses" for existing software, and
**CLI-Hub**, a registry and `pip`-based package manager for those harnesses.

NzilaOS has no agent-fleet or tool registry today. The nearest primitives are
[`@nzila/doctrine-enforcement`](../../packages/doctrine-enforcement) (strict, doctrine-cited
capability registration with categorical refusal), `@nzila/ai-core` action policy
(deterministic, deny-by-default checks) and `@nzila/tools-runtime` (a handful of
first-party tools). None model external executables.

## Upstream components evaluated

| Component | Finding |
| --- | --- |
| `cli-anything-plugin/HARNESS.md` and `commands/cli-anything.md` | Seven-phase SOP (analyse, design, implement, test plan, tests, docs, `SKILL.md`, PyPI packaging). Requires a **source path or repo URL**, not just a name. Pure methodology; usable without importing code. |
| Generated harness | Click CLI, REPL plus one-shot commands, `--json` output, session state on disk, `utils/<software>_backend.py` that shells out to the real application via `subprocess`. Generated code is arbitrary executable code. |
| Generated `SKILL.md` | YAML frontmatter plus Markdown describing command groups. Free text, authored by a generator or contributor. |
| CLI-Hub `registry.json` | Entries carry `install_cmd` such as `pip install git+https://github.com/HKUDS/CLI-Anything.git#subdirectory=<x>/agent-harness`. This is a **mutable git ref with no digest or version pin**. No signature or digest fields. |
| CLI-Hub package manager | `cli-hub install <name>` runs `pip`; designed so agents can self-install. Sends anonymous analytics to PostHog by default; opt-out is `CLI_HUB_NO_ANALYTICS=1`. |
| Cursor integration | Supported as a *generator* environment (host agent runs the methodology). |

## Decision

**CLI-Anything is an external development-time harness generator (option C) and an
external registry provider (option D), consumed only behind NzilaOS-owned governance
interfaces (option E).** It is not vendored (A) and not a runtime dependency (B).

- Provider-neutral domain primitives live in [`@nzila/tool-fabric`](../../packages/tool-fabric).
  CLI-Hub and the CLI-Anything generator appear only as two *provider descriptors* with
  `authority: 'NONE'`; other providers (MCP, native CLIs, APIs) register the same way.
- Nothing from upstream is copied. We reuse the **methodology** (HARNESS.md phases) as the
  reference procedure for generation requests, and the **registry/`SKILL.md` formats** as
  *input data* normalised by NzilaOS parsers.
- No Python package, CLI-Hub, or CLI-Anything plugin is installed by this change.

## Consequences

**Reused:** the harness methodology; the JSON-output convention; the registry listing as a
discovery signal; `SKILL.md` as capability *metadata*.

**Remains external:** CLI-Hub packages and their installer, generated harness code until
reviewed, the upstream repository and its release cadence.

**Rejected:**

- Letting agents run `cli-hub install` (agent -> `pip install` -> shell is a governance failure).
- Treating registry presence, popularity, or a generated `SKILL.md` as authorization.
- Installing from `git+...` without an immutable commit pin and recorded digest.

**Trust boundary:** every external tool, README, registry description, `SKILL.md`, help text
and command output is untrusted data. Only a NzilaOS trust decision (human reviewer or
governance body, with evidence and an explicit scoped grant) can grant execution.
See [AGENT_TOOL_FABRIC.md](./AGENT_TOOL_FABRIC.md).

**Supply chain:** approval requires an exact version, a pinned `sha256` digest, a reviewed
licence and a non-mutable upstream; upstream drift is detectable and approval revocable.
Because the registry publishes mutable install refs, **no CLI-Hub entry can be approved
as listed**; it must be re-pinned (commit SHA or built artefact digest) by a governed
installer first.

**Telemetry:** third-party analytics default to off. The broker forces
`CLI_HUB_NO_ANALYTICS=1` for CLI-Hub tools and rejects any agent attempt to set it.

## Licence implications

Apache-2.0 permits use, modification and redistribution with notice. Because we neither
vendor nor redistribute upstream code, no NOTICE obligations are triggered now. If upstream
files (for example `repl_skin.py` or templates) are ever incorporated, preserve the licence
text, copyright notices and a statement of changes, and record the incorporation in
`THIRD_PARTY` notices. Each generated harness and each CLI-Hub package has its **own**
licence (the harnesses wrap GPL/LGPL/proprietary applications); approval requires a
reviewed licence per tool, not an inherited Apache-2.0.

## Future agent (not created here)

A **TOOLSMITH** specialist could search approved registries, propose candidates, file
harness-generation requests and prepare evidence. It would hold no approval or generic
execution authority. Not created: no fleet registry exists to host it.

## Alternatives considered

1. **Vendor CLI-Anything** — unneeded code surface and update burden; rejected.
2. **Runtime dependency on `cli-hub`** — hands install/exec to an external package manager; rejected.
3. **Do nothing** — leaves future MCP/CLI/API tooling without a shared trust model; rejected.
