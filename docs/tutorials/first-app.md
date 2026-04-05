# Tutorial: Your First App in Nzila OS

**Time**: 15 minutes  
**Goal**: Scaffold a new Next.js app, connect it to the platform, and see it running.

## Prerequisites

- DevContainer running (VS Code → "Reopen in Container")
- `pnpm dev` running in background

## Step 1: Scaffold with Backstage (or manually)

### Option A: Backstage Template

If Backstage is configured, use the **Next.js App** template to scaffold.

### Option B: Manual

```bash
# From repo root
mkdir -p apps/my-app
cd apps/my-app
```

Create `package.json`:

```json
{
  "name": "@nzila/my-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3020",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0"
  },
  "dependencies": {
    "@nzila/os-core": "workspace:*",
    "@nzila/ui": "workspace:*",
    "@nzila/platform-auth": "workspace:*",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

## Step 2: Add Instrumentation

Create `instrumentation.ts` in your app root:

```typescript
import { initOtel, initMetrics } from '@nzila/os-core/telemetry';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    initOtel('my-app');
    initMetrics('my-app');
  }
}
```

## Step 3: Add Authentication

Create `middleware.ts`:

```typescript
import { clerkMiddleware } from '@nzila/platform-auth/entra/server';

export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

## Step 4: Create Your First Page

Create `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My Nzila App</h1>
      <p>Connected to the platform.</p>
    </main>
  );
}
```

## Step 5: Register in Turbo Pipeline

Add your app to `pnpm-workspace.yaml` (it's likely already included via `apps/*`).

Run:

```bash
pnpm install
pnpm dev:my-app  # or add a dev script
```

## Step 6: Create a Backstage Catalog Entry

Create `apps/my-app/catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-app
  description: My first Nzila app
  annotations:
    github.com/project-slug: nzila/nzila-automation
spec:
  type: website
  lifecycle: development
  owner: my-team
  system: nzila-os
```

## Verification

- [ ] App starts on assigned port
- [ ] Clerk authentication redirects work
- [ ] OTel traces appear in Jaeger (<http://localhost:16686>)
- [ ] App appears in Backstage catalog

## Next Steps

- [Tutorial 2: Adding AI to an App](adding-ai.md)
- [Reference: Package Catalogue](../reference/packages.md)
