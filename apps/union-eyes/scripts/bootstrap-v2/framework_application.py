"""Actual current Django HTTP/admin and Celery ORM under synthetic V2 principals."""

import json
import os
import sys
import time
from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path

target = json.loads(Path("/workspace/target.json").read_text())
backend = Path("/workspace/repo/apps/union-eyes/backend")
if (backend / ".env").exists() or (backend / ".env.local").exists():
    raise RuntimeError("UE_FRAMEWORK_APPLICATION_DOTENV_FORBIDDEN")
os.environ.update(
    {
        "DJANGO_SETTINGS_MODULE": "config.settings",
        "DJANGO_SECRET_KEY": "synthetic-current-framework-application-key",
        "DJANGO_DEBUG": "False",
        "DJANGO_ALLOWED_HOSTS": "testserver,localhost,127.0.0.1",
        "UE_CANONICAL_BOOTSTRAP_V2": "1",
        "PGHOST": "127.0.0.1",
        "PGPORT": "5432",
        "PGDATABASE": target["database"],
        "REDIS_URL": "redis://127.0.0.1:1/0",
        "CELERY_BROKER_URL": "memory://",
        "CELERY_RESULT_BACKEND": "django-db",
        "AUTH_ISSUER": "https://synthetic-issuer.example.invalid/",
        "AUTH_AUDIENCE": "ue-synthetic-canonical-application",
        "AUTH_JWKS_URL": "https://synthetic-issuer.example.invalid/jwks",
    }
)
for prefix, name in (
    ("UE_V2_RUNTIME", "runtime"),
    ("UE_V2_AUTH", "auth"),
    ("UE_V2_FRAMEWORK_REQUEST", "request"),
    ("UE_V2_FRAMEWORK_WORKER", "worker"),
):
    os.environ[prefix + "_PGUSER"] = target["users"][name]
    os.environ[prefix + "_PGPASSWORD"] = target["password"]
sys.path.insert(0, str(backend))
import django
from django.db.backends.base.base import BaseDatabaseWrapper

original_connect = BaseDatabaseWrapper.connect


def checked_connect(self):
    if (
        self.settings_dict["HOST"] != "127.0.0.1"
        or str(self.settings_dict["PORT"]) != "5432"
        or self.settings_dict["NAME"] != target["database"]
        or self.settings_dict["USER"] not in target["users"].values()
    ):
        raise RuntimeError("UE_FRAMEWORK_APPLICATION_EXTERNAL_DATABASE_FORBIDDEN")
    return original_connect(self)


BaseDatabaseWrapper.connect = checked_connect
django.setup()
from django.conf import settings
from django.db import connections
from django.test import Client, override_settings
from django.urls import reverse

cases = []


def check(name, operation):
    operation()
    cases.append(name)


client = Client()
users_url = reverse("auth_core:users-list")


def request(actor, path, method="get", data=None):
    headers = {
        "HTTP_AUTHORIZATION": f"Bearer synthetic-ue-framework-{actor}-bearer-only"
    }
    return getattr(client, method)(
        path, data=data, content_type="application/json", **headers
    )


def status(response, expected):
    assert response.status_code == expected, (
        response.status_code,
        response.content[:500],
    )


