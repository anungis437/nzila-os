"""The Django settings refuse what the environment registry says they refuse (UE-CONV-H-024).

DJANGO_DEBUG is a developer's mode: it is refused while DJANGO_ALLOWED_HOSTS names a non-local host. A serving process (gunicorn, celery) that is not a
developer's machine refuses to start without a real DJANGO_SECRET_KEY, REQUEST_SIGNING_SECRET and WEBHOOK_DEFAULT_SECRET. The rules live in
``config/hardening.py``; the last tests run the real ``config.settings`` in a fresh interpreter, because a rule nobody calls proves nothing.
"""
import os
import subprocess
import sys
import unittest
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from config import hardening

BACKEND = Path(__file__).resolve().parent.parent

REAL_KEY = "k" * 20 + "7" * 20 + "q" * 20
REAL_SIGNING = "s" * 16 + "3" * 16 + "m" * 8
REAL_WEBHOOK = "w" * 16 + "9" * 16 + "n" * 8


class ServingProcessTests(unittest.TestCase):
    def test_gunicorn_celery_and_asgi_servers_serve(self):
        for argv in (
            ["/usr/local/bin/gunicorn"],
            ["/usr/local/bin/celery", "-A", "config", "worker"],
            ["celery", "-A", "config", "beat"],
            ["C:\\Python\\Scripts\\gunicorn.exe"],
            ["C:\\Python\\Scripts\\celery.exe", "-A", "config", "worker"],
            ["C:\\Python\\Lib\\site-packages\\gunicorn\\__main__.py"],
            ["/usr/lib/python3/site-packages/gunicorn/__main__.py"],
            ["/usr/local/bin/uvicorn"],
            ["/usr/local/bin/daphne"],
        ):
            self.assertTrue(hardening.is_serving_process(argv), argv)

    def test_management_commands_tests_and_scripts_do_not(self):
        for argv in (["manage.py", "migrate"], ["manage.py", "collectstatic"], ["manage.py", "test"], ["-c"], ["/usr/bin/pytest"], ["python"], [], [""]):
            self.assertFalse(hardening.is_serving_process(argv), argv)


class DebugTests(unittest.TestCase):
    def test_debug_is_refused_while_a_non_local_host_is_allowed(self):
        for hosts in (["app.unioneyes.app"], ["localhost", "staging-app.unioneyes.app"], ["*"], ["10.0.0.4"]):
            with self.assertRaises(ImproperlyConfigured) as raised:
                hardening.check_debug(True, hosts)
            self.assertIn("DJANGO_DEBUG", str(raised.exception))

    def test_debug_is_fine_on_local_hosts_and_a_real_host_is_fine_without_debug(self):
        hardening.check_debug(True, ["localhost", "127.0.0.1", "[::1]", "testserver", "api.localhost", " localhost "])
        hardening.check_debug(False, ["app.unioneyes.app", "*"])
        hardening.check_debug(True, [""])


