"""Prospective V2 canonical authority and dedicated Django execution contexts."""

from contextlib import ExitStack, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID
import jwt

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import AnonymousUser
from django.http import JsonResponse
from django.db import connections, transaction
from django.db import DatabaseError
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

FRAMEWORK_APPS = frozenset(
    {
        "auth",
        "admin",
        "contenttypes",
        "sessions",
        "django_celery_beat",
        "django_celery_results",
    }
)
PLATFORM_METADATA_TABLES = frozenset(
    {"failed_login_attempts", "rate_limit_events", "clc_chart_of_accounts"}
)
AUTH_SETTINGS = (
    "nzila.auth_phase",
    "nzila.auth_selector",
    "nzila.auth_email",
    "nzila.auth_token_hash",
    "nzila.auth_user_id",
    "nzila.auth_actor_id",
    "nzila.auth_org_id",
    "nzila.auth_operation",
    "nzila.auth_reason",
    "nzila.auth_ip",
    "nzila.auth_provider",
    "nzila.auth_provider_subject",
)
_actor = ContextVar("ue_canonical_actor", default=None)


@dataclass(frozen=True)
class CanonicalActor:
    user_id: str
    email: str
    platform_admin: bool
    organization_id: str | None
    organization_role: str | None
    bearer: str = field(repr=False)
    bridge: bool = False


class CanonicalPrincipal:
    def __init__(self, actor, framework_user):
        self.id = actor.user_id
        self.user_id = actor.user_id
        self.username = actor.user_id
        self.organization_id = actor.organization_id
        self.organization_role = actor.organization_role
        self.is_system_admin = actor.platform_admin
        self.framework_user = framework_user

    def __getattr__(self, name):
        return getattr(self.framework_user, name)


@contextmanager
def auth_scope(phase, **values):
    roles = {
        "lookup": "nzila_auth_lookup",
        "identity": "nzila_auth_identity",
        "provider": "nzila_auth_provider",
    }
    if phase not in roles:
        raise ValueError("Unsupported canonical authentication phase")
    with transaction.atomic(using="ue_auth"):
        with connections["ue_auth"].cursor() as cursor:
            cursor.execute(f'SET LOCAL ROLE "{roles[phase]}"')
            for name in AUTH_SETTINGS:
                cursor.execute(
                    "SELECT set_config(%s,%s,true)",
                    [
                        name,
                        phase if name == "nzila.auth_phase" else values.get(name, ""),
                    ],
                )
            yield cursor


