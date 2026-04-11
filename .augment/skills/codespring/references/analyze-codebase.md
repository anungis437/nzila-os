# Codebase Analysis Checklist

Use this checklist when analyzing a local codebase to sync findings to CodeSpring.

## 1. Project Identity

- Read `package.json` for: name, version, description, scripts
- Read `README.md` for: description, feature list, setup instructions

## 2. Dependencies Analysis

From `package.json` dependencies/devDependencies, identify:

### Frontend Frameworks
`react`, `react-dom`, `next`, `vue`, `nuxt`, `svelte`, `solid-js`, `angular`, `astro`, `remix`

### Backend Frameworks
`express`, `fastify`, `hono`, `koa`, `nestjs`, `elysia`, `hapi`

### Database/ORM
`prisma`, `drizzle-orm`, `mongoose`, `typeorm`, `sequelize`, `knex`, `pg`, `redis`, `ioredis`

### State Management
`zustand`, `jotai`, `recoil`, `valtio`, `mobx`, `xstate`, `redux`, `@reduxjs/toolkit`

### Styling
`tailwindcss`, `styled-components`, `@emotion/react`, `sass`, `@vanilla-extract/css`

### Testing
`jest`, `vitest`, `mocha`, `cypress`, `playwright`, `@testing-library/*`

## 3. Directory Structure

| Directory | Indicates |
|-----------|-----------|
| `src/app/` | Next.js App Router |
| `src/pages/` | Next.js Pages Router |
| `src/components/` | Component library |
| `src/features/` | Feature-based architecture |
| `src/hooks/` | Custom React hooks |
| `src/lib/` or `src/utils/` | Utility functions |
| `src/services/` | API/business logic |
| `prisma/` | Prisma ORM |
| `drizzle/` | Drizzle ORM |

## 4. Feature Discovery

Identify features from:
1. **Route segments**: `/dashboard`, `/settings`, `/billing`
2. **Feature directories**: `features/auth`, `features/payments`
3. **README sections**: "Features", "What's Included"
4. **Component directories**: Major UI sections

## 5. Sync to CodeSpring

### Tech Stack
```bash
codespring mindmap tech-stack --add '[
  {"id":"tech-react","title":"React","description":"Frontend"},
  {"id":"tech-typescript","title":"TypeScript","description":"DevTools"}
]'
```

### Features
```bash
codespring mindmap features --add '[
  {"title":"Authentication","description":"User login/signup"},
  {"title":"Dashboard","description":"Main user interface"}
]'
```

### Project Metadata
Update project name/description if discovered from package.json/README.
