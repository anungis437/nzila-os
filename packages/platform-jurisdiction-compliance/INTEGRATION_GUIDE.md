# Platform Jurisdiction Compliance — Integration Guide

This guide explains how to integrate the `@nzila/platform-jurisdiction-compliance` package into backend services (Django, Node.js) and frontend apps (Next.js).

## Overview

The jurisdiction compliance framework provides:
- **Policy objects** for Kenya, Uganda, Nigeria with tax rates, labor law, pension rules
- **Validators** to check field requirements against jurisdiction rules
- **Test datasets** for load testing and fixture generation
- **Environment-based initialization** for runtime policy selection

## 1. Django Backend Integration (Union Eyes, Agrimo)

### Installation

```bash
cd apps/union-eyes  # or apps/agrimo
pnpm add @nzila/platform-jurisdiction-compliance
```

### Configuration Loader

Create `config/jurisdiction_loader.py`:

```python
import json
import os
from pathlib import Path

class JurisdictionConfig:
    """Loads jurisdiction policies from compiled JS module."""
    
    _cache = {}
    
    @classmethod
    def get_policy(cls, jurisdiction: str):
        """Load policy for jurisdiction (KE, UG, NG)."""
        if jurisdiction in cls._cache:
            return cls._cache[jurisdiction]
        
        # Load from environment or default config
        policy_path = Path(os.getenv(
            'JURISDICTION_POLICIES_PATH',
            'node_modules/@nzila/platform-jurisdiction-compliance/dist/policies.json'
        ))
        
        if not policy_path.exists():
            raise ValueError(f"Policy file not found: {policy_path}")
        
        with open(policy_path) as f:
            all_policies = json.load(f)
        
        if jurisdiction not in all_policies:
            raise ValueError(f"No policy for jurisdiction: {jurisdiction}")
        
        policy = all_policies[jurisdiction]
        cls._cache[jurisdiction] = policy
        return policy
    
    @classmethod
    def get_tax_rate(cls, jurisdiction: str, tax_type: str = 'standard') -> float:
        """Get tax rate for jurisdiction and type."""
        policy = cls.get_policy(jurisdiction)
        return float(policy['taxes'][tax_type])
    
    @classmethod
    def get_pension_contribution(cls, jurisdiction: str) -> dict:
        """Get pension contribution rates, cap, eligibility."""
        policy = cls.get_policy(jurisdiction)
        return policy['pension']
    
    @classmethod
    def get_labor_law(cls, jurisdiction: str) -> dict:
        """Get labor law (min wage, max hours, leave days)."""
        policy = cls.get_policy(jurisdiction)
        return policy['laborLaw']
```

### Django Model Integration

Update `models.py` to include jurisdiction-aware fields:

```python
from django.db import models
from config.jurisdiction_loader import JurisdictionConfig

class Cooperative(models.Model):
    JURISDICTION_CHOICES = [
        ('KE', 'Kenya'),
        ('UG', 'Uganda'),
        ('NG', 'Nigeria'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid4)
    name = models.CharField(max_length=255)
    jurisdiction = models.CharField(max_length=2, choices=JURISDICTION_CHOICES)
    tax_id = models.CharField(max_length=50)
    registration_number = models.CharField(max_length=100)
    
    class Meta:
        indexes = [
            models.Index(fields=['jurisdiction']),
        ]
    
    def get_tax_rate(self) -> float:
        """Get applicable tax rate for this cooperative's jurisdiction."""
        return JurisdictionConfig.get_tax_rate(self.jurisdiction)
    
    def get_labor_policy(self) -> dict:
        """Get applicable labor law for this jurisdiction."""
        return JurisdictionConfig.get_labor_law(self.jurisdiction)
```

### API Endpoint Example

Use policies in views:

```python
from rest_framework import viewsets
from config.jurisdiction_loader import JurisdictionConfig

class CooperativeViewSet(viewsets.ModelViewSet):
    queryset = Cooperative.objects.all()
    serializer_class = CooperativeSerializer
    
    def create(self, request):
        """Create cooperative with jurisdiction-specific validation."""
        jurisdiction = request.data.get('jurisdiction')
        
        # Validate against jurisdiction policy
        policy = JurisdictionConfig.get_policy(jurisdiction)
        
        # Example: ensure tax_id matches jurisdiction format
        if not self._validate_tax_id(
            request.data.get('tax_id'), 
            jurisdiction
        ):
            return Response(
                {'error': f'Invalid tax ID format for {jurisdiction}'},
                status=400
            )
        
        return super().create(request)
    
    def _validate_tax_id(self, tax_id: str, jurisdiction: str) -> bool:
        """Validate tax ID per jurisdiction rules."""
        rules = JurisdictionConfig.get_policy(jurisdiction)
        prefix = rules['taxIdFormat']['prefix']
        return tax_id.startswith(prefix)
```

## 2. Next.js Frontend Integration (Agrimo, NACP)

### Installation

```bash
cd apps/agrimo  # or apps/nacp-exams
pnpm add @nzila/platform-jurisdiction-compliance
```

### Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_JURISDICTION=KE
JURISDICTION_POLICIES_PATH=/path/to/policies.json
```

### Policy Context Hook

Create `lib/hooks/useJurisdictionPolicy.ts`:

```typescript
import { useMemo } from 'react'
import { getPolicy, getPolicyForJurisdiction } from '@nzila/platform-jurisdiction-compliance'

