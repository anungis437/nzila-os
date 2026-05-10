# Secure Coding Training Portal

## iSSDLC W3-2: Developer Security Education Program

### Overview

This document outlines the secure coding training requirements for all
Nzila OS contributors. Training is mandatory for committers and recommended
for occasional contributors.

---

## 1. Training Tracks

### Track 1: Security Foundations (Required — All Developers)

| Module                               | Duration | Frequency   |
|--------------------------------------|----------|-------------|
| OWASP Top 10 (2021)                  | 2 hours  | Annual      |
| OWASP API Security Top 10            | 1.5 hours| Annual      |
| Secure coding in TypeScript/Node.js  | 2 hours  | Annual      |
| Supply chain security                | 1 hour   | Annual      |
| Secrets management                   | 1 hour   | Annual      |

### Track 2: AI/ML Security (Required — AI Contributors)

| Module                               | Duration | Frequency   |
|--------------------------------------|----------|-------------|
| OWASP LLM Top 10                     | 2 hours  | Annual      |
| Prompt injection defence patterns    | 1.5 hours| Annual      |
| AI action policy & kill-switch       | 1 hour   | On-boarding |
| Training data governance             | 1 hour   | Annual      |
| Bias & fairness testing              | 1 hour   | Annual      |

### Track 3: Cloud Infrastructure (Required — Platform Team)

| Module                               | Duration | Frequency   |
|--------------------------------------|----------|-------------|
| Azure security best practices        | 2 hours  | Annual      |
| Container security & mTLS            | 1.5 hours| Annual      |
| IAM & RBAC design                    | 1 hour   | Annual      |
| Key Vault & secret rotation          | 1 hour   | Annual      |
| Sentinel & incident response         | 1.5 hours| Annual      |

---

## 2. Training Resources

### 2.1 Free Resources

| Resource                                | URL                                           |
|-----------------------------------------|-----------------------------------------------|
| OWASP Web Security Testing Guide        | <https://owasp.org/www-project-web-security-testing-guide/> |
| OWASP Cheat Sheet Series                | <https://cheatsheetseries.owasp.org/>           |
| OWASP LLM AI Security                   | <https://owasp.org/www-project-top-10-for-large-language-model-applications/> |
| Microsoft Learn: Azure Security          | <https://learn.microsoft.com/en-us/training/paths/az-500/> |
| Node.js Security Best Practices          | <https://nodejs.org/en/docs/guides/security/>  |

### 2.2 Internal Resources

| Resource                                | Location                                      |
|-----------------------------------------|-----------------------------------------------|
| AI Risk Register                        | `governance/ai/nzila-ai-risk-register.md`    |
| Security Architecture                   | `SECURITY.md`                                |
| iSSDLC Capabilities Assessment          | `governance/security/nzila-issdlc-capabilities-assessment.md` |
| Red Team Test Suite                     | `security/redteam/`                          |
| Contract Tests                          | `tooling/contract-tests/`                    |
| Vulnerability Disclosure Policy         | `docs/governance/vulnerability-disclosure-policy.md` |

---

## 3. Completion Requirements

### 3.1 New Contributors

- Complete Track 1 within 30 days of first commit
- Complete relevant Track 2/3 within 60 days if working on AI/infra
- Acknowledge `SECURITY.md` and `CONTRIBUTING.md`

### 3.2 Annual Renewal

- All tracks must be renewed annually
- Renewal tracked in `governance/security/training-log.md`
- Non-compliance flagged in compliance scorecard

### 3.3 Verification

Training completion evidenced by:

1. Certificate of completion (external courses) → uploaded to `proof-artifacts/training/`
2. PR demonstrating security fix (internal exercises) → linked in training log
3. Red team test contribution → new test case in `security/redteam/`

---

## 4. Security Champions Program

### 4.1 Role

Each product team designates one **Security Champion** who:

- Completes all 3 tracks
- Conducts threat modeling for team features
- Reviews PRs for security-sensitive paths
- Maintains team-specific security runbooks

### 4.2 Current Champions

| Team         | Champion     | Tracks Completed |
|--------------|--------------|------------------|
| Platform     | TBD          | —                |
| Union-Eyes   | TBD          | —                |
| Console      | TBD          | —                |
| Partners     | TBD          | —                |
| AI/ML        | TBD          | —                |

---

## 5. Metrics

| Metric                          | Target   | Measured By                |
|---------------------------------|----------|----------------------------|
| Track 1 completion rate         | 100%     | Training log               |
| Track 2 completion (AI team)    | 100%     | Training log               |
| Track 3 completion (platform)   | 100%     | Training log               |
| Security champions assigned     | 1/team   | Champions table above      |
| Annual renewal rate             | > 90%    | Training log               |
| Red team test contributions     | ≥1/quarter | Git log in `security/redteam/` |
