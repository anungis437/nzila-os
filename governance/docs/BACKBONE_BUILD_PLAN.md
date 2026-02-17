# Nzila Backbone Platform - Implementation Roadmap

**Version:** 1.0  
**Date:** 2025  
**Duration:** 20 weeks (5 phases)  
**ROI:** 60+ weeks saved across 7 products (300% acceleration)

---

## Executive Summary

The Nzila Backbone Platform is a **multi-tenant SaaS infrastructure** that serves as the foundation for 7+ healthcare and education technology products. By building shared services ONCE, we accelerate product launches by 50-78% while ensuring unified compliance (PIPEDA, GDPR, HIPAA) and governance.

### Strategic Value
- **Memora**: 12 weeks (vs 24 standalone) - 50% faster
- **ClinicConnect**: 8 weeks (vs 20) - 60% faster  
- **CareAI**: 6 weeks (vs 16) - 62% faster
- **Companion API**: 4 weeks (vs 18) - 78% faster
- **Total portfolio**: 20 weeks investment → 60+ weeks saved

---

## Phase 0: Scaffold & Infrastructure (Weeks 1-2)

### Objectives
- Apply `scripts-book` template for production-grade project structure
- Provision Azure infrastructure (PostgreSQL, Redis, Container Apps)
- Establish CI/CD pipelines with environment parity (Bash + PowerShell + Python)
- Configure development, staging, and production environments

### Technical Tasks

#### 1. Project Initialization
```bash
# Use scripts-book template
scripts-book init \
  --profile=django-aca-azurepg \
  --product-name="Nzila Backbone Platform" \
  --repo-name=nzila-platform \
  --tenant-key=org_id \
  --auth-provider=clerk

# Verify parity across all environments
python scripts/verify_parity.py
```

#### 2. Azure Resource Provisioning
```powershell
# Create resource group
az group create --name rg-nzila-platform --location canadacentral

# PostgreSQL Flexible Server with pgvector
az postgres flexible-server create \
  --name nzila-platform-db \
  --resource-group rg-nzila-platform \
  --location canadacentral \
  --admin-user nzilaadmin \
  --tier Burstable \
  --sku-name Standard_B2s \
  --version 15 \
  --storage-size 128

# Enable extensions
az postgres flexible-server parameter set \
  --server-name nzila-platform-db \
  --resource-group rg-nzila-platform \
  --name azure.extensions \
  --value uuid-ossp,pgvector,pg_trgm

# Redis Cache
az redis create \
  --name nzila-platform-cache \
  --resource-group rg-nzila-platform \
  --location canadacentral \
  --sku Basic \
  --vm-size c0

# Container Apps Environment
az containerapp env create \
  --name nzila-platform-env \
  --resource-group rg-nzila-platform \
  --location canadacentral
```

#### 3. GitHub Actions CI/CD
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python 3.12
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      
      - name: Run tests
        run: python scripts/run_tests.py
      
      - name: Build Docker image
        run: docker build -t nzila-platform:${{ github.sha }} .
      
      - name: Deploy to Azure Container Apps
        run: |
          az containerapp update \
            --name nzila-platform-staging \
            --resource-group rg-nzila-platform \
            --image ${{ secrets.ACR_NAME }}.azurecr.io/nzila-platform:${{ github.sha }}
```

### Deliverables
- ✅ Monorepo initialized with scripts-book template
- ✅ Azure PostgreSQL + Redis provisioned
- ✅ CI/CD pipelines operational (GitHub Actions)
- ✅ Dev/staging environments accessible
- ✅ Secrets management via Azure Key Vault

---

## Phase 1: Foundation Layer (Weeks 3-6)

### Objectives
- Build multi-tenant core with schema-based isolation
- Integrate Clerk authentication
- Implement RBAC system across all services
- Create audit logging infrastructure

### Django Apps
1. **tenants** - Multi-tenant management
2. **users** - User profiles and preferences
3. **auth_rbac** - Role-based access control
4. **audit** - Immutable audit logs

### Database Schema

#### Multi-Tenant Core
```python
# apps/tenants/models.py
from django.db import models
from django_tenants.models import TenantMixin, DomainMixin