with override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
):
    check(
        "anonymous-current-users-api-denied", lambda: status(client.get(users_url), 401)
    )
    check(
        "member-current-users-api-authenticated",
        lambda: status(request("member", users_url), 200),
    )
    me = request("member", reverse("auth_core:me"))
    status(me, 200)
    assert me.json()["id"] == "ue-framework-member"
    assert me.json()["userId"] == "ue-framework-member"
    assert me.json()["organization"]["role"] == "member"
    cases.append("actual-current-profile-uses-canonical-id-and-membership-role")
    from auth_core.canonical_context import CanonicalActor, CanonicalPrincipal

    principal = CanonicalPrincipal(
        CanonicalActor(
            "canonical-current-user",
            "canonical-current-user@example.invalid",
            False,
            "55555555-5555-4555-8555-555555555555",
            "member",
            "synthetic-attribute-proof-not-an-authentication-session",
        ),
        SimpleNamespace(
            id=999,
            user_id="foreign-metadata-user",
            username="foreign-metadata-user",
            organization_id="66666666-6666-4666-8666-666666666666",
            organization_role="admin",
            is_system_admin=True,
        ),
    )
    assert (
        principal.id
        == principal.user_id
        == principal.username
        == "canonical-current-user"
    )
    assert principal.organization_id == "55555555-5555-4555-8555-555555555555"
    assert principal.organization_role == "member" and not principal.is_system_admin
    cases.append("canonical-actor-attributes-cannot-inherit-forged-framework-metadata")
    emission = request(
        "member", reverse("carbon-accounting-service-record-emission"), "post", {}
    )
    status(emission, 400)
    assert emission.json()["error"].startswith("Missing required fields:")
    cases.append("actual-current-service-canonical-organization-attribute")
    emissions = [
        ("member", "55555555-5555-4555-8555-555555555555", "12.5"),
        ("org-admin", "66666666-6666-4666-8666-666666666666", "27.25"),
    ]
    for actor, organization, amount in emissions:
        response = request(
            actor,
            reverse("carbon-accounting-service-record-emission"),
            "post",
            {
                "source": "synthetic-current-business-emission",
                "scope": "scope_1",
                "amount_kg": amount,
                "emission_date": "2026-01-01",
                "organization_id": emissions[1 if actor == "member" else 0][1],
                "user_id": "forged-current-service-actor",
            },
        )
        status(response, 201)
        assert response.json()["status"] == "success" and response.json()["id"]
    cases.append("actual-current-service-two-organization-business-writes")
    for actor, organization, amount in emissions:
        response = request(actor, reverse("carbon-accounting-service-emission-report"))
        status(response, 200)
        report = response.json()
        assert report["status"] == "success"
        assert report["organization_id"] == organization
        assert report["total_entries"] == 1
        assert report["total_emissions_kg"] == amount
        assert report["by_scope"] == {
            "scope_1": amount,
            "scope_2": "0",
            "scope_3": "0",
        }
    cases.append("actual-current-service-business-reads-isolate-both-organizations")
    for actor, organization, amount in emissions:
        response = request(actor, reverse("core:auditlogs-list"))
        status(response, 200)
        payload = response.json()
        records = payload["results"] if isinstance(payload, dict) else payload
        assert isinstance(records, list)
        records = [
            record for record in records if record["resource_type"] == "CarbonEmission"
        ]
        assert len(records) == 1
        assert records[0]["user_id"] == f"ue-framework-{actor}"
        assert records[0]["details"]["amount_kg"] == amount
    cases.append("actual-current-service-persisted-actor-ignores-forged-attribution")
    status(
        client.get(
            users_url,
            HTTP_AUTHORIZATION="Bearer "
            + sha256(b"synthetic-ue-framework-member-bearer-only").hexdigest(),
        ),
        401,
    )
    status(request("new-member", users_url), 401)
    status(
        client.get(
            users_url,
            HTTP_AUTHORIZATION="Bearer synthetic-ue-framework-member-bearer-only",
            HTTP_X_ORGANIZATION_ID="66666666-6666-4666-8666-666666666666",
        ),
        401,
    )
    cases.append("actual-http-stored-hash-missing-membership-foreign-org-denied")
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = {
        "iss": settings.AUTH_ISSUER,
        "aud": settings.AUTH_AUDIENCE,
        "sub": "not-used-as-canonical-id",
        "tid": "ue-framework-tenant",
        "oid": "ue-framework-object",
        "exp": int(time.time()) + 120,
        "org_role": "admin",
        "is_system_admin": True,
    }
    from auth_core.canonical_context import auth_scope

    with patch(
        "jwt.PyJWKClient.get_signing_key_from_jwt",
        return_value=SimpleNamespace(key=key.public_key()),
    ):
        oidc = jwt.encode(claims, key, algorithm="RS256")
        profile = client.get(
            reverse("auth_core:me"), HTTP_AUTHORIZATION="Bearer " + oidc
        )
        status(profile, 200)
        assert profile.json()["userId"] == "ue-framework-member"
        assert profile.json()["organization"]["role"] == "member"
        for altered in (
            {"aud": "foreign-client"},
            {"iss": "https://foreign.invalid"},
            {"oid": "unprovisioned-object"},
            {"exp": int(time.time()) - 60},
        ):
            bad = jwt.encode({**claims, **altered}, key, algorithm="RS256")
            status(client.get(users_url, HTTP_AUTHORIZATION="Bearer " + bad), 401)
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        bad_signature = jwt.encode(claims, other_key, algorithm="RS256")
        status(client.get(users_url, HTTP_AUTHORIZATION="Bearer " + bad_signature), 401)
        from auth_core.canonical_context import (
            CanonicalContextMiddleware,
            revoke_bridge,
        )
        from django.test import RequestFactory

        def failed_view(request):
            raise ValueError("synthetic primary view failure")

        with patch(
            "auth_core.canonical_context.revoke_bridge",
            side_effect=RuntimeError("synthetic bridge cleanup failure"),
        ) as revocation:
            try:
                CanonicalContextMiddleware(failed_view)(
                    RequestFactory().get(
                        users_url,
                        HTTP_AUTHORIZATION="Bearer " + oidc,
                    )
                )
                raise AssertionError("Dual failure did not propagate")
            except ExceptionGroup as exc:
                assert [type(error) for error in exc.exceptions] == [
                    ValueError,
                    RuntimeError,
                ]
                assert isinstance(exc.__cause__, ValueError)
            finally:
                if revocation.call_args:
                    revoke_bridge(revocation.call_args.args[0])
        cases.append("actual-callback-and-bridge-cleanup-dual-failures-preserved")
    with auth_scope(
        "identity", **{"nzila.auth_user_id": "ue-framework-member"}
    ) as cursor:
        cursor.execute(
            "SELECT is_active,expires_at-created_at<=interval '30 seconds' FROM user_management.user_sessions "
            "WHERE device_info->>'purpose'='django-canonical-provider-bridge'"
        )
        bridges = cursor.fetchall()
        assert len(bridges) == 2 and all(
            row == (False, True) for row in bridges
        ), bridges
    cases.append(
        "actual-signed-provider-immutable-mapping-strict-jwt-bridge-revocation"
    )
    check(
        "member-current-framework-admin-denied",
        lambda: status(request("member", "/admin/"), 302),
    )
    check(
        "org-admin-is-not-platform-framework-admin",
        lambda: status(request("org-admin", "/admin/"), 302),
    )
    check(
        "canonical-platform-current-admin-index",
        lambda: status(request("platform-admin", "/admin/"), 200),
    )
    check(
        "canonical-platform-current-django-user-admin",
        lambda: status(request("platform-admin", "/admin/auth/user/"), 200),
    )
    created = request("member", users_url, "post", {"user_id": "ue-framework-member"})
    status(created, 201)
    cases.append("member-current-self-metadata-create")
    check(
        "member-current-foreign-metadata-create-denied",
        lambda: status(
            request("member", users_url, "post", {"user_id": "ue-framework-org-admin"}),
            403,
        ),
    )
    response = request("org-admin", users_url)
    status(response, 200)
    assert response.json()["results"] == [], response.content
    cases.append("current-api-cross-user-visibility-denied")
    oauth_url = reverse("auth_core:oauthproviders-list")
    oauth = request("member", oauth_url, "post", {"user_id": "ue-framework-member"})
    status(oauth, 201)
    foreign_oauth = request("org-admin", oauth_url)
    status(foreign_oauth, 200)
    assert foreign_oauth.json()["results"] == []
    status(
        request(
            "member",
            reverse(
                "auth_core:oauthproviders-detail", kwargs={"pk": oauth.json()["id"]}
            ),
            "delete",
        ),
        204,
    )
    cases.append("actual-current-provider-metadata-self-crud-not-identity-authority")
    status(
        request(
            "member",
            reverse("auth_core:users-detail", kwargs={"pk": created.json()["id"]}),
            "delete",
        ),
        204,
    )
    donations_url = reverse("billing:donations-list")
    organization_a = "55555555-5555-4555-8555-555555555555"
    organization_b = "66666666-6666-4666-8666-666666666666"
    donation = request(
        "member", donations_url, "post", {"organization": organization_a}
    )
    status(donation, 201)
    donation_url = reverse(
        "billing:donations-detail", kwargs={"pk": donation.json()["id"]}
    )
    status(request("member", donation_url, "patch", {}), 200)
    status(
        request("member", donation_url, "put", {"organization": organization_a}),
        200,
    )
    foreign = request("org-admin", donations_url)
    status(foreign, 200)
    assert foreign.json()["results"] == []
    for method in ("get", "patch", "delete"):
        status(request("org-admin", donation_url, method, {}), 404)
    for path, method in ((donations_url, "post"), (donation_url, "patch")):
        status(
            request("member", path, method, {"organization": organization_b}),
            400,
        )
    cases.append("actual-current-donation-metadata-tenant-crud-and-foreign-fk-denial")
    donation_b = request(
        "org-admin", donations_url, "post", {"organization": organization_b}
    )
    status(donation_b, 201)
    visible = request("member", donations_url)
    status(visible, 200)
    assert [row["id"] for row in visible.json()["results"]] == [donation.json()["id"]]
    status(request("member", donation_url, "delete"), 204)
    status(
        request(
            "org-admin",
            reverse("billing:donations-detail", kwargs={"pk": donation_b.json()["id"]}),
            "delete",
        ),
        204,
    )
    cases.append("actual-current-donation-metadata-two-org-visibility-and-cleanup")
    for namespace, name, field in (
        ("core", "failedloginattempts", "email"),
        ("core", "ratelimitevents", "identifier"),
        ("billing", "clcchartofaccounts", "account_code"),
    ):
        metadata_url = reverse(f"{namespace}:{name}-list")
        status(client.get(metadata_url), 401)
        for actor in ("member", "org-admin"):
            status(request(actor, metadata_url), 403)
            status(request(actor, metadata_url, "post", {}), 403)
        status(request("platform-admin", metadata_url), 200)
        metadata = request(
            "platform-admin",
            metadata_url,
            "post",
            {field: "synthetic-platform-metadata"},
        )
        status(metadata, 201)
        detail = reverse(
            f"{namespace}:{name}-detail", kwargs={"pk": metadata.json()["id"]}
        )
        status(
            request("platform-admin", detail, "patch", {field: "synthetic-updated"}),
            200,
        )
        for actor in ("member", "org-admin"):
            status(request(actor, detail), 403)
            status(request(actor, detail, "patch", {}), 403)
            status(request(actor, detail, "delete"), 403)
        status(request("platform-admin", detail, "delete"), 204)
        cases.append(f"actual-current-{name}-private-platform-crud-and-tenant-denial")
    for alias in ("default", "ue_framework_request", "ue_auth"):
        with connections[alias].cursor() as cursor:
            cursor.execute(
                "SELECT nullif(current_setting('app.current_user_id',true),''),"
                "nullif(current_setting('app.current_session_token',true),'')"
            )
            assert cursor.fetchone() == (None, None)
    cases.append("current-request-connections-context-cleared")
    settings.UE_V2_PROCESS_CONTEXT = "worker"
    from config.celery import app

    app.backend.store_result(
        "ue-framework-current-worker-task", {"synthetic": True}, "SUCCESS"
    )
    assert app.backend.get_task_meta("ue-framework-current-worker-task")["result"] == {
        "synthetic": True
    }
    from django_celery_beat.models import IntervalSchedule, PeriodicTask

    schedule = IntervalSchedule.objects.create(every=5, period=IntervalSchedule.SECONDS)
    task = PeriodicTask.objects.create(
        name="ue-framework-current-beat",
        task="config.celery.debug_task",
        interval=schedule,
    )
    task.enabled = False
    task.save()
    task.delete()
    schedule.delete()
    from django_celery_results.models import TaskResult

    TaskResult.objects.filter(task_id="ue-framework-current-worker-task").delete()
    cases.append("actual-current-celery-result-and-beat-model-consumers")

connections.close_all()
print(
    json.dumps(
        {
            "result": "PASS",
            "cases": cases,
            "currentSettings": settings.SETTINGS_MODULE,
            "externalDatabaseConnections": 0,
            "syntheticOnly": True,
            "wholeApplicationQualification": "NOT_PROVEN",
        }
    )
)
