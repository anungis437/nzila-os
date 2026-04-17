# NzilaOS Portfolio Maturity Matrix

> Generated: 2026-03-18T00:00:00.000Z

| Maturity | Count |
|----------|-------|
| production-grade | 10 |
| pilot-grade | 5 |
| internal/admin | 1 |

## App Assessment

| App | Maturity | Score | MW | RL | RID | Core | Health | Tests | Env | APIs | Gaps |
|-----|----------|-------|----|----|-----|------|--------|-------|-----|------|------|
| abr | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 2 | — |
| cfo | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 6 | — |
| console | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 70 | — |
| cora | pilot-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | — |
| nacp-exams | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 3 | — |
| partners | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 3 | — |
| platform-admin | internal/admin | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | — |
| agrimo | pilot-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | — |
| flow | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 5 | — |
| trade | pilot-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | — |
| web | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | — |
| zonga | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 4 | — |
| mobility | pilot-grade | 7/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | 1 | no test files |
| mobility-client-portal | pilot-grade | 7/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | 1 | no test files |
| union-eyes | production-grade | 7/8 | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | 1190 | middleware missing rate limiting |
| orchestrator-api | production-grade | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 7 | — |

## Legend

- **MW**: middleware.ts present
- **RL**: Rate limiting in middleware
- **RID**: Request-ID propagation
- **Core**: @nzila/os-core dependency
- **Health**: /api/health route
- **Tests**: Test files present
- **Env**: Zod env schema in os-core
- **APIs**: Number of API route files
