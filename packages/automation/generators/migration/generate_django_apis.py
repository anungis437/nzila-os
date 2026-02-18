#!/usr/bin/env python3
"""
Django REST API Endpoint Generator
Generates Django views, serializers, and URLs for Union Eyes service migration
"""

import os
import json
import re
from pathlib import Path
from typing import Dict, List
from collections import defaultdict

OUTPUT_DIR = Path(r"D:\APPS\nzila-automation\packages\automation\data")
UE_BACKEND = Path(r"D:\APPS\nzila-union-eyes\backend")
UE_FRONTEND = Path(r"D:\APPS\nzila-union-eyes\frontend")


class DjangoAPIGenerator:
    """Generates Django REST API structure for service migration"""
    
    def __init__(self):
        self.migration_plan = None
        self.service_analysis = None
        self.generated_apis = defaultdict(list)
        
    def load_analysis_data(self):
        """Load service analysis and migration plan"""
        
        plan_file = OUTPUT_DIR / "ue_migration_plan.json"
        analysis_file = OUTPUT_DIR / "ue_service_analysis.json"
        
        if not plan_file.exists():
            print(f"❌ Migration plan not found: {plan_file}")
            print("   Run analyze_ue_services.py first!")
            return False
            
        self.migration_plan = json.loads(plan_file.read_text())
        self.service_analysis = json.loads(analysis_file.read_text())
        
        print(f"✅ Loaded migration plan: {len(self.migration_plan.get('phase_1_critical', []))} critical services")
        return True
        
    def generate_api_structure(self, service_info: Dict) -> Dict:
        """Generate API structure for a service"""
        
        service_name = service_info['name']
        operations = service_info.get('operations', {})
        exported_functions = service_info.get('exported_functions', [])
        exported_classes = service_info.get('exported_classes', [])
        
        # Determine API app name from schema imports
        schema_imports = service_info.get('schema_imports', [])
        app_name = 'api'  # default
        
        if schema_imports:
            schema_file = schema_imports[0]['schema_file']
            # Extract app name from schema path (e.g., "domains/finance" -> "finance")
            if '/' in schema_file:
                app_name = schema_file.split('/')[-1].replace('-schema', '').replace('_', '')
            else:
                app_name = schema_file.replace('-schema', '').replace('_', '')
                
        # Generate endpoint paths
        endpoints = []
        
        # Pattern 1: CRUD operations for main entity
        if operations.get('select', 0) > 0:
            endpoints.append({
                'method': 'GET',
                'path': f'/{app_name}/{service_name}/',
                'action': 'list',
                'description': f'List {service_name} records'
            })
            endpoints.append({
                'method': 'GET',
                'path': f'/{app_name}/{service_name}/{{id}}/',
                'action': 'retrieve',
                'description': f'Get single {service_name} record'
            })
            
        if operations.get('insert', 0) > 0:
            endpoints.append({
                'method': 'POST',
                'path': f'/{app_name}/{service_name}/',
                'action': 'create',
                'description': f'Create new {service_name} record'
            })
            
        if operations.get('update', 0) > 0:
            endpoints.append({
                'method': 'PUT',
                'path': f'/{app_name}/{service_name}/{{id}}/',
                'action': 'update',
                'description': f'Update {service_name} record'
            })
            endpoints.append({
                'method': 'PATCH',
                'path': f'/{app_name}/{service_name}/{{id}}/',
                'action': 'partial_update',
                'description': f'Partially update {service_name} record'
            })
            
        if operations.get('delete', 0) > 0:
            endpoints.append({
                'method': 'DELETE',
                'path': f'/{app_name}/{service_name}/{{id}}/',
                'action': 'destroy',
                'description': f'Delete {service_name} record'
            })
            
        # Pattern 2: Custom functions become custom actions
        for func_name in exported_functions:
            endpoints.append({
                'method': 'POST',
                'path': f'/{app_name}/{service_name}/{func_name.replace("_", "-")}/',
                'action': func_name,
                'description': f'Custom action: {func_name}'
            })
            
        return {
            'service_name': service_name,
            'app_name': app_name,
            'endpoints': endpoints,
            'operations': operations,
            'exported_functions': exported_functions,
            'exported_classes': exported_classes,
        }
        
    def generate_django_viewset(self, api_structure: Dict) -> str:
        """Generate Django REST Framework ViewSet code"""
        
        service_name = api_structure['service_name']
        app_name = api_structure['app_name']
        class_name = ''.join(word.capitalize() for word in service_name.split('-'))
        
        code = f'''"""
{class_name} API ViewSet
Generated from service: {service_name}
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from {app_name}.models import *  # Import relevant models
# from {app_name}.serializers import {class_name}Serializer


class {class_name}ViewSet(viewsets.ModelViewSet):
    """
    ViewSet for {service_name} operations
    
    Endpoints:
'''
        
        for endpoint in api_structure['endpoints']:
            code += f"    - {endpoint['method']} {endpoint['path']} - {endpoint['description']}\n"
            
        code += f'''    """
    
    permission_classes = [IsAuthenticated]
    # queryset = YourModel.objects.all()
    # serializer_class = {class_name}Serializer
    
    def get_queryset(self):
        """Filter queryset by user's organization"""
        user = self.request.user
        # TODO: Implement organization filtering
        # return self.queryset.filter(organization_id=user.organization_id)
        return super().get_queryset()
'''
        
        # Generate custom action methods
        for func_name in api_structure['exported_functions']:
            code += f'''
    @action(detail=False, methods=['post'])
    def {func_name}(self, request):
        """
        Custom action: {func_name}
        TODO: Implement logic from services/{service_name}.ts
        """
        try:
            # TODO: Extract from original service
            data = request.data
            
            # Placeholder response
            return Response({{
                'status': 'success',
                'message': '{func_name} not yet implemented'
            }}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({{
                'status': 'error',
                'message': str(e)
            }}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
'''
        
        return code
        
    def generate_url_patterns(self, api_structure: Dict) -> str:
        """Generate URL pattern for router registration"""
        
        service_name = api_structure['service_name']
        class_name = ''.join(word.capitalize() for word in service_name.split('-'))
        
        return f"router.register(r'{service_name}', {class_name}ViewSet, basename='{service_name}')"
        
    def generate_api_client_typescript(self, api_structure: Dict) -> str:
        """Generate TypeScript API client code"""
        
        service_name = api_structure['service_name']
        class_name = ''.join(word.capitalize() for word in service_name.split('-'))
        
        code = f'''/**
 * {class_name} API Client
 * Calls Django REST API instead of direct database access
 */

import {{ auth }} from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authenticated API client
 */
async function getApiClient() {{
  const {{ getToken }} = auth();
  const token = await getToken();
  
  if (!token) {{
    throw new Error('No authentication token available');
  }}
  
  return {{
    headers: {{
      'Authorization': `Bearer ${{token}}`,
      'Content-Type': 'application/json',
    }}
  }};
}}

'''
        
        # Generate function for each endpoint
        for endpoint in api_structure['endpoints']:
            if endpoint['action'] == 'list':
                code += f'''
/**
 * {endpoint['description']}
 */
export async function get{class_name}List(filters?: any) {{
  const client = await getApiClient();
  const queryString = filters ? '?' + new URLSearchParams(filters).toString() : '';
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path']}${{queryString}}`, {{
    method: 'GET',
    headers: client.headers,
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to fetch {service_name}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
            elif endpoint['action'] == 'retrieve':
                code += f'''
