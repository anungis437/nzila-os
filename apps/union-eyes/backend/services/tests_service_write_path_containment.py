"""Convergence tranche 9: the services/api ViewSets that nothing calls are contained, and the one that is called is open for one action only.

The generated service ViewSets were ``IsAuthenticated`` only, with no tenant scope and no role: any signed-in user could send a push or an SMS, record an
indigenous-data consent, approve access to traditional knowledge, issue a golden share or declare force majeure, and 64 create paths built a row from every key
of the request body. The application calls exactly one of them (``governance-service/check_status``, through ``services/governance-service.ts``).
"""
import ast
import inspect
import re
import types
import uuid
from pathlib import Path

from django.test import SimpleTestCase, TestCase
from rest_framework.permissions import IsAuthenticated
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import AuditLogs
from services.api import urls as service_urls

# (router prefix, action) pairs that are open to an authenticated caller. Anything else must be denied, so a new action, or a new ViewSet,
# is closed until it is added here with a reviewed, tenant-scoped, role-gated design.
LIVE = {("governance-service", "check_status")}

STANDARD_ACTIONS = ("list", "create", "retrieve", "update", "partial_update", "destroy")
API = Path(__file__).resolve().parent / "api"


def authenticated_request():
    request = APIRequestFactory().post("/api/services/")
    request.user = types.SimpleNamespace(is_authenticated=True, id="user", organization_id=uuid.uuid4())
    return request


def actions_of(viewset):
    extra = {a.__name__: a for a in viewset.get_extra_actions()}
    return list(STANDARD_ACTIONS) + sorted(extra)


class ServiceViewSetContainmentTests(SimpleTestCase):
    def test_the_router_registers_the_viewsets_this_test_covers(self):
        prefixes = {prefix for prefix, _viewset, _basename in service_urls.router.registry}
        self.assertGreaterEqual(len(prefixes), 22)
        for prefix, _action in LIVE:
            self.assertIn(prefix, prefixes)

    def test_an_authenticated_caller_reaches_only_the_live_actions(self):
        reachable = set()
        for prefix, viewset, _basename in service_urls.router.registry:
            for name in actions_of(viewset):
                view = viewset()
                view.action = name
                view.request = authenticated_request()
                if all(permission.has_permission(view.request, view) for permission in view.get_permissions()):
                    reachable.add((prefix, name))
        self.assertEqual(reachable, LIVE)

    def test_an_unauthenticated_caller_reaches_nothing(self):
        anonymous = types.SimpleNamespace(is_authenticated=False)
        for prefix, viewset, _basename in service_urls.router.registry:
            for name in actions_of(viewset):
                view = viewset()
                view.action = name
                request = authenticated_request()
                request.user = anonymous
                self.assertFalse(
                    all(permission.has_permission(request, view) for permission in view.get_permissions()), f"{prefix}.{name}"
                )

    def test_the_live_action_is_authenticated_only_and_reads_without_writing(self):
        governance = dict((prefix, viewset) for prefix, viewset, _ in service_urls.router.registry)["governance-service"]
        view = governance()
        view.action = "check_status"
        self.assertEqual([type(p) for p in view.get_permissions()], [IsAuthenticated])
        source = inspect.getsource(governance.check_status)
        self.assertIsNone(re.search(r"\.(create|update|delete|save|bulk_create|update_or_create|get_or_create)\(", source))

    def test_a_new_action_of_the_live_viewset_is_denied_until_it_is_listed(self):
        governance = dict((prefix, viewset) for prefix, viewset, _ in service_urls.router.registry)["governance-service"]
        view = governance()
        view.action = "an_action_nobody_reviewed"
        view.request = authenticated_request()
        self.assertFalse(all(permission.has_permission(view.request, view) for permission in view.get_permissions()))

    def test_no_service_module_still_builds_a_row_from_every_request_key_behind_an_open_permission(self):
        # The registry test above proves no action is reachable; this names the cause in the source, so the pattern cannot return unnoticed.
        offenders = []
        for path in sorted(API.glob("*_views.py")):
            source = path.read_text(encoding="utf-8")
            if not re.search(r"\*\*\{k: v for k, v in [\w.]+\.items\(\)", source):
                continue
            for node in ast.walk(ast.parse(source)):
                if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "permission_classes" for t in node.targets):
                    if any(getattr(element, "id", None) == "IsAuthenticated" for element in getattr(node.value, "elts", [])):
                        offenders.append(path.name)
        self.assertEqual(offenders, [])


class ServiceRoutesTests(TestCase):
    """Every extra action of every service ViewSet, called through DRF's view layer (no middleware, so no Redis)."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = types.SimpleNamespace(is_authenticated=True, id="user", organization_id=uuid.uuid4())

    def routes(self):
        for prefix, viewset, _basename in service_urls.router.registry:
            for extra in viewset.get_extra_actions():
                for method in extra.mapping:
                    yield prefix, viewset, extra, method

    def call(self, viewset, extra, method, payload, authenticated=True):
        request = getattr(self.factory, method)("/", payload, format="json")
        if authenticated:
            force_authenticate(request, user=self.user)
        kwargs = {"pk": "1"} if extra.detail else {}
        return viewset.as_view({method: extra.__name__})(request, **kwargs)

    def test_every_service_route_is_refused_except_the_live_one(self):
        checked = 0
        for prefix, viewset, extra, method in self.routes():
            response = self.call(viewset, extra, method, {})
            if (prefix, extra.__name__) in LIVE:
                self.assertEqual(response.status_code, 200, f"{method} {prefix}/{extra.__name__}")
            else:
                self.assertEqual(response.status_code, 403, f"{method} {prefix}/{extra.__name__}")
            checked += 1
        self.assertGreater(checked, 150)

    def test_no_refused_route_wrote_anything(self):
        before = AuditLogs.objects.count()
        for prefix, viewset, extra, method in self.routes():
            if (prefix, extra.__name__) not in LIVE:
                self.call(viewset, extra, method, {"organizationId": str(uuid.uuid4()), "anything": "goes"})
        self.assertEqual(AuditLogs.objects.count(), before)

    def test_an_anonymous_caller_is_refused_everywhere(self):
        for prefix, viewset, extra, method in self.routes():
            response = self.call(viewset, extra, method, {}, authenticated=False)
            self.assertIn(response.status_code, (401, 403), f"{method} {prefix}/{extra.__name__}")