export function useJurisdictionPolicy(jurisdiction?: string) {
  const currentJurisdiction = jurisdiction || process.env.NEXT_PUBLIC_JURISDICTION || 'KE'
  
  const policy = useMemo(() => {
    return getPolicyForJurisdiction(currentJurisdiction)
  }, [currentJurisdiction])
  
  return {
    jurisdiction: currentJurisdiction,
    policy,
    taxRate: policy.taxes.standard,
    laborLaw: policy.laborLaw,
    pension: policy.pension,
  }
}
```

### Form Validation Example

```typescript
import { validators } from '@nzila/platform-jurisdiction-compliance'
import { useJurisdictionPolicy } from '@/lib/hooks/useJurisdictionPolicy'

export function CooperativeForm() {
  const { policy } = useJurisdictionPolicy()
  
  const validateTaxId = (taxId: string) => {
    const rules = validators.createTaxIdValidator(policy.taxIdFormat)
    return rules.test(taxId)
  }
  
  const validateMinWage = (wage: number) => {
    const minWage = policy.laborLaw.minimumWageMonthly
    return wage >= minWage
  }
  
  return (
    <form>
      <input 
        name="taxId"
        onChange={(e) => {
          const valid = validateTaxId(e.target.value)
          console.log(`Tax ID ${valid ? 'valid' : 'invalid'}`)
        }}
      />
      <input 
        name="wage"
        type="number"
        onChange={(e) => {
          const valid = validateMinWage(parseFloat(e.target.value))
          console.log(`Wage ${valid ? 'meets minimum' : 'below minimum'}`)
        }}
      />
    </form>
  )
}
```

## 3. Test Data Generation

### Loading Test Fixtures in Tests

```typescript
import { generateTestDataset } from '@nzila/platform-jurisdiction-compliance/test-datasets'

describe('Agrimo Cooperative Load', () => {
  it('handles Kenya medium-scale dataset', () => {
    const { coops, farmers, examinees, count } = generateTestDataset('KE', 'medium')
    
    expect(count.coops).toBe(20)
    expect(count.farmers).toBe(10000)
    expect(count.examinees).toBe(200)
  })
})
```

### Load Test Integration (k6)

```javascript
import { generateTestDataset } from '@nzila/platform-jurisdiction-compliance/test-datasets'

export default function () {
  const dataset = generateTestDataset('KE', 'medium')
  
  // Use dataset.coops, dataset.farmers in requests
  dataset.coops.forEach(coop => {
    http.get(`/api/cooperatives/${coop.id}`)
  })
}
```

## 4. Environment-Based Initialization

### Automatic Initialization

The package exports an `initializeJurisdiction()` function for server startup:

```typescript
// server.ts or app.py
import { initializeJurisdiction } from '@nzila/platform-jurisdiction-compliance'

async function startServer() {
  const jurisdiction = process.env.JURISDICTION || 'KE'
  await initializeJurisdiction(jurisdiction)
  
  // Start app
  app.listen(3000)
}
```

## 5. Adding a New Jurisdiction

To add a new jurisdiction (e.g., Tanzania):

1. **Update policies object** in `packages/platform-jurisdiction-compliance/src/policies.ts`:
   ```typescript
   export const policies: Record<Jurisdiction, Policy> = {
     KE: { /* ... */ },
     UG: { /* ... */ },
     NG: { /* ... */ },
     TZ: {
       name: 'Tanzania',
       taxIdFormat: { prefix: 'TZ-TAX-', length: 15 },
       taxes: { standard: 0.18, reduced: 0.05 },
       // ... fill all fields from Policy interface
     }
   }
   ```

2. **Add test dataset generator** in `packages/platform-jurisdiction-compliance/src/test-datasets.ts`:
   ```typescript
   export function generateTanzaniaCooperative(): TestCooperative { /* ... */ }
   export function generateTanzaniaFarmers(coopId: string, count: number): TestFarmer[] { /* ... */ }
   ```

3. **Update Jurisdiction enum** in `packages/platform-jurisdiction-compliance/src/index.ts`:
   ```typescript
   export enum Jurisdiction {
     Kenya = 'KE',
     Uganda = 'UG',
     Nigeria = 'NG',
     Tanzania = 'TZ',
   }
   ```

4. **Run tests and validation**:
   ```bash
   cd packages/platform-jurisdiction-compliance
   pnpm test
   pnpm type-check
   ```

## 6. Verification Checklist

- [ ] Package installed in backend and frontend
- [ ] Environment variables configured for jurisdiction
- [ ] Policy objects loaded without errors
- [ ] Tax calculations match jurisdiction rules
- [ ] Test data generates expected row counts
- [ ] Models/forms validate against jurisdiction policies
- [ ] Load tests include jurisdiction-specific scenarios
- [ ] Documentation updated for new fields

## 7. Troubleshooting

### Policy Not Found
- Check `JURISDICTION_POLICIES_PATH` environment variable
- Verify compiled `policies.json` exists in `dist/`
- Ensure jurisdiction code matches enum (KE, UG, NG)

### Validators Not Working
- Import from `/validators` entry point, not root
- Verify regex patterns match your data format
- Add test cases to `src/validators.test.ts`

### Test Data Missing Jurisdiction
- Ensure `NEXT_PUBLIC_JURISDICTION` env var is set in frontend builds
- Check that dataset generators return correct `jurisdiction` field
- Verify load test uses correct generator function

## Related Files

- [API Policy Reference](./POLICY_API_REFERENCE.md)
- [Capacity Planning](../docs/LOAD_PROJECTION_CAPACITY_PLAN.md)
- [Remediation Tasks](../docs/REMEDIATION_TASKS.md)