class Tenant(TenantMixin):
    """Schema-based tenant isolation"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=200)
    tenant_type = models.CharField(
        max_length=20,
        choices=[
            ('clinic', 'Clinic'),
            ('trial', 'Clinical Trial'),
            ('organization', 'Organization'),
            ('partner', 'Partner')
        ]
    )
    subscription_tier = models.CharField(max_length=50)
    max_users = models.IntegerField(default=50)
    ai_token_budget = models.IntegerField(default=1000000)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Usage tracking
    current_user_count = models.IntegerField(default=0)
    ai_tokens_used = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'tenants'

class Domain(DomainMixin):
    """Tenant domain mapping"""
    pass
```

#### RBAC System
```python
# apps/auth_rbac/models.py
class Role(models.Model):
    """Hierarchical role system"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)
    description = models.TextField()
    level = models.IntegerField()  # Hierarchy level
    parent_role = models.ForeignKey('self', null=True, on_delete=models.CASCADE)
    
    # Scope control
    applies_to_products = models.JSONField(default=list)  # ['memora', 'clinic_connect']
    is_global = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'roles'
        ordering = ['level', 'name']

class Permission(models.Model):
    """Granular permissions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    resource = models.CharField(max_length=100)  # e.g., 'consent_record'
    action = models.CharField(max_length=50)     # e.g., 'read', 'write', 'delete'
    scope = models.CharField(max_length=50)      # 'own', 'team', 'tenant', 'global'
    
    class Meta:
        db_table = 'permissions'
        unique_together = [['resource', 'action', 'scope']]

class UserRole(models.Model):
    """User-role assignment with context"""
    user_id = models.UUIDField()
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    context_type = models.CharField(max_length=50)  # 'tenant', 'trial', 'clinic'
    context_id = models.UUIDField()
    granted_by = models.UUIDField()
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True)
    
    class Meta:
        db_table = 'user_roles'
```

#### Audit Logging
```python
# apps/audit/models.py
class AuditEvent(models.Model):
    """Immutable audit log"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Who
    user_id = models.UUIDField()
    user_email = models.CharField(max_length=255)
    tenant_id = models.UUIDField()
    
    # What
    event_type = models.CharField(max_length=100)  # 'consent.granted', 'ai.request', 'data.exported'
    resource_type = models.CharField(max_length=100)
    resource_id = models.UUIDField(null=True)
    action = models.CharField(max_length=50)
    
    # Context
    source_ip = models.GenericIPAddressField()
    user_agent = models.TextField()
    product = models.CharField(max_length=50)  # 'memora', 'clinic_connect'
    
    # Payload
    changes = models.JSONField(default=dict)
    metadata = models.JSONField(default=dict)
    
    # Security
    risk_score = models.IntegerField(default=0)  # 0-100
    flagged_for_review = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'audit_events'
        indexes = [
            models.Index(fields=['timestamp', 'tenant_id']),
            models.Index(fields=['event_type', 'timestamp']),
            models.Index(fields=['user_id', 'timestamp'])
        ]
```

### API Endpoints

#### Tenant Management
```python
# apps/tenants/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action

class TenantViewSet(viewsets.ModelViewSet):
    """Tenant CRUD with provisioning"""
    
    @action(detail=False, methods=['post'])
    def provision(self, request):
        """Automated tenant provisioning"""
        # 1. Create schema
        # 2. Run migrations
        # 3. Create default roles
        # 4. Generate API keys
        # 5. Send onboarding email
        pass
    
    @action(detail=True, methods=['get'])
    def usage_metrics(self, request, pk=None):
        """Real-time usage tracking"""
        tenant = self.get_object()
        return Response({
            'users': tenant.current_user_count,
            'max_users': tenant.max_users,
            'ai_tokens_used': tenant.ai_tokens_used,
            'ai_token_budget': tenant.ai_token_budget,
            'budget_remaining_pct': (1 - tenant.ai_tokens_used / tenant.ai_token_budget) * 100
        })
```

### Testing Strategy
```python
# apps/tenants/tests/test_isolation.py
from django.test import TestCase
from apps.tenants.models import Tenant

class TenantIsolationTestCase(TestCase):
    """Verify schema-based isolation"""
    
    def test_cross_tenant_data_leak(self):
        """Ensure Tenant A cannot access Tenant B data"""
        tenant_a = Tenant.objects.create(name="Clinic A")
        tenant_b = Tenant.objects.create(name="Clinic B")
        
        # Switch to Tenant A schema
        connection.set_tenant(tenant_a)
        ConsentRecord.objects.create(user_id=user_a, scope='health_data')
        
        # Switch to Tenant B schema
        connection.set_tenant(tenant_b)
        assert ConsentRecord.objects.count() == 0  # Should see no records
