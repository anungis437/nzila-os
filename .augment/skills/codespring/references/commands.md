# CodeSpring CLI — Full Command Reference

## Auth

### `codespring auth login`
Log in via browser-based OAuth 2.1 flow (PKCE).
- `--api-key` — Paste an API key instead of browser login
- `--url <api-url>` — Custom API URL (default: auto-detected)

### `codespring auth status`
Show current authentication state. Returns `{ authenticated, type, apiUrl }`.

### `codespring auth logout`
Clear stored credentials from `~/.codespring/credentials.json`.

## Setup

### `codespring init`
Interactive project linking (Vercel-style):
1. Select workspace
2. Select project (auto-detects by directory name)
3. Writes `.codespring/config.json`

Flags:
- `--project <id>` — Direct link, skip interactive
- `--force` — Re-link even if already linked

### `codespring status`
Show linked project info. Returns `{ linked, projectId, projectName, authenticated }`.

## Data

### `codespring workspaces`
List all workspaces (personal + organizations). No flags.

### `codespring projects`
List projects in a workspace.
- `--org <id>` — Filter by organization ID

### `codespring project create`
Create a new project.
- `--name <n>` — Project name (required)
- `--description <d>` — Project description

### `codespring features`
List features for the linked project. Requires linked project.

### `codespring feature create`
Create a new feature for the linked project.
- `--title <t>` — Feature title (required)
- `--description <d>` — Feature description

## Tasks

### `codespring tasks`
List tasks with optional filters.
- `--status <s>` — Filter: `todo`, `in_progress`, `on_hold`, `done`
- `--feature <id>` — Filter by feature ID
- `--priority <p>` — Filter: `low`, `medium`, `high`, `urgent`

### `codespring task create`
Create a new task for the linked project.
- `--title <t>` — Task title (required)
- `--description <d>` — Task description
- `--priority <p>` — Priority: `low`, `medium`, `high`, `urgent`
- `--feature <id>` — Link to a feature ID
- `--estimate <e>` — Estimate (e.g., "2h", "1d")

### `codespring task start <id>`
Set task status to `in_progress`. Accepts UUID or row number.

### `codespring task done <id>`
Set task status to `done`. Accepts UUID or row number.

### `codespring task update <id>`
Update task fields.
- `--status <s>` — New status
- `--title <t>` — New title
- `--description <d>` — New description
- `--priority <p>` — New priority
- `--estimate <e>` — New estimate (e.g., "2h", "1d")

## PRDs

### `codespring prds`
List PRDs grouped by feature structure for the linked project.

### `codespring prd <id>`
Get full PRD content (includes markdown content, feature info, suggested path).

### `codespring prd sync <id>`
Update PRD content.
- `--file <path>` — Read content from file
- `--stdin` — Read content from stdin
- `--name <name>` — Optionally update PRD name

## Mindmap

### `codespring mindmap`
Get full mindmap structure (nodes + edges) for the linked project.

### `codespring mindmap set-info`
Update the project info node in the mindmap.
- `--title <t>` — Project title
- `--description <d>` — Project description
- `--github <url>` — GitHub repository URL

### `codespring mindmap tech-stack`
Update the tech stack node.
- `--add '<json>'` — JSON array of items: `[{"id":"tech-react","title":"React","description":"Frontend"}]`
- `--replace` — Replace all items (default: merge)

### `codespring mindmap features`
Update the features node.
- `--add '<json>'` — JSON array: `[{"title":"Auth","description":"Login/signup"}]`
- `--replace` — Replace all items (default: append)

### `codespring mindmap note <featureId>`
Add notes to a specific feature. Creates bridge + notes nodes if needed.
- `--text '<content>'` — Note content (supports markdown)
- `--title '<title>'` — Note title (default: "Notes")

## Reference

### `codespring schema`
Output the CodeSpring data schema (project, mindmap, tech stack items, features, PRDs).

### `codespring node-types`
Output mindmap node type definitions (primary, secondary, bridge, tertiary, handle patterns).

## Global Flags

- `--md` — Force markdown output (default in terminal)
- `--json` — Force JSON output (default when piped)
- `--pretty` — Pretty-print JSON output
- `--help`, `-h` — Show help
- `--version`, `-v` — Show version
