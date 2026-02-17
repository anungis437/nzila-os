# Chapter 01 — Repository Bootstrap

This chapter walks through cloning **{{REPO_NAME}}**, installing dependencies,
and preparing a local development environment.

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9
- Git
- A copy of `.env.example` (provided in the repo root)

## Quick start

```bash
# Unix
./01-repo-bootstrap/setup.sh

# Windows PowerShell
./01-repo-bootstrap/setup.ps1
```

## Step-by-step

1. Clone the repository:

   ```bash
   git clone git@github.com:{{OWNER_GITHUB}}/{{REPO_NAME}}.git
   cd {{REPO_NAME}}
   ```

2. Install dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. Run initial database setup (see Chapter 04 for details):

   ```bash
   pnpm --filter {{PRIMARY_APP_PATH}} run db:push
   ```

5. Start the dev server:

   ```bash
   pnpm --filter {{PRIMARY_APP_PATH}} run dev
   ```

   The application will be available at `http://localhost:{{APP_PORT}}`.

## Parity check

Run the parity-check script to verify every `.sh` file has a matching `.ps1` and `.py`:

```bash
./01-repo-bootstrap/parity-check.sh
```

## Scripts in this chapter

| Script             | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `setup.sh`         | Full bootstrap on Unix                               |
| `setup.ps1`        | Full bootstrap on Windows                            |
| `setup.py`         | Full bootstrap (Python/cross-platform)               |
| `parity-check.sh`  | Verify .sh/.ps1/.py parity across scripts-book       |
| `parity-check.ps1` | Same parity check for PowerShell environment         |
| `parity-check.py`  | Same parity check (Python/cross-platform)            |