class SecretTests(unittest.TestCase):
    def resolve(self, values, serving, debug):
        return hardening.resolve_secrets(
            values.get("DJANGO_SECRET_KEY"), values.get("REQUEST_SIGNING_SECRET"), values.get("WEBHOOK_DEFAULT_SECRET"), serving=serving, debug=debug
        )

    def test_a_serving_process_without_secrets_refuses_to_start_and_names_every_one(self):
        with self.assertRaises(ImproperlyConfigured) as raised:
            self.resolve({}, serving=True, debug=False)
        message = str(raised.exception)
        for name in ("DJANGO_SECRET_KEY", "REQUEST_SIGNING_SECRET", "WEBHOOK_DEFAULT_SECRET"):
            self.assertIn(name, message)

    def test_a_serving_process_refuses_short_and_placeholder_secrets(self):
        for key in ("short", "django-insecure-" + "x" * 60, "change-me-in-production-" + "a" * 40, "your-secret-key-here" + "b" * 40):
            with self.assertRaises(ImproperlyConfigured, msg=key):
                self.resolve({"DJANGO_SECRET_KEY": key, "REQUEST_SIGNING_SECRET": REAL_SIGNING, "WEBHOOK_DEFAULT_SECRET": REAL_WEBHOOK}, serving=True, debug=False)
        with self.assertRaises(ImproperlyConfigured):
            self.resolve({"DJANGO_SECRET_KEY": REAL_KEY, "REQUEST_SIGNING_SECRET": "too-short", "WEBHOOK_DEFAULT_SECRET": REAL_WEBHOOK}, serving=True, debug=False)

    def test_the_signing_secrets_are_their_own_values_never_the_secret_key(self):
        for name in ("REQUEST_SIGNING_SECRET", "WEBHOOK_DEFAULT_SECRET"):
            values = {"DJANGO_SECRET_KEY": REAL_KEY, "REQUEST_SIGNING_SECRET": REAL_SIGNING, "WEBHOOK_DEFAULT_SECRET": REAL_WEBHOOK}
            values[name] = REAL_KEY
            with self.assertRaises(ImproperlyConfigured) as raised:
                self.resolve(values, serving=True, debug=False)
            self.assertIn("its own value", str(raised.exception))

    def test_a_serving_process_with_real_secrets_starts_with_exactly_those(self):
        values = {"DJANGO_SECRET_KEY": REAL_KEY, "REQUEST_SIGNING_SECRET": REAL_SIGNING, "WEBHOOK_DEFAULT_SECRET": REAL_WEBHOOK}
        self.assertEqual(self.resolve(values, serving=True, debug=False), (REAL_KEY, REAL_SIGNING, REAL_WEBHOOK))

    def test_a_developer_machine_and_a_management_command_keep_the_development_defaults(self):
        for serving, debug in ((False, False), (False, True), (True, True)):
            key, signing, webhook = self.resolve({}, serving=serving, debug=debug)
            self.assertEqual(key, hardening.DEVELOPMENT_SECRET)
            self.assertEqual((signing, webhook), (key, key))
        key, signing, webhook = self.resolve({"DJANGO_SECRET_KEY": "ci-django-suite-only"}, serving=False, debug=False)
        self.assertEqual((key, signing, webhook), ("ci-django-suite-only",) * 3)


class SettingsModuleTests(unittest.TestCase):
    """The rules are wired into config.settings: it is imported in a fresh interpreter, as a serving process would."""

    def run_settings(self, argv0, **env):
        child = {name: value for name, value in os.environ.items() if not name.startswith(("DJANGO_", "REQUEST_SIGNING", "WEBHOOK_DEFAULT", "UE_CANONICAL"))}
        child.update(env)
        code = "import sys; sys.argv = [%r]; import config.settings as s; print(s.DEBUG, s.SERVING_PROCESS)" % argv0
        return subprocess.run([sys.executable, "-c", code], cwd=str(BACKEND), env=child, capture_output=True, text=True, timeout=120)

    def test_a_gunicorn_process_without_secrets_does_not_start(self):
        result = self.run_settings("/usr/local/bin/gunicorn", DJANGO_DEBUG="False")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ImproperlyConfigured", result.stderr)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_a_gunicorn_process_with_real_secrets_starts(self):
        result = self.run_settings(
            "/usr/local/bin/gunicorn",
            DJANGO_DEBUG="False",
            DJANGO_SECRET_KEY=REAL_KEY,
            REQUEST_SIGNING_SECRET=REAL_SIGNING,
            WEBHOOK_DEFAULT_SECRET=REAL_WEBHOOK,
            DJANGO_ALLOWED_HOSTS="app.unioneyes.app",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "False True")

    def test_debug_mode_on_a_real_host_does_not_start_even_for_a_management_command(self):
        result = self.run_settings("manage.py", DJANGO_DEBUG="True", DJANGO_ALLOWED_HOSTS="app.unioneyes.app")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_DEBUG", result.stderr)

    def test_a_management_command_imports_with_nothing_set(self):
        result = self.run_settings("manage.py", DJANGO_DEBUG="False")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "False False")


if __name__ == "__main__":
    unittest.main()
