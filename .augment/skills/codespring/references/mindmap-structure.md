# Mindmap Structure Reference

## Node Types

### Primary Node (`node-primary`)
Central project node. Fields: `title`, `description`, `githubUrl`.

### Secondary Nodes
Major category branches from primary:
- `node-features` — Features list (items array)
- `node-tech-stack` — Technology stack (items array, grid layout)
- `node-competitors` — Market competitors
- `node-audience` — Target audience

Data structure for list nodes:
```json
{
  "title": "Features",
  "subtitle": "Core functionality",
  "handlePosition": "left",
  "layout": "list",
  "items": [
    { "id": "feature-auth", "title": "Authentication", "description": "User login" }
  ]
}
```

### Bridge Nodes
Connector between a feature item and its detail nodes.
- ID pattern: `bridge-feature-{featureId}`
- Data: `{ featureId, count, isExpanded, handlePosition }`

### Tertiary Nodes
Detail nodes attached via bridge:
- Notes: `notes-{featureId}` with `{ type: "notes", title, content }`
- PRDs: PRD-related detail nodes

## Edge/Handle Patterns

### Features → Bridge
```
source: "node-features"
target: "bridge-feature-{featureId}"
sourceHandle: "node-features-source-{featureId}"
targetHandle: "bridge-feature-{featureId}-target-{featureId}"
```

### Bridge → Notes
```
source: "bridge-feature-{featureId}"
target: "notes-{featureId}"
sourceHandle: "bridge-feature-{featureId}-source-notes"
targetHandle: "notes-{featureId}-target-notes"
```

## Tech Stack Categories

Use these in the `description` field when syncing:
- **Frontend**: react, vue, svelte, next, angular, astro
- **Backend**: express, fastify, hono, nestjs, elysia
- **Database**: prisma, drizzle, mongoose, pg, redis
- **State**: zustand, redux, jotai, mobx, xstate
- **Styling**: tailwindcss, styled-components, emotion, sass
- **Testing**: jest, vitest, playwright, cypress
- **DevTools**: typescript, eslint, prettier, biome
- **Infrastructure**: vercel, docker, aws-sdk

## Sync Commands

```bash
# Tech stack (merge by default)
codespring mindmap tech-stack --add '[{"id":"tech-react","title":"React","description":"Frontend"}]'

# Features (append by default)
codespring mindmap features --add '[{"title":"Auth","description":"Login/signup"}]'

# Feature notes (creates bridge + notes nodes automatically)
codespring mindmap note feature-auth --text "OAuth2 implementation notes..."

# Replace mode (overwrites existing items)
codespring mindmap tech-stack --add '[...]' --replace
codespring mindmap features --add '[...]' --replace
```
