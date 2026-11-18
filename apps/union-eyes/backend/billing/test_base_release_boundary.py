"""Authenticated DRF financial handlers must deny before any business SQL."""
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.viewsets import ModelViewSet

from billing import views


class BaseReleaseFinancialBoundary(SimpleTestCase):
    def test_every_registered_financial_view_denies_every_role_and_method_without_sql(self):
        endpoints = [
            view for view in vars(views).values()
            if isinstance(view, type) and issubclass(view, ModelViewSet)
            and view.__module__ == views.__name__
        ]
        self.assertGreater(len(endpoints), 60)
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
                    with self.subTest(endpoint=endpoint.__name__, role=role, action=action):
                        request = getattr(factory, method)(
                            "/synthetic-finance-boundary/",
                            {"organization_id": "66666666-6666-4666-8666-666666666666",
                             "amount": "99.00", "payment_status": "paid"},
                            format="json",
                        )
                        force_authenticate(request, user=actor)
                        with patch("django.db.backends.utils.CursorWrapper.execute") as sql:
                            response = endpoint.as_view({method: action})(request, pk="synthetic-denied-row")
                        self.assertEqual(response.status_code, 403)
                        sql.assert_not_called()
