# veridian-admin

Veridian Health administrative portal — internal staff tooling for the Veridian Health vertical.

## Status

**Stage:** INCUBATION — active development. Not yet GA.

## Development

```bash
pnpm dev      # starts on port 3012
pnpm build
pnpm typecheck
pnpm lint
```

## Environment

Copy `.env.example` to `.env.local` and populate the required values.

## Related apps

- `apps/veridian-care` — patient care portal
- `apps/veridian-site` — public-facing site
