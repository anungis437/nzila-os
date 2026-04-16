# @nzila/ai-control

Authoritative control layer for governed AI execution in Nzila OS.

## Owns

- AI request policy evaluation and enforcement paths
- Budget and quota controls for model usage
- Classification and control-flow utilities for AI workloads
- Shared schemas and logging contracts for governed AI runs

## Does Not Own

- Provider-specific SDK integrations in app code
- Product-level prompts and domain business logic

## Use This When

- Enforcing AI policy checks before model execution
- Applying budget limits and usage controls
- Standardizing AI request classification and audit logging

## Adjacent Packages

- @nzila/ai-sdk: app-facing SDK boundary for AI access
- @nzila/platform-ai-governance: platform governance policies
- @nzila/platform-ai-contract: contract rules for AI usage
