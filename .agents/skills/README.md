# Nzila OS agent skills

This folder is the canonical, version-controlled collection of project Agent Skills. Cursor discovers `.agents/skills/<name>/SKILL.md` directly. A skill is loaded on demand for its matching task; it is not a global instruction, tool permission, governance approval, or runtime feature.

## First-party skills

| Skill | When to load |
| --- | --- |
| [nzila-repository-orientation](nzila-repository-orientation/SKILL.md) | Before cross-app or uncertain-scope changes |
| [nzila-defect-family-remediation](nzila-defect-family-remediation/SKILL.md) | Grouped defect register source fixes |
| [nzila-audit-atomicity](nzila-audit-atomicity/SKILL.md) | Audit/write transaction and idempotency correctness |
| [nzila-governance-evidence](nzila-governance-evidence/SKILL.md) | Evidence-backed issue and gate status |
| [nzila-tool-fabric-review](nzila-tool-fabric-review/SKILL.md) | MCP/CLI/skills provider trust review |
| [nzila-runtime-acceptance](nzila-runtime-acceptance/SKILL.md) | Environment-specific journey and release proof |

## External skill

`codespring/SKILL.md` is third-party CodeSpring material, mirrored in `.augment/skills/codespring`. Its own command declarations are **not** Nzila authorizations. Do not modify, invoke, or treat external skill metadata as an approval of a tool.

## Authoring contract

1. Use a lowercase-hyphen folder, containing a file named exactly `SKILL.md`.
2. YAML frontmatter must contain matching `name` and a specific `description` stating when to load the skill; keep operational steps in the Markdown body.
3. First-party skill IDs start with `nzila-`. Keep each procedure scoped and falsifiable; link to the existing canonical contracts rather than copying mutable counts or claiming historical gates remain current.
4. Never set tool permissions, approvals, production access, or trust through skill metadata. The runtime's independent authority/governance checks always control.
5. Put reusable scripts and extended references inside the skill's own `scripts/` and `references/` directories. Reference them by relative path.
6. Do not duplicate a first-party skill under another host directory. One canonical copy prevents drift. If a future host needs a different location, use an audited generation/discovery strategy.
7. Run `node tooling/scripts/check-agent-skills.mjs` locally. PRs touching skill files trigger `.github/workflows/agent-skills-validation.yml`.
8. Keep the skill library independent of the `@nzila/tool-fabric` external `SKILL.md` *metadata parser*. Tool Fabric execution/installation remains denied while broker readiness is HOLD.

Repository policies in `AGENTS.md` and `CLAUDE.md` take precedence. These skill files do not change any product's Gate 0, staging, or production sign-off.