```

### Deliverables
- ✅ Multi-tenant core with automated provisioning
- ✅ Clerk authentication integrated
- ✅ RBAC system with permission inheritance
- ✅ Audit logging capturing all sensitive events
- ✅ API gateway with tenant routing
- ✅ 90%+ test coverage

---

## Phase 2: Consent & Governance (Weeks 7-10)

### Objectives
- Build PIPEDA/GDPR/HIPAA compliant consent system
- Implement data governance framework
- Create DSAR (Data Subject Access Request) automation
- Deploy patient consent portal API

### Django Apps
1. **consent** - Consent management
2. **governance** - Data policies and retention

### Database Schema

#### Granular Consent
```python
# apps/consent/models.py
class ConsentScope(models.Model):
    """Predefined consent scopes"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    scope_key = models.CharField(max_length=100, unique=True)  # 'health_data', 'ai_processing'
    name = models.CharField(max_length=200)
    description = models.TextField()
    required_for_products = models.JSONField(default=list)
    parent_scope = models.ForeignKey('self', null=True, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'consent_scopes'

class ConsentRecord(models.Model):
    """Versioned consent tracking"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField(db_index=True)
    scope = models.ForeignKey(ConsentScope, on_delete=models.PROTECT)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('granted', 'Granted'),
            ('withdrawn', 'Withdrawn'),
            ('expired', 'Expired')
        ]
    )
    
    # Temporal tracking
    granted_at = models.DateTimeField()
    expires_at = models.DateTimeField(null=True)
    withdrawn_at = models.DateTimeField(null=True)
    
    # Context
    granted_via = models.CharField(max_length=50)  # 'patient_portal', 'clinic_staff'
    ip_address = models.GenericIPAddressField()
    consent_version = models.CharField(max_length=50)
    
    # Metadata
    metadata = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'consent_records'
        indexes = [
            models.Index(fields=['user_id', 'scope', 'status'])
        ]
```

#### Data Governance
```python
# apps/governance/models.py
class RetentionRule(models.Model):
    """Automated data retention policies"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    data_type = models.CharField(max_length=100)  # 'session_data', 'ai_prompts'
    retention_days = models.IntegerField()
    applies_to_products = models.JSONField(default=list)
    exception_conditions = models.JSONField(default=dict)
    
    class Meta:
        db_table = 'retention_rules'

class DSARRequest(models.Model):
    """DSAR request tracking"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    request_type = models.CharField(
        max_length=20,
        choices=[
            ('access', 'Data Access'),
            ('portability', 'Data Portability'),
            ('erasure', 'Right to Erasure'),
            ('rectification', 'Data Correction')
        ]
    )
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
    data_package_url = models.URLField(null=True)
    
    class Meta:
        db_table = 'dsar_requests'
