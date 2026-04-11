"""
API URL Configuration
Generated for UnionEyes service migration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Import ViewSets
# TODO: Add imports after copying viewsets to Django app

router = DefaultRouter()

# Register ViewSets
router.register(r'workflows.test', Workflows.testViewSet, basename='workflows.test')
router.register(r'governance-service', GovernanceServiceViewSet, basename='governance-service')
router.register(r'schema', SchemaViewSet, basename='schema')
router.register(r'certification-management-service', CertificationManagementServiceViewSet, basename='certification-management-service')
router.register(r'lmbp-immigration-service', LmbpImmigrationServiceViewSet, basename='lmbp-immigration-service')
router.register(r'schema', SchemaViewSet, basename='schema')
router.register(r'tax-slip-service', TaxSlipServiceViewSet, basename='tax-slip-service')
router.register(r'signature-service', SignatureServiceViewSet, basename='signature-service')

urlpatterns = [
    path('', include(router.urls)),
]
