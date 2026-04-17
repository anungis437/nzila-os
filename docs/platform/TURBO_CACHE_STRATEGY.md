# Turbo Remote Cache Strategy

> This document explains how Nzila OS uses Turborepo's remote cache, why cross-platform cache misses occur, and how we prevent them.

---

## How Turbo Cache Works

Turborepo hashes task inputs (source files + env vars) to produce a cache key. If the same key is found in the remote cache, the task output is restored instead of re-running.

The cache key includes:
1. All files listed in `tasks.<task>.inputs`
2. All environment variables listed in `tasks.<task>.env`
3. **All environment variables NOT listed in `globalPassThroughEnv`** (they are hashed but not passed through to the task)

---

## The Windows → Linux Cache Miss Problem

Windows developer machines have platform-specific environment variables that Linux CI runners do not:

| Variable | Windows | Linux CI |
|---|---|---|
| `USERNAME` | `AubertNungisa` | (not set) |
| `COMPUTERNAME` | `DESKTOP-XXX` | (not set) |
| `OS` | `Windows_NT` | (not set) |
| `APPDATA` | `C:\Users\...` | (not set) |
| `USERPROFILE` | `C:\Users\...` | (not set) |
| `TEMP` / `TMP` | `C:\Users\...\Temp` | `/tmp` |

Before `globalPassThroughEnv` was configured, these variables were **silently included in the cache hash**. A build on Windows would never match a build from Linux CI — wasting remote cache entirely.

---

## The Fix: `globalPassThroughEnv`

In `turbo.json`:

```json
{
  "globalPassThroughEnv": [
    "USERNAME", "COMPUTERNAME", "OS",
    "USERPROFILE", "APPDATA", "LOCALAPPDATA",
    "TEMP", "TMP", "HOMEPATH",
    "HOME", "USER", "LOGNAME", "SHELL", "TERM"
  ]
}
```

`globalPassThroughEnv` tells Turborepo: _"include these vars in the task's runtime environment, but DO NOT include them in the cache hash."_ This means:

- The task still has access to the env vars it needs
- The cache key is identical across Windows and Linux

---

## Remote Cache Signature

`remoteCache.signature: true` is enabled. This means every cached artifact is signed with `TURBO_REMOTE_CACHE_SIGNATURE_KEY`. This prevents cache poisoning attacks where a malicious actor uploads tampered build outputs.

**Required secret**: `TURBO_REMOTE_CACHE_SIGNATURE_KEY` must be set in:
- Local `.env.local` (dev)  
- GitHub Actions secrets (CI)

If the signature key is missing, Turbo falls back to unsigned caching — still functional but less secure.

---

## Verifying Cache Hit Rate

Check cache effectiveness in CI:

```bash
# In GitHub Actions output, look for:
# "cache hit" vs "cache miss" in turbo task output

# Or via Vercel Remote Cache dashboard (if using Vercel):
# https://vercel.com/dashboard/remote-cache
```

Expected behaviour after this fix:
- First CI run after a Windows dev build: **cache hit** on unchanged packages
- Cold CI run (no prior cache): cache miss (expected)
- After code change: targeted cache miss only on affected packages

---

## Task-Level Env Variable Isolation

Beyond the global pass-through list, individual tasks declare which env vars affect their output via `tasks.<task>.env`:

```json
"build": {
  "env": [
    "AZURE_AD_CLIENT_ID",
    "NEXT_PUBLIC_WEB_URL",
    ...
  ]
}
```

Only listed vars are included in the build cache hash. Vars NOT listed are treated as pass-through for that task — they reach the process but don't bust the cache.

**Rule**: If changing an env var should bust the build cache (e.g., `NEXT_PUBLIC_API_URL`), it MUST be in `tasks.build.env`. If it should be transparent to caching (e.g., `HOME`), it must be in `globalPassThroughEnv`.

---

## Common Pitfalls

| Symptom | Root cause | Fix |
|---|---|---|
| Every CI run is a cache miss | Unset `TURBO_REMOTE_CACHE_SIGNATURE_KEY` | Add secret to CI |
| Windows builds never match CI | Platform vars in hash | Already fixed via `globalPassThroughEnv` |
| Adding a new env var breaks CI cache | Var hashed but not in `tasks.env` | Explicitly add to `tasks.<task>.env` or `globalPassThroughEnv` |
| `turbo` says "remote cache disabled" | `TURBO_REMOTE_CACHE_BASEURL` not set | Configure remote cache provider |

---

## References

- [Turborepo: Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Turborepo: `globalPassThroughEnv`](https://turbo.build/repo/docs/reference/configuration#globalpassthroughenv)
- [Turborepo: Caching security](https://turbo.build/repo/docs/core-concepts/remote-caching#artifact-integrity-and-authenticity-verification)
