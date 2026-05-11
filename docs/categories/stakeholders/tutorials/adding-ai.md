# Tutorial: Adding AI to an App

**Time**: 20 minutes  
**Goal**: Add AI-powered text generation to your app using the `@nzila/ai-sdk`.

## Prerequisites

- Completed [Tutorial 1: Your First App](first-app.md)
- AI gateway running (via `pnpm dev` or orchestrator-api)

## Important: SDK-Only Rule

> **NEVER import directly from `@nzila/ai-core`, OpenAI, Azure OpenAI, or Anthropic SDKs.**  
> All AI access MUST go through `@nzila/ai-sdk`. This ensures:
>
> - PII redaction is enforced
> - Budget limits are checked
> - All requests are audit-logged with hash-chained evidence
> - Risk tier policies are applied

## Step 1: Add the AI SDK Dependency

```bash
cd apps/my-app
pnpm add @nzila/ai-sdk
```

## Step 2: Create an API Route

Create `app/api/ai/generate/route.ts`:

```typescript
import { createAiClient } from '@nzila/ai-sdk';
import { auth } from '@nzila/platform-auth/entra/server';
import { NextResponse } from 'next/server';

const ai = createAiClient({
  baseUrl: process.env.AI_GATEWAY_URL ?? 'http://localhost:3010/api/ai',
});

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt } = await request.json();

  const result = await ai.generate({
    prompt,
    orgId,
    userId,
    app: 'my-app',
    feature: 'text-generation',
  });

  return NextResponse.json(result);
}
```

## Step 3: Create a UI Component

Create `components/AiGenerator.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function AiGenerator() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResult(data.text ?? data.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt..."
        className="w-full p-3 border rounded-lg"
        rows={4}
      />
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {result && (
        <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  );
}
```

## Step 4: What Happens Behind the Scenes

When you call `ai.generate()`, the AI gateway (`@nzila/ai-core`) automatically:

1. **Resolves the deployment** — Routes `orgId + app + feature` to the correct model/deployment
2. **Checks capability profile** — Validates allowed providers, modalities, data classes
3. **Enforces budgets** — Checks monthly/per-user/per-request spend limits
4. **Redacts PII** — Removes SSNs, credit cards, emails, etc. from prompts (configurable mode)
5. **Logs the request** — SHA-256 hashed, hash-chained audit event
6. **Routes to provider** — OpenAI, Azure OpenAI, or Anthropic
7. **Records telemetry** — OTel span with `nzila.ai.model_id`, `nzila.ai.risk_tier`

## Verification

- [ ] AI generation works end-to-end
- [ ] Check Jaeger for AI-specific spans
- [ ] Verify PII patterns are redacted in logs

## Next Steps

- [How-To: Create a Model Card](../how-to/create-model-card.md)
- [Reference: AI Gateway](../reference/ai-gateway.md)
- [Explanation: AI Risk Management](../explanation/ai-risk-management.md)
