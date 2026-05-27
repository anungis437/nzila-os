# Quick Start

Get running in under 5 minutes.

## Prerequisites

- Node.js 20+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- PostgreSQL 17 (local or Docker)
- Git

## Setup

```bash
git clone https://github.com/anungis437/nzila-os.git
cd nzila-os
pnpm install
```

## Run an App

```bash
pnpm dev:web          # Marketing/landing site — http://localhost:3000
pnpm dev:console      # Internal ops console — http://localhost:3001
pnpm dev:flow         # Flow app — http://localhost:3002
```

Or start everything:

```bash
pnpm dev
```

## Validate Your Setup

```bash
pnpm typecheck        # Should pass with 0 errors
pnpm lint             # Linting
pnpm test:fast        # Fast tests (skip contract tests)
```

## Database

```bash
pnpm exec tsx scripts/db/doctor.ts        # Check DB health
```

For local development with Docker:

```bash
docker compose up -d  # Starts PostgreSQL on port 5433
```

Connection: `postgresql://nzila:nzila_dev@localhost:5433/nzila_automation`

## Environment

Copy environment templates:

```bash
cp ops/environments/local.env .env.local
```

## What to Read Next

- [COMMANDS.md](COMMANDS.md) — Full command reference
- [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md) — How the repo is organized
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) — Technical architecture
