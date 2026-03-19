# @nzila/platform-marketplace

Provider marketplace with manifest registry, installation workflows, secrets management, and configuration export.

## Capabilities

| Area | Functions |
|------|-----------|
| **Registry** | `ProviderRegistry` — provider manifest storage and discovery |
| **Installer** | `installProvider`, `uninstallProvider` — provider installation lifecycle |
| **Exporter** | `exportProviderConfigs` — export provider configurations |

## Source Layout

```
src/
├── exporter.ts
├── installer.ts
├── registry.ts
├── types.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — marketplace type definitions
- `./registry` — provider manifest registry
- `./installer` — installation workflows
- `./exporter` — configuration export
