"""
Management command: verify pilot_applications has every column the current
pilot control plane requires.

Usage:
    python manage.py check_pilot_schema

Exit code 0 if all required columns exist on pilot_applications; exit code 1
with a clear message (naming the specific migration(s) to apply) otherwise.

Deliberately narrow — this checks exactly the columns added by the two
migrations below, not general schema drift. That makes it safe to run as a
preflight step in ANY environment (including one with unrelated,
pre-existing pending migrations that are out of scope for this check, e.g.
the documents -> ue_documents rename found during round 20 validation)
without false-failing on drift this command was never meant to catch.

Context (PR #752 round 21): the demo deployment profile
(.github/workflows/deploy-union-eyes.yml) sets DJANGO_SKIP_MIGRATIONS=true,
so `manage.py migrate` never runs there on an ordinary deploy. If a demo
environment ever serves the pilot application workstream
(app/api/pilot/apply/**), every read of pilot_applications would fail with a
raw "column does not exist" error until the relevant migration has been
applied there through some other means. Run this command against the demo
database BEFORE enabling that traffic path, to fail loudly and safely ahead
of time instead of learning about it from a live 500.

Round 26 correction: round 25 added 5 new columns (commercial-terms
approval) live in code but never updated this preflight to match — a demo
database could pass this check while every commercial-transition call to a
financial-artifact-creating state still 500s on "column does not exist".
This command now checks the FULL current set across both migrations.
"""
from django.core.management.base import BaseCommand
from django.db import connection

# Maps each required column to the migration that introduces it, so a
# failure message can name the exact migration(s) still needed — not just
# "something is missing" — even when multiple migrations are involved.
COLUMN_MIGRATIONS = {
    "verified_organization_id": "0002_pilotapplications_verified_organization",
    "verified_by": "0002_pilotapplications_verified_organization",
    "verified_at": "0002_pilotapplications_verified_organization",
    "verified_member_count": "0003_pilotapplications_commercial_terms",
    "verified_pilot_amount": "0003_pilotapplications_commercial_terms",
    "verified_subscription_plan_id": "0003_pilotapplications_commercial_terms",
    "commercial_terms_approved_by": "0003_pilotapplications_commercial_terms",
    "commercial_terms_approved_at": "0003_pilotapplications_commercial_terms",
}

REQUIRED_COLUMNS = tuple(COLUMN_MIGRATIONS.keys())


class Command(BaseCommand):
    help = (
        "Verifies pilot_applications has every column the current pilot "
        "control plane requires (verified-organization + commercial-terms "
        "approval columns). Exits non-zero if any are missing."
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
            missing_migrations = sorted({COLUMN_MIGRATIONS[c] for c in missing})
            self.stderr.write(
                self.style.ERROR(
                    "pilot_applications is missing required column(s): "
                    f"{', '.join(missing)}. Apply migration(s) "
                    f"{', '.join(missing_migrations)} before serving pilot "
                    "application traffic against this database (see "
                    "backend/content/migrations/)."
                )
            )
            raise SystemExit(1)

        self.stdout.write(
            self.style.SUCCESS(
                "pilot_applications has all required columns "
                "(verified-organization + commercial-terms approval)."
            )
        )