def resolve_actor(bearer, requested_org=None):
    digest = sha256(bearer.encode()).hexdigest()
    provider_payload = None
    with auth_scope(
        "lookup", **{"nzila.auth_selector": "session", "nzila.auth_token_hash": digest}
    ) as cursor:
        cursor.execute(
            "SELECT user_id,organization_id FROM user_management.user_sessions "
            "WHERE session_token_hash=%s AND is_active AND expires_at>statement_timestamp()",
            [digest],
        )
        sessions = cursor.fetchall()
    if len(sessions) > 1:
        raise AuthenticationFailed("Ambiguous canonical session authority")
    if sessions:
        user_id, session_org = sessions[0]
    else:
        from auth_core.authentication import OIDCAuthentication

        try:
            provider_payload = OIDCAuthentication()._verify_token(bearer)
        except jwt.PyJWTError as exc:
            raise AuthenticationFailed("Invalid canonical provider token") from exc
        provider = settings.AUTH_PROVIDER_NAMESPACE
        if provider == "entra":
            tenant = provider_payload.get("tid")
            subject = provider_payload.get("oid")
            if (
                not isinstance(tenant, str)
                or not isinstance(subject, str)
                or not tenant.strip()
                or not subject.strip()
                or ":" in tenant
                or ":" in subject
            ):
                raise AuthenticationFailed(
                    "Immutable Entra tenant and object identity required"
                )
            subject = f"{tenant}:{subject}"
        else:
            raise AuthenticationFailed("Unsupported canonical identity provider")
        with auth_scope(
            "provider",
            **{
                "nzila.auth_provider": provider,
                "nzila.auth_provider_subject": subject,
            },
        ) as cursor:
            cursor.execute(
                "SELECT user_id FROM user_management.users "
                "WHERE user_id=user_management.auth_provider_user() AND is_active AND lifecycle_state='active'"
            )
            mapped = cursor.fetchall()
        if len(mapped) != 1:
            raise AuthenticationFailed("Active canonical provider identity required")
        user_id, session_org = mapped[0][0], None
    if requested_org:
        try:
            requested_org = str(UUID(requested_org))
        except (ValueError, AttributeError) as exc:
            raise AuthenticationFailed("Canonical organization UUID required") from exc
    if session_org and requested_org and str(session_org) != requested_org:
        raise AuthenticationFailed("Session organization mismatch")
    selected_org = requested_org or (str(session_org) if session_org else None)
    with auth_scope("identity", **{"nzila.auth_user_id": user_id}) as cursor:
        cursor.execute(
            "SELECT email,is_system_admin FROM user_management.users "
            "WHERE user_id=%s AND is_active AND lifecycle_state='active'",
            [user_id],
        )
        user = cursor.fetchone()
        if user is None:
            raise AuthenticationFailed("Active canonical user required")
        cursor.execute(
            "SELECT organization_id,role FROM user_management.organization_users "
            "WHERE user_id=%s AND is_active "
            "AND (%s::uuid IS NULL OR organization_id=%s::uuid) "
            "ORDER BY is_primary DESC,organization_id LIMIT 1",
            [user_id, selected_org, selected_org],
        )
        membership = cursor.fetchone()
        if membership is None and (selected_org or not user[1]):
            raise AuthenticationFailed(
                "Active canonical organization membership required"
            )
        if membership and membership[1] not in (
            "member",
            "steward",
            "chief_steward",
            "admin",
        ):
            raise AuthenticationFailed("Unsupported canonical organization role")
        organization_id = str(membership[0]) if membership else None
        if provider_payload is not None:
            bearer = token_urlsafe(32)
            digest = sha256(bearer.encode()).hexdigest()
            expires = datetime.fromtimestamp(provider_payload["exp"], timezone.utc)
            cursor.execute(
                "INSERT INTO user_management.user_sessions"
                "(user_id,organization_id,session_token,session_token_hash,is_active,created_at,expires_at,device_info) "
                "VALUES (%s,%s,%s,%s,true,statement_timestamp(),LEAST(statement_timestamp()+interval '30 seconds',%s),"
                '\'{"purpose":"django-canonical-provider-bridge"}\'::jsonb)',
                [user_id, organization_id, digest, digest, expires],
            )
    return CanonicalActor(
        user_id,
        user[0],
        user[1],
        organization_id,
        membership[1] if membership else None,
        bearer,
        provider_payload is not None,
    )


def revoke_bridge(actor):
    if not actor.bridge:
        return
    with auth_scope("identity", **{"nzila.auth_user_id": actor.user_id}) as cursor:
        cursor.execute(
            "UPDATE user_management.user_sessions SET is_active=false "
            "WHERE user_id=%s AND session_token_hash=%s",
            [actor.user_id, sha256(actor.bearer.encode()).hexdigest()],
        )
        if cursor.rowcount != 1:
            raise RuntimeError(
                "Canonical provider bridge revocation did not affect exactly one session"
            )


def bind_connection(alias, role, actor):
    if role not in (
        "union_eyes_runtime",
        "ue_framework_identity",
        "ue_framework_admin",
    ):
        raise ValueError("Unsupported application execution role")
    with connections[alias].cursor() as cursor:
        cursor.execute(f'SET LOCAL ROLE "{role}"')
        for name, value in (
            ("app.current_user_id", actor.user_id if actor else ""),
            ("app.current_org_id", actor.organization_id or "" if actor else ""),
            ("app.current_session_token", actor.bearer if actor else ""),
        ):
            cursor.execute("SELECT set_config(%s,%s,true)", [name, value])


def live_platform_admin():
    if _actor.get() is None:
        return False
    with connections["ue_framework_request"].cursor() as cursor:
        cursor.execute("SELECT user_management.ue_framework_admin_authorized()")
        return cursor.fetchone()[0] is True


class CanonicalPlatformMetadataPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return live_platform_admin() if settings.UE_CANONICAL_BOOTSTRAP_V2 else True


class CanonicalFrameworkBackend(BaseBackend):
    def has_perm(self, user_obj, perm, obj=None):
        return user_obj.is_active and live_platform_admin()

    def has_module_perms(self, user_obj, app_label):
        return user_obj.is_active and live_platform_admin()


class CanonicalRequestAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return "Bearer"

    def authenticate(self, request):
        actor = getattr(request, "_ue_canonical_actor", None)
        if actor is None:
            return None
        return request._request.user, {
            "authority": "canonical-v2",
            "user_id": actor.user_id,
        }


def canonical_exception_handler(exc, context):
    from rest_framework.views import exception_handler
    from rest_framework.response import Response

    if (
        isinstance(exc, DatabaseError)
        and getattr(exc.__cause__, "pgcode", None) == "42501"
    ):
        return Response({"detail": "Canonical execution authority denied"}, status=403)
    return exception_handler(exc, context)


class CanonicalDatabaseRouter:
    def db_for_read(self, model, **hints):
        if (
            model._meta.app_label in FRAMEWORK_APPS
            or model._meta.db_table in PLATFORM_METADATA_TABLES
        ):
            if (
                model._meta.app_label.startswith("django_celery_")
                and settings.UE_V2_PROCESS_CONTEXT == "worker"
            ):
                return "ue_framework_worker"
            return "ue_framework_request"
        return "default"

    db_for_write = db_for_read

    def allow_relation(self, obj1, obj2, **hints):
        return self.db_for_read(type(obj1)) == self.db_for_read(type(obj2))

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return False


class CanonicalContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        actor = None
        primary = None
        try:
            authorization = request.META.get("HTTP_AUTHORIZATION", "")
            if authorization:
                if (
                    not authorization.startswith("Bearer ")
                    or not authorization[7:].strip()
                ):
                    raise AuthenticationFailed("Bearer authentication required")
                actor = resolve_actor(
                    authorization[7:],
                    request.META.get("HTTP_X_ORGANIZATION_ID"),
                )
            token = _actor.set(actor)
            try:
                with ExitStack() as stack:
                    for alias in ("default", "ue_framework_request"):
                        stack.enter_context(transaction.atomic(using=alias))
                    bind_connection("default", "union_eyes_runtime", actor)
                    bind_connection(
                        "ue_framework_request",
                        (
                            "ue_framework_admin"
                            if actor and actor.platform_admin
                            else "ue_framework_identity"
                        ),
                        actor,
                    )
                    if actor:
                        User = get_user_model()
                        user, _ = User.objects.get_or_create(
                            username="uev2_"
                            + sha256(actor.user_id.encode()).hexdigest(),
                            defaults={
                                "password": "!",
                                "email": actor.email,
                                "is_active": True,
                                "is_staff": actor.platform_admin,
                                "is_superuser": False,
                            },
                        )
                        user.email = actor.email
                        user.is_staff = actor.platform_admin
                        if not user.is_active:
                            raise AuthenticationFailed(
                                "Active framework metadata required"
                            )
                        if user.is_superuser:
                            raise AuthenticationFailed(
                                "Framework superuser flags are not canonical authority"
                            )
                        user.save(update_fields=["email", "is_staff"])
                        request.user = (
                            user
                            if request.path.startswith("/admin/")
                            else CanonicalPrincipal(actor, user)
                        )
                    else:
                        request.user = AnonymousUser()
                    request._ue_canonical_actor = actor
                    request.user_id = actor.user_id if actor else None
                    request.org_id = actor.organization_id if actor else None
                    request.org_role = actor.organization_role if actor else None
                    request.organization_id = request.org_id
                    request.organization = None
                    response = self.get_response(request)
                    if response.streaming:
                        raise RuntimeError(
                            "Streaming responses require a separate canonical V2 execution boundary"
                        )
                    if response.status_code >= 400:
                        for alias in ("default", "ue_framework_request"):
                            transaction.set_rollback(True, using=alias)
                    return response
            finally:
                _actor.reset(token)
        except AuthenticationFailed as exc:
            return JsonResponse(
                {"detail": str(exc.detail)},
                status=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
        except BaseException as exc:
            primary = exc
            raise
        finally:
            if actor and actor.bridge:
                try:
                    revoke_bridge(actor)
                except BaseException as cleanup_error:
                    if primary is not None:
                        raise BaseExceptionGroup(
                            "Canonical application and bridge cleanup failed",
                            [
                                primary,
                                cleanup_error,
                            ],
                        ) from primary
                    raise
