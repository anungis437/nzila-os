from rest_framework import serializers

from .models import OrganizationMembers, Organizations


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organizations
        fields = ["id", "name", "display_name", "clerk_organization_id"]
        read_only_fields = fields


class OrganizationMemberSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = OrganizationMembers
        fields = [
            "id",
            "user_id",
            "organization",
            "role",
            "status",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
