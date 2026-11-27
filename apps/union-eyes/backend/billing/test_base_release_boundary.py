"""Authenticated DRF financial handlers must deny before any business SQL."""
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.viewsets import GenericViewSet

from billing.urls import router


class BaseReleaseFinancialBoundary(SimpleTestCase):
    def test_every_registered_financial_view_denies_every_role_and_exposed_action_without_sql(self):
        endpoints = [view for _, view, _ in router.registry]
        self.assertEqual(len(endpoints), 81)
        self.assertEqual(len(set(endpoints)), 81)
        self.assertTrue(all(issubclass(view, GenericViewSet) for view in endpoints))
        self.assertEqual(
            [view.__name__ for view in endpoints if not hasattr(view, "create")],
            ["AccountMappingsViewSet"],
        )
        factory = APIRequestFactory()
        for endpoint in endpoints:
            for role in ("member", "steward", "officer", "executive", "admin"):
                actor = SimpleNamespace(
                    is_authenticated=True, is_active=True,
                    organization_role=role, is_system_admin=role == "admin",
                )
                for method, action in (
                    ("get", "list"), ("post", "create"), ("get", "retrieve"),
                    ("put", "update"), ("patch", "partial_update"), ("delete", "destroy"),
                ):
                    # ReadOnlyModelViewSet is a sibling of ModelViewSet, so a
                    # subclass scan used to omit its real list/retrieve routes.
                    if not hasattr(endpoint, action):
                        continue
                    with self.subTest(endpoint=endpoint.__name__, role=role, action=action):
                        request = getattr(factory, method)(
                            "/synthetic-finance-boundary/",
                            {"organization_id": "66666666-6666-4666-8666-666666666666",
                             "amount": "99.00", "payment_status": "paid"},
                            format="json",
                        )
                        force_authenticate(request, user=actor)
                        with patch("django.db.backends.utils.CursorWrapper.execute") as sql, patch(
                            "django.db.backends.utils.CursorWrapper.executemany"
                        ) as bulk_sql:
                            response = endpoint.as_view({method: action})(request, pk="synthetic-denied-row")
                        self.assertEqual(response.status_code, 403)
                        sql.assert_not_called()
                        bulk_sql.assert_not_called()
