# PRD Management

## Listing PRDs

```bash
# List PRDs grouped by feature (tree view)
codespring prds
```

Returns PRDs organized by feature with: id, name, featureName, prdType.

## Getting PRD Content

```bash
# Get full PRD with markdown content
codespring prd <prd-id>
```

Returns:
- `id`, `name`, `projectId`, `projectName`
- `featureName`, `featureSlug`, `prdSlug`
- `content` — Full markdown content
- `suggestedPath` — e.g., `.codespring/PRDs/{feature-slug}/{prd-slug}.md`
- `createdAt`, `updatedAt`

## Syncing PRD Content

Update a PRD's content from a local file:

```bash
# From file
codespring prd sync <prd-id> --file ./path/to/prd.md

# From stdin (pipe from another command)
cat generated-prd.md | codespring prd sync <prd-id> --stdin

# Optionally update the name too
codespring prd sync <prd-id> --file ./prd.md --name "Updated PRD Title"
```

## PRD Types

- **frontend** — UI/UX specifications, component designs
- **backend** — API endpoints, business logic, data flow
- **database** — Schema design, migrations, data models

## Export Workflow

To export all PRDs to local files:

```bash
# 1. List PRDs to get IDs and suggested paths
codespring prds

# 2. For each PRD, get content and write to suggested path
codespring prd <id>
# Extract content field and write to suggestedPath
```
