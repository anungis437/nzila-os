# Generated for PR #752 round 32: rename Clerk-specific naming to
# provider-agnostic naming (auth_core is moving to a generic AUTH_*
# settings convention — see config/settings.py's AUTH_JWKS_URL/AUTH_SECRET
# with CLERK_* kept only as legacy env-var fallbacks). This is a metadata
# rename only (RenameField -> ALTER TABLE ... RENAME COLUMN in Postgres);
# no data is rewritten, no constraint is dropped/recreated.
#
# NOT renamed: UserUuidMapping.clerk_user_id (auth_core/models.py) — that
# table is the explicit Clerk-era-id-to-platform-UUID migration bridge
# (db_table="user_uuid_mapping", "Migrated from drizzle: uuid-mapping.ts"),
# matching the same "uuid-mapping"/"user-uuid-" adapter exemption already
# codified in tooling/contract-tests/auth-purity.test.ts for the
# TypeScript side of this exact bridge concept. Renaming its historical id
# column would defeat the table's own purpose.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('auth_core', '0002_add_clerk_organization_id'),
    ]

    operations = [
        migrations.RenameField(
            model_name='organizations',
            old_name='clerk_organization_id',
            new_name='auth_provider_org_id',
        ),
    ]
