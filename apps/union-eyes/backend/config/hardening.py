"""What a Django process may run with, by what it is (UE-CONV-H-024).

The environment registry (``apps/union-eyes/lib/config/env-registry.ts``) says what each variable means when it is absent. These are the rules that make
the Django entries true, kept apart from ``settings.py`` so they can be tested without importing the settings of a running process:

* A *serving* process (gunicorn, celery or an ASGI server) takes traffic or runs jobs. Unless it is a developer's machine (debug mode, on local hosts only),
  it refuses to start without a real ``DJANGO_SECRET_KEY`` (at least 50 characters, not a placeholder) and its own ``REQUEST_SIGNING_SECRET`` and
  ``WEBHOOK_DEFAULT_SECRET`` (at least 32 characters each, not placeholders, and neither is the secret key): a signing secret that is the public default,
  or the secret key itself, is a signature anyone can forge.
* Debug mode is a developer's mode: it is refused while ``ALLOWED_HOSTS`` names a host that is not local.
* ``manage.py`` commands (migrate, collectstatic, test, shell, runserver) are not serving processes and keep their development defaults.
"""
import os
import ntpath

from django.core.exceptions import ImproperlyConfigured

SERVING_COMMANDS = frozenset({"gunicorn", "celery", "uvicorn", "daphne", "hypercorn"})

LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "[::1]", "::1", "testserver"})

PLACEHOLDER_MARKERS = ("change-me", "changeme", "insecure", "placeholder", "replace-me", "your-secret", "example", "dummy")

DEVELOPMENT_SECRET = "django-insecure-development-only-never-used-by-a-serving-process"


def is_serving_process(argv):
    """True for gunicorn, celery and the ASGI servers, however they were started (``gunicorn``, ``python -m gunicorn``, ``gunicorn.exe``)."""
    if not argv or not argv[0]:
        return False
    path = os.path.normpath(argv[0])
    name = ntpath.basename(path).lower()
    if name.startswith("__main__"):
        name = ntpath.basename(ntpath.dirname(path)).lower()
    for suffix in (".exe", ".py"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    return name in SERVING_COMMANDS


def is_local_host(host):
    host = host.strip().lower()
    return host in LOCAL_HOSTS or host.endswith(".localhost")


def is_placeholder(value):
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def check_debug(debug, allowed_hosts):
    """Debug mode on a host that is not local is a deployment with its error pages open."""
    if not debug:
        return
    real = sorted({host.strip() for host in allowed_hosts if host.strip() and not is_local_host(host)})
    if real:
        raise ImproperlyConfigured(
            "DJANGO_DEBUG is a developer's mode and is refused while DJANGO_ALLOWED_HOSTS names a non-local host (" + ", ".join(real) + ")"
        )


def requires_real_secrets(serving, debug):
    return serving and not debug


def _problem(value, minimum):
    if not value:
        return "is not set"
    if len(value) < minimum:
        return "must be at least %d characters" % minimum
    if is_placeholder(value):
        return "is a placeholder"
    return None


def resolve_secrets(secret_key, request_signing, webhook_default, serving, debug):
    """The secret key, the request-signing secret and the default webhook secret, as ``(secret_key, request_signing, webhook_default)``.

    Each argument is the value of DJANGO_SECRET_KEY, REQUEST_SIGNING_SECRET and WEBHOOK_DEFAULT_SECRET (None or empty when unset), read by ``settings.py``.
    A process that must have real secrets raises ``ImproperlyConfigured`` naming every one that is missing or weak. Any other process keeps what it was given
    and otherwise a development default, with the two signing secrets falling back to the secret key.
    """
    configured = {
        "DJANGO_SECRET_KEY": (secret_key or "").strip(),
        "REQUEST_SIGNING_SECRET": (request_signing or "").strip(),
        "WEBHOOK_DEFAULT_SECRET": (webhook_default or "").strip(),
    }
    if requires_real_secrets(serving, debug):
        minimums = {"DJANGO_SECRET_KEY": 50, "REQUEST_SIGNING_SECRET": 32, "WEBHOOK_DEFAULT_SECRET": 32}
        problems = []
        for name, minimum in minimums.items():
            problem = _problem(configured[name], minimum)
            if problem is None and name != "DJANGO_SECRET_KEY" and configured[name] == configured["DJANGO_SECRET_KEY"]:
                problem = "must be its own value, not DJANGO_SECRET_KEY"
            if problem:
                problems.append("%s %s" % (name, problem))
        if problems:
            raise ImproperlyConfigured(
                "A serving process (gunicorn, celery) refuses to start without real secrets: " + "; ".join(problems)
            )
    secret_key = configured["DJANGO_SECRET_KEY"] or DEVELOPMENT_SECRET
    return secret_key, configured["REQUEST_SIGNING_SECRET"] or secret_key, configured["WEBHOOK_DEFAULT_SECRET"] or secret_key
