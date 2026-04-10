# Internal Content

Curated markdown documents rendered inside the **authenticated console** at `/docs/{slug}`.

## Frontmatter Schema

```yaml
---
title: Document Title          # Required — displayed as page heading
description: Short summary     # Optional — shown in listings
category: Category Name        # Optional — used for grouping (default: "General")
order: 1                       # Optional — sort order within category
---
```

## Guidelines

- Content here is visible only to authenticated team members.
- Suitable for playbooks, internal procedures, architecture notes, and onboarding guides.
- Subdirectories become slug prefixes (e.g., `security/incident-response.md` → `/docs/security/incident-response`).
- **Never** expose internal docs publicly — they belong here, not in `content/public/`.
