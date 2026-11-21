"""Negative boundary proof for unused document/inbox/outbox Django CRUD adapters.

This exercises the real DRF dispatch and permissions, not a UI visibility predicate.
It does not certify positive document, delivery or staging behavior.
"""
from types import SimpleNamespace
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from . import views as content
from notifications import views as notifications


class IndirectCaseApiContainmentTests(SimpleTestCase):
    databases = set()  # An attempted ORM read or write fails before any fixture is needed.
    targets = (content.DocumentsViewSet, content.MemberDocumentsViewSet,
               notifications.InAppNotificationsViewSet, notifications.NotificationQueueViewSet,
               notifications.NotificationDeliveryLogViewSet)

    def test_real_authenticated_dispatch_denies_crud_and_every_custom_action(self):
        factory = APIRequestFactory()
        for viewset in self.targets:
            operations = [(method, action, {}) for method, action in
                          (("get", "list"), ("get", "retrieve"), ("post", "create"),
                           ("put", "update"), ("patch", "partial_update"), ("delete", "destroy"))]
            for extra in viewset.get_extra_actions():
                # Router action-specific permission overrides must not bypass containment.
                init = {key: value for key, value in extra.kwargs.items()
                        if key in ("permission_classes", "authentication_classes")}
                operations.extend((method, action, init) for method, action in extra.mapping.items())
            for method, action, init in operations:
                with self.subTest(viewset=viewset.__name__, method=method, action=action):
                    request = getattr(factory, method)("/retained-case-adapter/", {}, format="json")
                    force_authenticate(request, user=SimpleNamespace(is_authenticated=True,
                        is_staff=True, is_superuser=True, organization_role="admin"))
                    response = viewset.as_view({method: action}, **init)(request,
                        pk="00000000-0000-4000-8000-000000000001")
                    self.assertEqual(response.status_code, 403)

    def test_permissions_refuse_objects_and_anonymous_principals(self):
        for viewset in self.targets:
            permissions = viewset().get_permissions()
            self.assertTrue(permissions)
            for permission in permissions:
                self.assertFalse(permission.has_permission(SimpleNamespace(user=None), viewset()))
                self.assertFalse(permission.has_object_permission(None, viewset(), object()))
