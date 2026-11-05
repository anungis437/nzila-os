"""Model fields for PostgreSQL column types Django has no field for."""
from django.contrib.postgres.fields import ArrayField
from django.db import models
from rest_framework import serializers


class UnboundedDecimalField(models.DecimalField):
    """``numeric`` without a declared precision or scale.

    ``DecimalField`` insists on ``max_digits`` and ``decimal_places``; a column the schema leaves unbounded has
    neither, and inventing them would quantize every write. Without them Django applies no precision limit of its own.
    """

    def __init__(self, *args, **kwargs):
        kwargs["max_digits"] = None
        kwargs["decimal_places"] = None
        super().__init__(*args, **kwargs)

    def check(self, **kwargs):
        unbounded_is_intended = {"fields.E130", "fields.E132"}
        return [error for error in super().check(**kwargs) if error.id not in unbounded_is_intended]

    def db_type(self, connection):
        return "numeric"


class UnboundedDecimalSerializerField(serializers.DecimalField):
    """The serializer field for ``UnboundedDecimalField``: DRF's ``DecimalField`` needs the two arguments, ``None`` for none."""

    def __init__(self, max_digits=None, decimal_places=None, **kwargs):
        super().__init__(max_digits, decimal_places, **kwargs)


serializers.ModelSerializer.serializer_field_mapping[UnboundedDecimalField] = UnboundedDecimalSerializerField


class EnumArrayField(ArrayField):
    """An array of a PostgreSQL enum type (``enum_type[]``).

    psycopg2 sends a Python list as ``text[]`` and returns an enum array as its text form; PostgreSQL will neither
    store the first in the column nor compare it with it. The value is cast to the enum array on the way in and to
    ``text[]`` on the way out, so the field behaves like any other array of strings.
    """

    def __init__(self, base_field, enum_type, **kwargs):
        self.enum_type = enum_type
        super().__init__(base_field, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        kwargs["enum_type"] = self.enum_type
        return name, path, args, kwargs

    def db_type(self, connection):
        return f"{self.enum_type}[]"

    def cast_db_type(self, connection):
        return self.db_type(connection)

    def get_placeholder(self, value, compiler, connection):
        return f"%s::{self.enum_type}[]"

    def select_format(self, compiler, sql, params):
        return f"{sql}::text[]", params
