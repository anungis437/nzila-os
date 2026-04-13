# Nzila Web

> Public marketing site for the Nzila platform — landing pages, resource library, and public content.

## Stack

- **Framework:** Next.js (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4
- **Port:** 3000

## Quick Start

```bash
pnpm dev:web            # → http://localhost:3000
```

Copy `.env.example` → `.env.local` and fill required values.

## Content

Public content is served from `content/public/` and rendered at `nzila.app/resources/{slug}`.

## Domain

The primary public-facing site for Nzila Digital Ventures. Serves marketing pages, documentation, and curated resources.
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables

See `.env.example` in this directory for required variables (`AUTH_SECRET`, `DATABASE_URL`, Entra SSO config).

## Known Exceptions

- **No `@nzila/platform-shell`** — Public marketing site with no authenticated shell

See `governance/exceptions/platform-adoption-exceptions.json` for formal registration.
