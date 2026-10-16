# @nzila/tool-fabric

Domain and policy layer for the Agent Tool Fabric. Pure functions and in-memory registries;
**no executor, installer, network access, or persistence**.

See [docs/architecture/AGENT_TOOL_FABRIC.md](../../docs/architecture/AGENT_TOOL_FABRIC.md) and
[ADR-TF-001](../../docs/architecture/ADR-TF-001-cli-anything-external-tool-provider.md).

## Posture

- Discovery is not authorization; only a human/governance trust decision grants execution.
- External descriptors cannot carry trust or grant fields.
- Execution and installation are deny-by-default.
- `SKILL.md` and other external text are untrusted data with `authority: 'NONE'`.

## Exports

`ToolProviderRegistry`, `ToolRegistry`, `ToolPolicy`, `parseSkillDocument`,
`HarnessLifecycle`, `normalizeCliHubEntry`, and the types in `./types`.
