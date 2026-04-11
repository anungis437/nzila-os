---
name: codespring
description: >
  Project planning and management with CodeSpring. Use when the user wants to
  work with CodeSpring projects, tasks, PRDs, mindmaps, or analyze a codebase
  for project planning. Handles workspace selection, project linking, task
  management, and syncing findings to CodeSpring.
allowed-tools: Bash(codespring:*) Bash(npx @codespring-app/cli:*)
metadata:
  author: codespring
  version: "1.0"
---

# CodeSpring CLI

Manage project planning: workspaces, projects, tasks, PRDs, and mindmaps.

## Prerequisites

- **CLI installed**: `npm i -g @codespring-app/cli` or use `npx @codespring-app/cli`
- **Authenticated**: Run `codespring auth status` to check. Login with `codespring auth login`.
- **Project linked**: Check for `.codespring/config.json` or run `codespring init`.

## Quick Start

```bash
# 1. Check auth
codespring auth status

# 2. Link project (interactive — picks workspace → project → writes config)
codespring init

# 3. Start working
codespring tasks --status todo
```

## Core Commands

| Command | Purpose |
|---------|---------|
| `codespring workspaces` | List available workspaces |
| `codespring projects [--org ID]` | List projects |
| `codespring project create --name <n>` | Create a new project |
| `codespring features` | List features for linked project |
| `codespring feature create --title <t>` | Create a feature |
| `codespring tasks [--status S] [--feature ID]` | List tasks with filters |
| `codespring task create --title <t> [--priority P]` | Create a task |
| `codespring task start <id>` | Mark task as in_progress |
| `codespring task done <id>` | Mark task as done |
| `codespring task update <id> --status <s>` | Update task fields |
| `codespring prds` | List PRDs by feature |
| `codespring prd <id>` | Get full PRD content |
| `codespring prd sync <id> --file <path>` | Update PRD from file |
| `codespring mindmap` | Get mindmap structure |
| `codespring mindmap set-info --title <t>` | Update project info node |
| `codespring mindmap tech-stack --add '<json>'` | Sync tech stack |
| `codespring mindmap features --add '<json>'` | Sync features |
| `codespring mindmap note <featureId> --text '...'` | Add feature notes |
| `codespring schema` | Data schema reference |
| `codespring node-types` | Mindmap node type reference |

**Note:** Task IDs can be UUIDs or row numbers (e.g., `task start 1` picks the first task from the list).

## Output

All commands default to markdown in terminals, JSON when piped.
Add `--json` to force JSON, `--pretty` for formatted JSON, `--md` for markdown.

## Agentic Task Workflow

```bash
# 1. Find available work
codespring tasks --status todo

# 2. Claim a task (UUID or row number)
codespring task start 1

# 3. Do the work using your coding tools

# 4. Mark done
codespring task done 1

# Or create a new task
codespring task create --title "Fix login bug" --priority high
```

## Syncing Codebase Analysis

After analyzing a codebase, sync findings:

```bash
# Sync detected technologies
codespring mindmap tech-stack --add '[{"id":"tech-react","title":"React","description":"Frontend"}]'

# Sync discovered features
codespring mindmap features --add '[{"title":"Authentication","description":"User login/signup"}]'

# Add analysis notes to a feature
codespring mindmap note feature-auth --text "Uses OAuth2 with PKCE flow..."
```

## Detailed References

- [commands.md](references/commands.md) — Full CLI reference with all flags
- [task-workflow.md](references/task-workflow.md) — Agentic task execution patterns
- [analyze-codebase.md](references/analyze-codebase.md) — Codebase analysis checklist
- [mindmap-structure.md](references/mindmap-structure.md) — Mindmap data formats and node types
- [prd-management.md](references/prd-management.md) — PRD export and sync workflows