```

### API Endpoints

#### Consent Management
```python
# apps/consent/views.py
class ConsentViewSet(viewsets.ModelViewSet):
    """Patient-facing consent API"""
    
    @action(detail=False, methods=['post'])
    def grant_consent(self, request):
        """Grant consent with version tracking"""
        ConsentRecord.objects.create(
            user_id=request.user.id,
            scope=request.data['scope'],
            status='granted',
            granted_at=timezone.now(),
            granted_via='patient_portal',
            ip_address=request.META.get('REMOTE_ADDR'),
            consent_version='v1.2.0'
        )
        
        # Audit log
        AuditEvent.objects.create(
            user_id=request.user.id,
            event_type='consent.granted',
            resource_type='consent_record',
            action='create',
            changes={'scope': request.data['scope']}
        )
        
        return Response(status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def my_consents(self, request):
        """User's active consents"""
        consents = ConsentRecord.objects.filter(
            user_id=request.user.id,
            status='granted'
        ).select_related('scope')
        
        return Response([{
            'scope': c.scope.name,
            'granted_at': c.granted_at,
            'expires_at': c.expires_at
        } for c in consents])
```

### Celery Tasks

#### Automated DSAR Fulfillment
```python
# apps/governance/tasks.py
from celery import shared_task

@shared_task
def fulfill_dsar_request(dsar_id):
    """Background task to compile user data"""
    dsar = DSARRequest.objects.get(id=dsar_id)
    user_id = dsar.user_id
    
    # Collect data from all products
    data_package = {
        'memora': collect_memora_data(user_id),
        'clinic_connect': collect_clinic_data(user_id),
        'audit_logs': collect_audit_logs(user_id)
    }
    
    # Encrypt and upload to secure storage
    encrypted_url = upload_encrypted_package(data_package, user_id)
    
    # Update DSAR status
    dsar.status = 'completed'
    dsar.completed_at = timezone.now()
    dsar.data_package_url = encrypted_url
    dsar.save()
    
    # Notify user
    send_dsar_notification(user_id, encrypted_url)
```

### Deliverables
- ✅ Consent management with granular scopes
- ✅ PIPEDA/GDPR compliant consent tracking
- ✅ DSAR automation (access, portability, erasure)
- ✅ Data retention policies
- ✅ Patient consent portal API
- ✅ Compliance audit reports

---

## Phase 3: AI Core Infrastructure (Weeks 11-14)

### Objectives
- Build LLM orchestration layer with Azure OpenAI
- Implement vector database (pgvector) for semantic memory
- Create AI safety and governance layer
- Deploy prompt logging and token tracking

### Django Apps
1. **llm_gateway** - LLM orchestration
2. **memory** - Companion memory engine
3. **ai_safety** - Safety checks and monitoring
4. **cognitive** - Cognitive analytics

### Database Schema

#### LLM Orchestration
```python
# apps/llm_gateway/models.py
class PromptTemplate(models.Model):
    """Versioned prompt templates"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)
    template_text = models.TextField()
    version = models.CharField(max_length=20)
    model_config = models.JSONField(default=dict)  # temperature, max_tokens
    used_by_products = models.JSONField(default=list)
    
    class Meta:
        db_table = 'prompt_templates'

class LLMRequest(models.Model):
    """Prompt logging for governance"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    tenant_id = models.UUIDField()
    
    # Request details
    prompt_template = models.ForeignKey(PromptTemplate, null=True, on_delete=models.SET_NULL)
    full_prompt = models.TextField()
    model_used = models.CharField(max_length=50)
    
    # Response
    completion = models.TextField()
    tokens_used = models.IntegerField()
    latency_ms = models.IntegerField()
    
    # Safety
    safety_check_passed = models.BooleanField(default=True)
    flagged_reasons = models.JSONField(default=list)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'llm_requests'
        indexes = [
            models.Index(fields=['tenant_id', 'created_at'])
        ]
```

#### Vector Memory (pgvector)
```python
# apps/memory/models.py
from pgvector.django import VectorField

class MemoryEmbedding(models.Model):
    """Semantic memory with vector search"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField(db_index=True)
    
    # Content
    memory_text = models.TextField()
    memory_type = models.CharField(max_length=50)  # 'conversation', 'preference', 'milestone'
    
    # Vector embedding (1536 dimensions for text-embedding-ada-002)
    embedding = VectorField(dimensions=1536)
    
    # Metadata
    source_product = models.CharField(max_length=50)
    captured_at = models.DateTimeField(auto_now_add=True)
    importance_score = models.FloatField(default=0.5)
    
    # Consent-aware retrieval
    requires_consent_scope = models.CharField(max_length=100)
    
    class Meta:
        db_table = 'memory_embeddings'
        indexes = [
            VectorIndex('embedding', name='memory_embedding_idx', lists=100, opclasses=['vector_cosine_ops'])
        ]
```

#### AI Safety
```python
# apps/ai_safety/models.py
class SafetyCheck(models.Model):
    """AI safety event logging"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    llm_request = models.ForeignKey('llm_gateway.LLMRequest', on_delete=models.CASCADE)
    
    # Checks performed
    content_moderation_passed = models.BooleanField()
    clinical_safety_passed = models.BooleanField()
    bias_check_passed = models.BooleanField()
    hallucination_risk_score = models.FloatField()  # 0.0 - 1.0
    
    # Actions taken
    was_blocked = models.BooleanField(default=False)
    was_flagged = models.BooleanField(default=False)
    human_review_required = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'ai_safety_checks'
```

### API Endpoints

#### LLM Gateway
```python
# apps/llm_gateway/views.py
from openai import AzureOpenAI

class LLMGatewayView(APIView):
    """Central LLM orchestration endpoint"""
    
    def post(self, request):
        """Route LLM requests with governance"""
        # 1. Check tenant token budget
        tenant = request.tenant
        if tenant.ai_tokens_used >= tenant.ai_token_budget:
            return Response(
                {'error': 'Token budget exceeded'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
        
        # 2. Check user consent for AI processing
        has_consent = ConsentRecord.objects.filter(
            user_id=request.user.id,
            scope__scope_key='ai_processing',
            status='granted'
        ).exists()
        
        if not has_consent:
            return Response(
                {'error': 'User has not consented to AI processing'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 3. Load prompt template
        template = PromptTemplate.objects.get(name=request.data['template_name'])
        full_prompt = template.template_text.format(**request.data['variables'])
        
        # 4. Safety checks (pre-flight)
        if contains_pii(full_prompt):
            return Response({'error': 'PII detected in prompt'}, status=400)
        
        # 5. Call Azure OpenAI
        client = AzureOpenAI(api_key=settings.AZURE_OPENAI_KEY)
        start_time = timezone.now()
        
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": full_prompt}],
            temperature=template.model_config.get('temperature', 0.7)
        )
        
        latency_ms = (timezone.now() - start_time).total_seconds() * 1000
        
        # 6. Log request
        llm_request = LLMRequest.objects.create(
            user_id=request.user.id,
            tenant_id=tenant.id,
            prompt_template=template,
            full_prompt=full_prompt,
            model_used="gpt-4",
            completion=response.choices[0].message.content,
            tokens_used=response.usage.total_tokens,
            latency_ms=latency_ms
        )
        
        # 7. Update tenant usage
        tenant.ai_tokens_used += response.usage.total_tokens
        tenant.save()
        
        # 8. Safety checks (post-flight)
        safety_result = run_safety_checks(llm_request)
        
        if safety_result['block']:
            return Response({'error': 'Response blocked by safety filter'}, status=400)
        
        return Response({
            'completion': response.choices[0].message.content,
            'tokens_used': response.usage.total_tokens,
            'request_id': str(llm_request.id)
        })
```

#### Semantic Memory Search
```python
# apps/memory/views.py
class MemorySearchView(APIView):
    """Vector similarity search"""
    
    def post(self, request):
        """Find relevant memories for context"""
        query_text = request.data['query']
        
        # 1. Generate embedding for query
        embedding = generate_embedding(query_text)
        
        # 2. Check consent
        consented_scopes = get_user_consented_scopes(request.user.id)
        
        # 3. Vector similarity search with consent filtering
        memories = MemoryEmbedding.objects.filter(
            user_id=request.user.id,
            requires_consent_scope__in=consented_scopes
        ).annotate(
            similarity=CosineDistance('embedding', embedding)
        ).order_by('similarity')[:5]
        
        return Response([{
            'text': m.memory_text,
            'type': m.memory_type,
            'captured_at': m.captured_at,
            'relevance_score': 1 - m.similarity
        } for m in memories])
```

### Deliverables
- ✅ LLM orchestration with Azure OpenAI
- ✅ Prompt template management
- ✅ Vector database (pgvector) for semantic search
- ✅ AI safety layer with content filtering
- ✅ Prompt logging and token tracking
- ✅ Consent-aware memory retrieval

---

## Phase 4: Shared Services (Weeks 15-18)

### Objectives
- Deploy multi-channel notification service
- Build integration hub (HL7/FHIR)
- Implement secure file storage
- Create Celery task orchestration
- Deploy observability stack

### Django Apps
1. **notifications** - Multi-channel notifications
2. **integrations** - External system connectors
3. **files** - Secure file management
4. **tasks** - Background job orchestration
5. **observability** - Monitoring and alerting

### Database Schema

#### Notification Service
```python
# apps/notifications/models.py
class NotificationTemplate(models.Model):
    """Multi-channel templates"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100)
    channels = models.JSONField(default=list)  # ['email', 'sms', 'push', 'in_app']
    
    # Templates per channel
    email_subject = models.CharField(max_length=200, blank=True)
    email_body = models.TextField(blank=True)
    sms_body = models.CharField(max_length=160, blank=True)
    push_title = models.CharField(max_length=100, blank=True)
    push_body = models.CharField(max_length=200, blank=True)
    
    class Meta:
        db_table = 'notification_templates'

class Notification(models.Model):
    """Notification delivery tracking"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    template = models.ForeignKey(NotificationTemplate, on_delete=models.PROTECT)
    channel = models.CharField(max_length=20)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('queued', 'Queued'),
            ('sent', 'Sent'),
            ('delivered', 'Delivered'),
            ('failed', 'Failed'),
            ('bounced', 'Bounced')
        ]
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True)
    delivered_at = models.DateTimeField(null=True)
    
    # Fatigue prevention
    sent_as_part_of_batch = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'notifications'
```

### Celery Tasks

#### Notification Orchestration
```python
# apps/notifications/tasks.py
from celery import shared_task

@shared_task
def send_notification(notification_id):
    """Multi-channel delivery with retry logic"""
    notification = Notification.objects.get(id=notification_id)
    
    try:
        if notification.channel == 'email':
            send_email(notification)
        elif notification.channel == 'sms':
            send_sms(notification)
        elif notification.channel == 'push':
            send_push(notification)
        
        notification.status = 'sent'
        notification.sent_at = timezone.now()
        notification.save()
        
    except Exception as e:
        notification.status = 'failed'
        notification.save()
        raise self.retry(exc=e, countdown=300)  # Retry after 5 min
```

### Deliverables
- ✅ Multi-channel notification service
- ✅ HL7/FHIR integration hub
- ✅ Secure file storage with access control
- ✅ Celery task orchestration
- ✅ Observability stack (Azure Application Insights)

---

## Phase 5: Developer Platform (Weeks 19-20)

### Objectives
- Create Python SDK for service communication
- Build React component library
- Generate API documentation (Swagger)
- Deploy developer portal with service catalog

### Python SDK
```python
# nzila_sdk/__init__.py
from nzila_sdk.client import NzilaClient
from nzila_sdk.services import ConsentService, LLMService, MemoryService

class NzilaClient:
    """Unified SDK for all Nzila services"""
    
    def __init__(self, api_key, base_url="https://platform.nzila.io/api/v1"):
        self.api_key = api_key
        self.base_url = base_url
        
        # Service clients
        self.consent = ConsentService(self)
        self.llm = LLMService(self)
        self.memory = MemoryService(self)
    
    def _request(self, method, endpoint, **kwargs):
        """Internal request handler with retry logic"""
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'X-Tenant-ID': self.tenant_id
        }
        return requests.request(method, f"{self.base_url}/{endpoint}", headers=headers, **kwargs)

# Usage in product code (e.g., Memora)
from nzila_sdk import NzilaClient

client = NzilaClient(api_key=settings.NZILA_API_KEY)

# Check consent before AI processing
if client.consent.has_consent(user_id, 'ai_processing'):
    response = client.llm.complete(
        template_name='companion_response',
        variables={'user_message': message}
    )
```

### React Component Library
```typescript
// @nzila/ui-components
export { ConsentModal } from './ConsentModal'
export { NotificationBell } from './NotificationBell'
export { UserAvatar } from './UserAvatar'
export { DataPrivacyBanner } from './DataPrivacyBanner'

// Usage in Memora frontend
import { ConsentModal } from '@nzila/ui-components'

function MemoraApp() {
  return (
    <ConsentModal
      scopes={['health_data', 'ai_processing']}
      onConsent={(scopes) => console.log('Granted:', scopes)}
    />
  )
}
```

### Deliverables
- ✅ Python SDK published to PyPI
- ✅ React component library published to NPM
- ✅ API documentation (Swagger/OpenAPI)
- ✅ Developer portal with tutorials
- ✅ SLA dashboard for service health

---

## Success Metrics

### Technical KPIs
- **API Response Time (P95)**: < 200ms
- **Uptime SLA**: 99.9%
- **AI Request Latency**: < 2s
- **Database Query Time (P95)**: < 50ms

### Business KPIs
- **Product Launch Acceleration**: 50% faster than standalone
- **Shared Service Reuse**: > 80% across products
- **Compliance Audit Pass Rate**: 100%
- **Developer Onboarding Time**: < 2 weeks

### AI Governance KPIs
- **Prompt Audit Coverage**: 100%
- **Safety Check Pass Rate**: > 99.5%
- **Hallucination Detection Rate**: > 95%
- **Consent Coverage for AI**: 100%

---

## Next Steps

1. **Review and approve this roadmap**
2. **Provision Azure infrastructure (Phase 0)**
3. **Initialize monorepo with scripts-book template**
4. **Begin Phase 1 development (Multi-tenant core)**
5. **Weekly sprint reviews and adjustments**

---

**Document Owner**: Nzila Product & Engineering  
**Last Updated**: 2025  
**Next Review**: After Phase 1 completion