/**
 * {endpoint['description']}
 */
export async function get{class_name}ById(id: string) {{
  const client = await getApiClient();
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path'].replace('{id}', '${{id}}')}`, {{
    method: 'GET',
    headers: client.headers,
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to fetch {service_name} {{id}}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
            elif endpoint['action'] == 'create':
                code += f'''
/**
 * {endpoint['description']}
 */
export async function create{class_name}(data: any) {{
  const client = await getApiClient();
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path']}`, {{
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to create {service_name}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
            elif endpoint['action'] == 'update':
                code += f'''
/**
 * {endpoint['description']}
 */
export async function update{class_name}(id: string, data: any) {{
  const client = await getApiClient();
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path'].replace('{id}', '${{id}}')}`, {{
    method: 'PUT',
    headers: client.headers,
    body: JSON.stringify(data),
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to update {service_name} {{id}}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
            elif endpoint['action'] == 'destroy':
                code += f'''
/**
 * {endpoint['description']}
 */
export async function delete{class_name}(id: string) {{
  const client = await getApiClient();
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path'].replace('{id}', '${{id}}')}`, {{
    method: 'DELETE',
    headers: client.headers,
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to delete {service_name} {{id}}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
            elif endpoint['action'] in api_structure['exported_functions']:
                func_name = endpoint['action']
                code += f'''
/**
 * {endpoint['description']}
 */
export async function {func_name}(data: any) {{
  const client = await getApiClient();
  
  const response = await fetch(`${{API_URL}}/api{endpoint['path']}`, {{
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(data),
  }});
  
  if (!response.ok) {{
    throw new Error(`Failed to execute {func_name}: ${{response.statusText}}`);
  }}
  
  return response.json();
}}
'''
        
        return code
        
    def generate_migration_artifacts(self):
        """Generate all migration artifacts"""
        
        print("\n🏗️  Generating Django API artifacts...")
        
        # Process Phase 1 (Critical) services first
        phase1_services = self.migration_plan.get('phase_1_critical', [])
        
        if not phase1_services:
            print("❌ No Phase 1 services found!")
            return
            
        print(f"\n📦 Processing {len(phase1_services)} Phase 1 (Critical) services:")
        
        # Create output directories
        django_output = OUTPUT_DIR / "django_api_views"
        ts_output = OUTPUT_DIR / "typescript_api_clients"
        django_output.mkdir(exist_ok=True)
        ts_output.mkdir(exist_ok=True)
        
        url_patterns = []
        
        for service_info in phase1_services:
            service_name = service_info['name']
            print(f"   ⚙️  Generating API for: {service_name} ({service_info['operations']} ops)")
            
            # Find full service details from analysis
            full_service = next(
                (s for s in self.service_analysis['services'] if s['name'] == service_name),
                None
            )
            
            if not full_service:
                print(f"      ⚠️  Service details not found, skipping...")
                continue
                
            # Generate API structure
            api_structure = self.generate_api_structure(full_service)
            
            # Generate Django ViewSet
            viewset_code = self.generate_django_viewset(api_structure)
            viewset_file = django_output / f"{service_name.replace('-', '_')}_views.py"
            viewset_file.write_text(viewset_code, encoding='utf-8')
            
            # Generate URL pattern
            url_pattern = self.generate_url_patterns(api_structure)
            url_patterns.append(url_pattern)
            
            # Generate TypeScript API client
            ts_client_code = self.generate_api_client_typescript(api_structure)
            ts_client_file = ts_output / f"{service_name}-api.ts"
            ts_client_file.write_text(ts_client_code, encoding='utf-8')
            
        # Generate consolidated URL configuration
        urls_code = f'''"""
API URL Configuration
Generated for Union Eyes service migration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Import ViewSets
# TODO: Add imports after copying viewsets to Django app

router = DefaultRouter()

# Register ViewSets
'''
        for pattern in url_patterns:
            urls_code += pattern + '\n'
            
        urls_code += '''
urlpatterns = [
    path('', include(router.urls)),
]
'''
        
        urls_file = django_output / "urls.py"
        urls_file.write_text(urls_code, encoding='utf-8')
        
        print(f"\n✅ Generated artifacts:")
        print(f"   Django ViewSets: {len(phase1_services)} files in {django_output}")
        print(f"   TypeScript clients: {len(phase1_services)} files in {ts_output}")
        print(f"   URL configuration: {urls_file}")
        
        # Generate migration guide
        self.generate_migration_guide(phase1_services)
        
    def generate_migration_guide(self, services: List[Dict]):
        """Generate step-by-step migration guide"""
        
        guide = f'''# Union Eyes Service Migration Guide

## Phase 1: Critical Services (50+ database operations)

Total services to migrate: {len(services)}

### Migration Steps

#### 1. Install Generated Django ViewSets

```bash
# Copy generated ViewSets to Django backend
cp data/django_api_views/*.py D:/APPS/nzila-union-eyes/backend/union_eyes/views/
```

#### 2. Update Django URLs

Add to `D:/APPS/nzila-union-eyes/backend/union_eyes/urls.py`:

```python
from django.urls import path, include
from .views import router  # Import generated router

urlpatterns = [
    # ... existing patterns ...
    path('api/services/', include(router.urls)),
]
```

#### 3. Install TypeScript API Clients

```bash
# Copy generated API clients to frontend
cp data/typescript_api_clients/*.ts D:/APPS/nzila-union-eyes/frontend/lib/api/
```

#### 4. Update Service Files

For each service, replace Drizzle database calls with API client calls:

'''
        
        for i, svc in enumerate(services, 1):
            service_name = svc['name']
            guide += f'''
##### {i}. {service_name} ({svc['operations']} operations)

**File:** `{svc['file']}`

**Before:**
```typescript
import {{ db }} from '@/db';
import {{ someTable }} from '@/db/schema/...';

export async function getSomething() {{
  return db.select().from(someTable).where(...);
}}
```

**After:**
```typescript
import {{ get{service_name.replace("-", "").capitalize()}List }} from '@/lib/api/{service_name}-api';

export async function getSomething() {{
  return get{service_name.replace("-", "").capitalize()}List();
}}
```

'''
        
        guide += '''
#### 5. Remove Drizzle Dependencies

After all services are migrated:

```bash
cd D:/APPS/nzila-union-eyes/frontend
pnpm remove drizzle-orm drizzle-zod
pnpm remove --save-dev drizzle-kit
```

#### 6. Remove Database Configuration

Delete or comment out:
- `D:/APPS/nzila-union-eyes/frontend/db/` directory
- `drizzle.config.ts`
- Database connection in Next.js config

#### 7. Test Migration

```bash
# Start Django backend
cd D:/APPS/nzila-union-eyes/backend
python manage.py runserver

# Start Next.js frontend
cd D:/APPS/nzila-union-eyes/frontend
pnpm dev

# Run tests
pnpm test
```

### Migration Checklist

'''
        
        for i, svc in enumerate(services, 1):
            guide += f"- [ ] {i}. Migrate {svc['name']} ({svc['operations']} ops)\n"
            
        guide += '''
- [ ] Remove Drizzle dependencies
- [ ] Remove database config
- [ ] Test all features
- [ ] Deploy to staging

## Next Phases

- **Phase 2:** High priority (20-49 ops) - 31 services
- **Phase 3:** Medium priority (5-19 ops) - 15 services
- **Phase 4:** Low priority (1-4 ops) - 9 services
'''
        
        guide_file = OUTPUT_DIR / "MIGRATION_GUIDE.md"
        guide_file.write_text(guide, encoding='utf-8')
        
        print(f"\n📖 Migration guide: {guide_file}")


def main():
    """Main execution"""
    print("🚀 Django REST API Generator")
    print("="*80)
    
    generator = DjangoAPIGenerator()
    
    # Load analysis data
    if not generator.load_analysis_data():
        return
        
    # Generate migration artifacts
    generator.generate_migration_artifacts()
    
    print("\n✅ API generation complete!")


if __name__ == "__main__":
    main()
