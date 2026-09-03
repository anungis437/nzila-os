"""
Management command: verify pilot_applications has the round-21 columns.

Usage:
    python manage.py check_pilot_schema

Exit code 0 if verified_organization_id / verified_by / verified_at columns
exist on pilot_applications; exit code 1 with a clear message otherwise.

Deliberately narrow — this checks exactly the 3 columns added by migration
0002_pilotapplications_verified_organization, not general schema drift. That
makes it safe to run as a preflight step in ANY environment (including one
with unrelated, pre-existing pending migrations that are out of scope for
this check, e.g. the documents -> ue_documents rename found during round 20
validation) without false-failing on drift this command was never meant to
catch.

Context (PR #752 round 21): the demo deployment profile
(.github/workflows/deploy-union-eyes.yml) sets DJANGO_SKIP_MIGRATIONS=true,
so `manage.py migrate` never runs there on an ordinary deploy. If a demo
environment ever serves the pilot application workstream
(app/api/pilot/apply/**), every read of pilot_applications would fail with a
raw "column does not exist" error until this migration has been applied
there through some other means. Run this command against the demo database
BEFORE enabling that traffic path, to fail loudly and safely ahead of time
instead of learning about it from a live 500.
"""
from django.core.management.base import BaseCommand
from django.db import connection

REQUIRED_COLUMNS = ("verified_organization_id", "verified_by", "verified_at")


class Command(BaseCommand):
    help = (
        "Verifies pilot_applications has the round-21 verified-organization "
        "columns (verified_organization_id, verified_by, verified_at). "
        "Exits non-zero if any are missing."
    )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'pilot_applications'
                """
            )
            existing = {row[0] for row in cursor.fetchall()}

        missing = [c for c in REQUIRED_COLUMNS if c not in existing]

        if missing:
            self.stderr.write(
                self.style.ERROR(
                    "pilot_applications is missing required column(s): "
                    f"{', '.join(missing)}. Apply migration "
                    "0002_pilotapplications_verified_organization before "
                    "serving pilot application traffic against this database "
                    "(see backend/content/migrations/0002_pilotapplications_"
                    "verified_organization.py)."
                )
            )
            raise SystemExit(1)

        self.stdout.write(
            self.style.SUCCESS(
                "pilot_applications has all round-21 verified-organization columns."
            )
        )
