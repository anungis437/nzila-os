# Agentic Task Workflow

## Overview

CodeSpring tasks follow a Kanban workflow: `todo` → `in_progress` → `done` (with optional `on_hold`).

## Discovery Flow

```bash
# 1. List features to find the right area
codespring features

# 2. Find available tasks (optionally filter by feature)
codespring tasks --status todo --feature <feature-id>

# 3. Pick a task by examining its title and description
```

## Execution Pattern

```bash
# Claim the task (UUID or row number from the task list)
codespring task start 1

# Do the work using your native coding tools (Read, Edit, Bash, etc.)
# ...

# Mark complete
codespring task done 1
```

## Creating Tasks

```bash
# Create a task with all options
codespring task create --title "Fix login redirect" --priority high --feature <feature-id> --estimate "2h"

# Simple task
codespring task create --title "Update README"
```

## Multi-Task Batch Workflow

When working through multiple tasks:

```bash
# Get all todo tasks
TASKS=$(codespring tasks --status todo)

# For each task:
# 1. Read the task details
# 2. Start it: codespring task start <id>
# 3. Implement the changes
# 4. Complete it: codespring task done <id>
# 5. Move to next task
```

## Priority Levels

- **urgent** — Blocking other work, do first
- **high** — Important, do soon
- **medium** — Standard priority
- **low** — Nice to have

Filter by priority: `codespring tasks --status todo --priority high`

## Status Transitions

| From | To | When |
|------|-----|------|
| `todo` | `in_progress` | Starting work |
| `in_progress` | `done` | Work completed |
| `in_progress` | `on_hold` | Blocked/paused |
| `on_hold` | `in_progress` | Unblocked, resuming |
| `done` | `todo` | Reopening |

## Updating Task Details

You can update more than just status:

```bash
codespring task update <id> --status in_progress --priority high --estimate "2h"
```
