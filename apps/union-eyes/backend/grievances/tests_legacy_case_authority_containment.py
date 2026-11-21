"""Real request denial for the retained, unused generic case CRUD adapters."""
from types import SimpleNamespace
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from core.isolation import DenyAllPermission
from .urls import router


class LegacyCaseAuthorityContainmentTests(SimpleTestCase):
    # Any attempted ORM access fails this test: denial precedes every data read/write.
    databases = set()

    def test_all_retained_grievance_adapters_deny_authenticated_requests(self):
        factory = APIRequestFactory()
        self.assertEqual(len(router.registry), 24)
        for prefix, viewset, _ in router.registry:
            self.assertEqual(viewset.permission_classes, [DenyAllPermission])
            for method, action in (("get", "list"), ("get", "retrieve"),
                                   ("post", "create"), ("put", "update"),
                                   ("patch", "partial_update"), ("delete", "destroy")):
                with self.subTest(endpoint=prefix, method=method, action=action):
                    request = getattr(factory, method)(f"/api/grievances/{prefix}/", {}, format="json")
                    # A senior title, platform status and active session remain insufficient.
                    force_authenticate(request, user=SimpleNamespace(is_authenticated=True,
                        is_staff=True, is_superuser=True, organization_role="admin"))
                    response = viewset.as_view({method: action})(request, pk="00000000-0000-4000-8000-000000000001")
                    self.assertEqual(response.status_code, 403)

    def test_permission_also_refuses_anonymous_and_object_access(self):
        permission = DenyAllPermission()
        self.assertFalse(permission.has_permission(SimpleNamespace(user=None), None))
        self.assertFalse(permission.has_object_permission(None, None, object()))
