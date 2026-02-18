#!/usr/bin/env python3
"""
Code Generator — Auto-generates Django models, serializers, views, and URLs
from legacy source schemas (Supabase SQL and Drizzle ORM TypeScript).

Supports:
- Supabase SQL → Django models (ABR Insights)
- Drizzle ORM TypeScript → Django models (Union Eyes)
- Auto-generated DRF serializers from models
- Auto-generated DRF viewsets from models
- Auto-generated URL patterns from viewsets
- Admin registrations
- Factory/fixture generation for testing
"""

import json
import re
import textwrap
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime

try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from logging_config import MigrationLogger
    logger = MigrationLogger.get_logger(__name__)
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Data Classes
# ──────────────────────────────────────────────

@dataclass
class ColumnDef:
    """Parsed column definition"""
    name: str
    django_name: str  # snake_case
    source_type: str
    django_field: str
    django_kwargs: Dict[str, Any] = field(default_factory=dict)
    is_primary_key: bool = False
    is_foreign_key: bool = False
    fk_table: Optional[str] = None
    fk_column: Optional[str] = None
    fk_on_delete: str = "CASCADE"
    is_unique: bool = False
    is_nullable: bool = True
    default_value: Optional[str] = None
    choices: Optional[List[str]] = None
    is_array: bool = False
    array_base_type: Optional[str] = None

    def to_django_field_str(self, model_registry: Optional[Dict[str, str]] = None, 
                           current_app: Optional[str] = None) -> str:
        """Generate Django field definition string"""
        # Note: primary_key=True UUID fields are no longer emitted here;
        # BaseModel provides the canonical id field. Non-id PKs are
        # converted to unique fields in TableDef.to_django_model_str().
        if self.is_primary_key and "uuid" in self.source_type.lower():
            return "models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)"

        if self.is_foreign_key and self.fk_table:
            on_delete_map = {
                "CASCADE": "models.CASCADE",
                "SET NULL": "models.SET_NULL",
                "SET DEFAULT": "models.SET_DEFAULT",
                "RESTRICT": "models.RESTRICT",
                "NO ACTION": "models.DO_NOTHING",
            }
            on_delete = on_delete_map.get(self.fk_on_delete.upper(), "models.CASCADE")
            fk_model = _table_to_model_name(self.fk_table)
            
            # Determine if we need app-qualified reference
            fk_reference = fk_model
            if model_registry and current_app:
                fk_app = model_registry.get(fk_model)
                if fk_app and fk_app != current_app:
                    # Cross-app reference - use app-qualified format
                    fk_reference = f"{fk_app}.{fk_model}"
            
            related = self.django_name.replace("_id", "").replace("_", "") + "s"
            kwargs = [f"'{fk_reference}'", f"on_delete={on_delete}"]
            kwargs.append(f"related_name='{related}'")
            if self.is_nullable:
                kwargs.append("null=True")
                kwargs.append("blank=True")
            # Strip _id suffix for Django FK field names
            return f"models.ForeignKey({', '.join(kwargs)})"

        kwargs_parts = []

        # Handle choices (enums)
        if self.choices:
            choices_name = self.django_name.upper() + "_CHOICES"
            kwargs_parts.append(f"choices={choices_name}")

        # Common kwargs
        for k, v in self.django_kwargs.items():
            if isinstance(v, str):
                kwargs_parts.append(f"{k}='{v}'")
            elif isinstance(v, bool):
                kwargs_parts.append(f"{k}={v}")
            elif isinstance(v, type):
                # Render type objects by name (dict → dict, list → list)
                kwargs_parts.append(f"{k}={v.__name__}")
            elif callable(v):
                kwargs_parts.append(f"{k}={getattr(v, '__name__', repr(v))}")
            else:
                kwargs_parts.append(f"{k}={v}")

        if self.is_nullable and "null" not in self.django_kwargs:
            if self.django_field not in ("BooleanField",):
                kwargs_parts.append("null=True")
                kwargs_parts.append("blank=True")

        if self.default_value is not None and "default" not in self.django_kwargs:
            kwargs_parts.append(f"default={self.default_value}")

        if self.is_unique and "unique" not in self.django_kwargs:
            kwargs_parts.append("unique=True")

        kwargs_str = ", ".join(kwargs_parts)
        return f"models.{self.django_field}({kwargs_str})"


@dataclass
class TableDef:
    """Parsed table definition"""
    name: str
    django_model_name: str
    django_app: str
    columns: List[ColumnDef] = field(default_factory=list)
    unique_constraints: List[List[str]] = field(default_factory=list)
    indexes: List[Dict[str, Any]] = field(default_factory=list)
    source_type: str = "sql"  # "sql" or "drizzle"
    source_file: str = ""
    domain: str = ""

    def to_django_model_str(self, model_registry: Optional[Dict[str, str]] = None) -> str:
        """Generate Django model class string"""
        lines = []
        # Choices constants
        for col in self.columns:
            if col.choices:
                choices_name = col.django_name.upper() + "_CHOICES"
                choices_tuples = ", ".join(
                    [f"('{c}', '{c.replace('_', ' ').title()}')" for c in col.choices]
                )
                lines.append(f"    {choices_name} = [{choices_tuples}]")
        if any(c.choices for c in self.columns):
            lines.append("")

        # Fields
        has_org_fk = False

        for col in self.columns:
            if col.is_foreign_key and col.fk_table in ("organizations",):
                has_org_fk = True

        # Determine base class — always use BaseModel (provides id, created_at, updated_at)
        if has_org_fk:
            base_class = "OrganizationModel"
        else:
            base_class = "BaseModel"

        # Skip fields handled by base class
        skip_fields = {"id", "created_at", "updated_at"}
        if base_class == "OrganizationModel":
            skip_fields.add("organization_id")

        # Convert non-id primary key fields to unique fields (BaseModel provides the real PK)
        for col in self.columns:
            if col.is_primary_key and col.django_name != "id":
                col.is_primary_key = False
                col.is_unique = True

        header = f"class {self.django_model_name}({base_class}):"
        docstring = f'    """Migrated from {self.source_type}: {self.source_file}"""'

        result = [header, docstring]
        if lines:
            result.extend(lines)

        field_lines = []
        for col in self.columns:
            if col.django_name in skip_fields:
                continue
            # Sanitize reserved word field names
            field_name = _sanitize_field_name(col.django_name)
            # For FK fields, Django adds _id automatically
            if col.is_foreign_key:
                field_name = field_name.replace("_id", "") if field_name.endswith("_id") else field_name
            field_str = col.to_django_field_str(model_registry=model_registry, 
                                                current_app=self.django_app)
            field_lines.append(f"    {field_name} = {field_str}")

        if field_lines:
            result.extend(field_lines)
        else:
            result.append("    pass")

        # Meta class
        meta_lines = ["", "    class Meta:"]
        meta_lines.append(f"        db_table = '{self.name}'")
        meta_lines.append(f"        verbose_name = '{self.django_model_name}'")
        if self.unique_constraints:
            constraints = []
            for i, uc in enumerate(self.unique_constraints):
                fields_str = ", ".join([f"'{f}'" for f in uc])
                uc_suffix = "_".join(uc)
                constraint_name = _truncate_index_name(f'unique_{self.name}_{uc_suffix}')
                constraints.append(
                    f"            models.UniqueConstraint(fields=[{fields_str}], "
                    f"name='{constraint_name}')"
                )
            if constraints:
                meta_lines.append("        constraints = [")
                meta_lines.extend([c + "," for c in constraints])
                meta_lines.append("        ]")
        # BaseModel always provides created_at
        meta_lines.append("        ordering = ['-created_at']")

        result.extend(meta_lines)

        # __str__
        str_field = None
        for candidate in ("name", "title", "slug", "email", "claim_number",
                          "grievance_number", "cba_number"):
            if any(c.django_name == candidate for c in self.columns):
                str_field = candidate
                break
        if str_field:
            result.append("")
            result.append(f"    def __str__(self):")
            result.append(f"        return str(self.{str_field})")

        return "\n".join(result)


@dataclass
class GenerationResult:
    """Result of code generation"""
    app_name: str
    models_code: str
    serializers_code: str
    views_code: str
    urls_code: str
    admin_code: str
    tests_code: str
    model_count: int
    field_count: int
    source_tables: List[str]


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _table_to_model_name(table_name: str) -> str:
    """Convert snake_case table name to PascalCase model name"""
    return "".join(word.capitalize() for word in table_name.split("_"))


def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case"""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


# Python reserved words and builtins that cannot be used as field names
_PYTHON_RESERVED_WORDS = {
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield',
}


def _sanitize_field_name(name: str) -> str:
    """Sanitize field name: append _field suffix if it's a Python reserved word."""
    if name in _PYTHON_RESERVED_WORDS:
        return f"{name}_field"
    return name


def _truncate_index_name(name: str, max_length: int = 30) -> str:
    """Truncate index/constraint name to max_length chars for database compatibility."""
    if len(name) <= max_length:
        return name
    # Try abbreviating common words first
    abbreviations = {
        'organization': 'org', 'organizations': 'orgs',
        'hierarchy': 'hier', 'level': 'lvl',
        'unique': 'uniq', 'index': 'idx',
        'created': 'crt', 'updated': 'upd',
        'status': 'stat', 'type': 'typ',
    }
    result = name
    for full, abbr in abbreviations.items():
        if len(result) <= max_length:
            break
        result = result.replace(full, abbr)
    if len(result) > max_length:
        result = result[:max_length]
    return result


# ──────────────────────────────────────────────
# SQL Parser (Supabase / raw PostgreSQL)
# ──────────────────────────────────────────────

class SQLSchemaParser:
    """Parses Supabase SQL CREATE TABLE statements into TableDef objects"""

    # Type mappings: SQL → (django_field, extra_kwargs)
    TYPE_MAP = {
        "uuid": ("UUIDField", {}),
        "text": ("TextField", {}),
        "varchar": ("CharField", {}),
        "integer": ("IntegerField", {}),
        "int": ("IntegerField", {}),
        "bigint": ("BigIntegerField", {}),
        "smallint": ("SmallIntegerField", {}),
        "boolean": ("BooleanField", {"default": False}),
        "bool": ("BooleanField", {"default": False}),
        "numeric": ("DecimalField", {}),
        "decimal": ("DecimalField", {}),
        "real": ("FloatField", {}),
        "double precision": ("FloatField", {}),
        "float": ("FloatField", {}),
        "date": ("DateField", {}),
        "time": ("TimeField", {}),
        "timestamp": ("DateTimeField", {}),
        "timestamptz": ("DateTimeField", {}),
        "jsonb": ("JSONField", {"default": dict}),
        "json": ("JSONField", {"default": dict}),
        "inet": ("GenericIPAddressField", {}),
        "tsvector": ("SearchVectorField", {}),
    }

    @classmethod
    def parse_sql_file(cls, sql_content: str, source_file: str = "",
                       app_name: str = "core") -> List[TableDef]:
        """Parse SQL CREATE TABLE statements from file content"""
        tables = []
        # Find CREATE TABLE blocks
        pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\);'
        matches = re.findall(pattern, sql_content, re.DOTALL | re.IGNORECASE)

        for table_name, body in matches:
            table_def = cls._parse_table(table_name, body, source_file, app_name)
            if table_def:
                tables.append(table_def)

        return tables

    @classmethod
    def _parse_table(cls, table_name: str, body: str, source_file: str,
                     app_name: str) -> Optional[TableDef]:
        """Parse a single CREATE TABLE body"""
        model_name = _table_to_model_name(table_name)
        table = TableDef(
            name=table_name,
            django_model_name=model_name,
            django_app=app_name,
            source_type="sql",
            source_file=source_file,
        )

        # Split into lines, handling nested parentheses
        lines = cls._split_column_defs(body)

        for line in lines:
            line = line.strip().rstrip(",")
            if not line:
                continue

            # Skip constraint-only lines
            upper = line.upper().strip()
            if upper.startswith("CONSTRAINT"):
                continue

            # Handle UNIQUE constraints
            unique_match = re.match(r'UNIQUE\s*\((.+?)\)', line, re.IGNORECASE)
            if unique_match:
                fields = [f.strip().strip('"') for f in unique_match.group(1).split(",")]
                table.unique_constraints.append(fields)
                continue

            # Handle CHECK constraints (skip standalone)
            if upper.startswith("CHECK"):
                continue

            # Parse column
            col = cls._parse_column(line, table_name)
            if col:
                table.columns.append(col)

        return table if table.columns else None

    @classmethod
    def _split_column_defs(cls, body: str) -> List[str]:
        """Split column definitions handling nested parens and GENERATED expressions"""
        result = []
        current = []
        depth = 0

        for char in body:
            if char == '(':
                depth += 1
                current.append(char)
            elif char == ')':
                depth -= 1
                current.append(char)
            elif char == ',' and depth == 0:
                result.append("".join(current).strip())
                current = []
            else:
                current.append(char)

        remaining = "".join(current).strip()
        if remaining:
            result.append(remaining)

        return result

    @classmethod
    def _parse_column(cls, line: str, table_name: str) -> Optional[ColumnDef]:
        """Parse a single column definition line"""
        # Match: column_name TYPE [constraints...]
        col_match = re.match(
            r'(\w+)\s+([\w\s]+(?:\([^)]*\))?)\s*(.*)',
            line.strip(),
            re.IGNORECASE
        )
        if not col_match:
            return None

        col_name = col_match.group(1).strip().strip('"')
        raw_type = col_match.group(2).strip()
        constraints = col_match.group(3).strip()

        # Skip generated columns (tsvector)
        if "GENERATED ALWAYS" in constraints.upper():
            return ColumnDef(
                name=col_name,
                django_name=_camel_to_snake(col_name),
                source_type="tsvector",
                django_field="SearchVectorField",
                django_kwargs={},
            )

        # Detect array types
        is_array = False
        array_base = None
        if raw_type.endswith("[]") or "ARRAY" in raw_type.upper():
            is_array = True
            array_base = raw_type.replace("[]", "").strip()
            raw_type_clean = array_base
        else:
            raw_type_clean = raw_type

        # Parse type
        django_field, kwargs = cls._map_type(raw_type_clean)

        # Parse constraints
        is_pk = "PRIMARY KEY" in constraints.upper() or "PRIMARY KEY" in raw_type.upper()
        is_unique = "UNIQUE" in constraints.upper()
        is_nullable = "NOT NULL" not in constraints.upper() and not is_pk
        is_fk = False
        fk_table = None
        fk_column = None
        fk_on_delete = "CASCADE"

        # FK detection
        fk_match = re.search(
            r'REFERENCES\s+(\w+)\s*\((\w+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?',
            constraints, re.IGNORECASE
        )
        if fk_match:
            is_fk = True
            fk_table = fk_match.group(1)
            fk_column = fk_match.group(2)
            if fk_match.group(3):
                fk_on_delete = fk_match.group(3).upper()

        # Default value
        default_val = None
        default_match = re.search(r"DEFAULT\s+(.+?)(?:\s+(?:NOT|CHECK|UNIQUE|REFERENCES|$))",
                                   constraints, re.IGNORECASE)
        if default_match:
            raw_default = default_match.group(1).strip().rstrip(",")
            default_val = cls._parse_default(raw_default, django_field)

        # CHECK enum
        choices = None
        check_match = re.search(
            r"CHECK\s*\(\s*\w+\s+IN\s*\((.+?)\)\s*\)",
            constraints, re.IGNORECASE
        )
        if check_match:
            raw_choices = check_match.group(1)
            choices = [c.strip().strip("'\"") for c in raw_choices.split(",")]
            if django_field in ("TextField", "IntegerField"):
                django_field = "CharField"
                kwargs["max_length"] = max(len(c) for c in choices) + 10

        # Handle arrays
        if is_array:
            array_field, array_kwargs = cls._map_type(array_base)
            kwargs_str = ", ".join(f"{k}={v}" for k, v in array_kwargs.items())
            base_str = f"models.{array_field}({kwargs_str})" if kwargs_str else f"models.{array_field}()"
            django_field = "ArrayField"
            kwargs = {"base_field": base_str, "default": "list"}

        # Handle vector type for pgvector
        vector_match = re.match(r'vector\s*\((\d+)\)', raw_type_clean, re.IGNORECASE)
        if vector_match:
            dims = vector_match.group(1)
            django_field = "VectorField"
            kwargs = {"dimensions": int(dims)}

        col = ColumnDef(
            name=col_name,
            django_name=_sanitize_field_name(_camel_to_snake(col_name)),
            source_type=raw_type,
            django_field=django_field,
            django_kwargs=kwargs,
            is_primary_key=is_pk,
            is_foreign_key=is_fk,
            fk_table=fk_table,
            fk_column=fk_column,
            fk_on_delete=fk_on_delete,
            is_unique=is_unique,
            is_nullable=is_nullable,
            default_value=default_val,
            choices=choices,
            is_array=is_array,
            array_base_type=array_base,
        )

        return col

    @classmethod
    def _map_type(cls, raw_type: str) -> Tuple[str, Dict]:
        """Map SQL type to Django field"""
        raw_lower = raw_type.lower().strip()

        # VARCHAR(n)
        varchar_m = re.match(r'varchar\s*\((\d+)\)', raw_lower)
        if varchar_m:
            return "CharField", {"max_length": int(varchar_m.group(1))}

        # NUMERIC(p, s) / DECIMAL(p, s)
        num_m = re.match(r'(?:numeric|decimal)\s*\((\d+)\s*,\s*(\d+)\)', raw_lower)
        if num_m:
            return "DecimalField", {
                "max_digits": int(num_m.group(1)),
                "decimal_places": int(num_m.group(2)),
            }

        # TIMESTAMP / TIMESTAMPTZ
        if "timestamp" in raw_lower:
            return "DateTimeField", {}

        # vector(N)
        vec_m = re.match(r'vector\s*\((\d+)\)', raw_lower)
        if vec_m:
            return "VectorField", {"dimensions": int(vec_m.group(1))}

        # Direct lookup
        for sql_type, (dj_field, dj_kwargs) in cls.TYPE_MAP.items():
            if raw_lower.startswith(sql_type):
                return dj_field, dict(dj_kwargs)

        # Fallback
        return "TextField", {}

    @classmethod
    def _parse_default(cls, raw: str, django_field: str) -> Optional[str]:
        """Parse SQL DEFAULT value into Python representation"""
        raw = raw.strip()
        upper = raw.upper()

        if upper in ("NOW()", "CURRENT_TIMESTAMP"):
            return None  # handled by auto_now_add
        if upper.startswith("UUID_GENERATE") or upper.startswith("GEN_RANDOM"):
            return None  # handled by UUIDField default
        if upper in ("TRUE",):
            return "True"
        if upper in ("FALSE",):
            return "False"
        if upper == "0":
            return "0"
        if upper in ("'{}'", "'{}'::JSONB"):
            return "dict"
        if upper in ("'[]'", "'[]'::JSONB"):
            return "list"
        if raw.startswith("'") and raw.endswith("'"):
            return f"'{raw.strip(chr(39))}'"

        # Numeric
        try:
            float(raw)
            return raw
        except ValueError:
            pass

        return None


# ──────────────────────────────────────────────
# Drizzle ORM Parser (TypeScript → Django)
# ──────────────────────────────────────────────

class DrizzleSchemaParser:
    """Parses Drizzle ORM TypeScript schema files into TableDef objects"""

    DRIZZLE_TYPE_MAP = {
        "uuid": ("UUIDField", {}),
        "text": ("TextField", {}),
        "varchar": ("CharField", {}),
        "integer": ("IntegerField", {}),
        "bigint": ("BigIntegerField", {}),
        "smallint": ("SmallIntegerField", {}),
        "boolean": ("BooleanField", {"default": False}),
        "numeric": ("DecimalField", {}),
        "decimal": ("DecimalField", {}),
        "real": ("FloatField", {}),
        "doublePrecision": ("FloatField", {}),
        "date": ("DateField", {}),
        "time": ("TimeField", {}),
        "timestamp": ("DateTimeField", {}),
        "jsonb": ("JSONField", {"default": dict}),
        "json": ("JSONField", {"default": dict}),
        "inet": ("GenericIPAddressField", {}),
        "serial": ("AutoField", {}),
    }

    @classmethod
    def parse_drizzle_file(cls, ts_content: str, source_file: str = "",
                           app_name: str = "core") -> List[TableDef]:
        """Parse Drizzle TypeScript schema content"""
        tables = []
        enums = cls._extract_enums(ts_content)

        # Extract pgTable definitions
        # Pattern: pgTable("table_name", { ... })
        # or: schema.table("table_name", { ... })
        table_pattern = re.compile(
            r'(?:pgTable|\.table)\s*\(\s*["\'](\w+)["\']\s*,\s*\{(.*?)\}\s*(?:,\s*\(table\)\s*=>.*?)?\)',
            re.DOTALL
        )

        for match in table_pattern.finditer(ts_content):
            table_name = match.group(1)
            body = match.group(2)
            table_def = cls._parse_drizzle_table(table_name, body, enums,
                                                   source_file, app_name)
            if table_def:
                tables.append(table_def)

        return tables

    @classmethod
    def _extract_enums(cls, content: str) -> Dict[str, List[str]]:
        """Extract pgEnum definitions"""
        enums = {}
        # pgEnum("enum_name", [...values...])
        pattern = re.compile(
            r'pgEnum\s*\(\s*["\'](\w+)["\']\s*,\s*\[([^\]]+)\]\s*\)',
            re.DOTALL
        )
        for match in pattern.finditer(content):
            name = match.group(1)
            values_raw = match.group(2)
            values = re.findall(r'["\']([^"\']+)["\']', values_raw)
            enums[name] = values
        return enums

    @classmethod
    def _parse_drizzle_table(cls, table_name: str, body: str,
                              enums: Dict[str, List[str]],
                              source_file: str, app_name: str) -> Optional[TableDef]:
        """Parse a Drizzle table body"""
        model_name = _table_to_model_name(table_name)
        table = TableDef(
            name=table_name,
            django_model_name=model_name,
            django_app=app_name,
            source_type="drizzle",
            source_file=source_file,
        )

        # Parse each field line
        # Pattern: fieldName: type(...).constraint().constraint()
        field_pattern = re.compile(
            r'(\w+)\s*:\s*(.+?)(?:,\s*$|\s*$)',
            re.MULTILINE
        )

        for match in field_pattern.finditer(body):
            field_name = match.group(1).strip()
            field_def = match.group(2).strip().rstrip(",")

            if field_name in ("$inferInsert", "$inferSelect"):
                continue

            col = cls._parse_drizzle_field(field_name, field_def, table_name, enums)
            if col:
                table.columns.append(col)

        return table if table.columns else None

    @classmethod
    def _parse_drizzle_field(cls, field_name: str, field_def: str,
                              table_name: str,
                              enums: Dict[str, List[str]]) -> Optional[ColumnDef]:
        """Parse a single Drizzle field definition"""
        snake_name = _camel_to_snake(field_name)

        # Detect type call: uuid(...), text(...), varchar(...), etc.
        type_match = re.match(r'(\w+)\s*\(', field_def)
        if not type_match:
            return None

        drizzle_type = type_match.group(1)

        # Check if it's an enum reference
        is_enum = drizzle_type in enums or any(
            en_name in field_def for en_name in enums.keys()
        )
        choices = None
        if is_enum:
            for en_name, en_values in enums.items():
                if en_name in field_def or en_name == drizzle_type:
                    choices = en_values
                    break

        # Map type
        django_field, kwargs = cls._map_drizzle_type(drizzle_type, field_def)

        # Override for enum fields
        if choices:
            django_field = "CharField"
            kwargs["max_length"] = max(len(c) for c in choices) + 10

        # Parse chained constraints
        is_pk = ".primaryKey()" in field_def or "primaryKey" in field_def
        is_unique = ".unique()" in field_def
        is_not_null = ".notNull()" in field_def or "NOT NULL" in field_def.upper()
        is_nullable = not is_not_null and not is_pk

        # Default value
        default_val = None
        default_match = re.search(r'\.default\s*\(\s*(.+?)\s*\)', field_def)
        if default_match:
            raw_default = default_match.group(1).strip()
            default_val = cls._parse_drizzle_default(raw_default, django_field)

        # Foreign key
        is_fk = False
        fk_table = None
        fk_column = None
        fk_on_delete = "CASCADE"

        fk_match = re.search(
            r'\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)',
            field_def
        )
        if fk_match:
            is_fk = True
            fk_table_var = fk_match.group(1)
            fk_column = _camel_to_snake(fk_match.group(2))
            # Convert JS variable to SQL table name
            fk_table = _camel_to_snake(fk_table_var)
            if fk_table.endswith("s") and not fk_table.endswith("ss"):
                pass  # already plural
            # Check ON DELETE
            if "onDelete" in field_def:
                od_match = re.search(r'onDelete\s*:\s*["\'](\w+)["\']', field_def)
                if od_match:
                    fk_on_delete = od_match.group(1).upper()

        # Also check FK pattern: FK → table.column
        if not is_fk:
            fk_match2 = re.search(
                r'FK\s*→\s*(\w+)\.(\w+)', field_def
            )
            if fk_match2:
                is_fk = True
                fk_table = fk_match2.group(1)
                fk_column = fk_match2.group(2)

        # Array detection
        is_array = "[]" in field_def or ".array()" in field_def

        col = ColumnDef(
            name=field_name,
            django_name=_sanitize_field_name(snake_name),
            source_type=drizzle_type,
            django_field=django_field,
            django_kwargs=kwargs,
            is_primary_key=is_pk,
            is_foreign_key=is_fk,
            fk_table=fk_table,
            fk_column=fk_column,
            fk_on_delete=fk_on_delete,
            is_unique=is_unique,
            is_nullable=is_nullable,
            default_value=default_val,
            choices=choices,
            is_array=is_array,
        )

        return col

    @classmethod
    def _map_drizzle_type(cls, drizzle_type: str, field_def: str) -> Tuple[str, Dict]:
        """Map Drizzle type to Django field"""
        # varchar with length
        if drizzle_type == "varchar":
            len_match = re.search(r'varchar\s*\(\s*(\d+)\s*\)', field_def)
            if len_match:
                return "CharField", {"max_length": int(len_match.group(1))}
            return "CharField", {"max_length": 255}

        # numeric with precision
        if drizzle_type in ("numeric", "decimal"):
            num_match = re.search(r'(?:numeric|decimal)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)', field_def)
            if num_match:
                return "DecimalField", {
                    "max_digits": int(num_match.group(1)),
                    "decimal_places": int(num_match.group(2)),
                }
            return "DecimalField", {"max_digits": 19, "decimal_places": 2}

        # Direct lookup
        if drizzle_type in cls.DRIZZLE_TYPE_MAP:
            dj_field, dj_kwargs = cls.DRIZZLE_TYPE_MAP[drizzle_type]
            return dj_field, dict(dj_kwargs)

        # Fallback
        return "TextField", {}

    @classmethod
    def _parse_drizzle_default(cls, raw: str, django_field: str) -> Optional[str]:
        """Parse Drizzle .default() value"""
        raw = raw.strip()

        if raw in ("true", "True"):
            return "True"
        if raw in ("false", "False"):
            return "False"
        if raw == "{}":
            return "dict"
        if raw == "[]":
            return "list"
        if raw.startswith('"') or raw.startswith("'"):
            return raw
        try:
            float(raw)
            return raw
        except ValueError:
            pass

        return None


# ──────────────────────────────────────────────
# Django Code Templates
# ──────────────────────────────────────────────

class DjangoCodeTemplates:
    """Templates for generating Django boilerplate code"""

    @staticmethod
    def models_header(app_name: str) -> str:
        return textwrap.dedent(f'''\
            """
            Django models for {app_name} app.
            Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}
            
            DO NOT EDIT manually unless you know what you're doing.
            Re-run the generator to overwrite.
            """
            import uuid
            from django.db import models
            from django.contrib.postgres.fields import ArrayField
            from django.contrib.postgres.search import SearchVectorField
            
            try:
                from pgvector.django import VectorField
            except ImportError:
                VectorField = None  # pgvector not installed
            
            
            class BaseModel(models.Model):
                """Abstract base with standard audit fields."""
                id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
                created_at = models.DateTimeField(auto_now_add=True)
                updated_at = models.DateTimeField(auto_now=True)
                
                class Meta:
                    abstract = True
            
            
            class OrganizationModel(BaseModel):
                """Abstract base for multi-organization models."""
                organization = models.ForeignKey(
                    'auth_core.Organizations',
                    on_delete=models.CASCADE,
                    related_name='%(class)ss'
                )
                
                class Meta:
                    abstract = True
            
        ''')

    @staticmethod
    def serializers_file(app_name: str, models: List[TableDef]) -> str:
        lines = [
            f'"""',
            f'DRF serializers for {app_name} app.',
            f'Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}',
            f'"""',
            f'from rest_framework import serializers',
            f'from .models import ({", ".join(t.django_model_name for t in models)})',
            '',
        ]
        for t in models:
            fields = [c.django_name for c in t.columns
                      if not c.is_primary_key or c.name == "id"]
            field_names = ", ".join([f"'{f}'" for f in fields[:20]])
            lines.extend([
                '',
                f'class {t.django_model_name}Serializer(serializers.ModelSerializer):',
                f'    class Meta:',
                f'        model = {t.django_model_name}',
                f"        fields = '__all__'",
                f"        read_only_fields = ['id', 'created_at', 'updated_at']",
                '',
            ])

        return "\n".join(lines)

    @staticmethod
    def views_file(app_name: str, models: List[TableDef]) -> str:
        model_imports = ", ".join(t.django_model_name for t in models)
        serializer_imports = ", ".join(f"{t.django_model_name}Serializer" for t in models)
        lines = [
            f'"""',
            f'DRF viewsets for {app_name} app.',
            f'Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}',
            f'"""',
            f'from rest_framework import viewsets, permissions, filters',
            f'from django_filters.rest_framework import DjangoFilterBackend',
            f'from .models import ({model_imports})',
            f'from .serializers import ({serializer_imports})',
            '',
        ]
        for t in models:
            # Detect filterable fields
            filter_fields = [c.django_name for c in t.columns
                            if c.is_foreign_key or c.choices or
                            c.django_field in ("BooleanField", "CharField")]
            search_fields = [c.django_name for c in t.columns
                            if c.django_field in ("CharField", "TextField")
                            and not c.is_foreign_key][:5]

            lines.extend([
                '',
                f'class {t.django_model_name}ViewSet(viewsets.ModelViewSet):',
                f'    """API endpoint for {t.django_model_name} operations."""',
                f'    queryset = {t.django_model_name}.objects.all()',
                f'    serializer_class = {t.django_model_name}Serializer',
                f'    permission_classes = [permissions.IsAuthenticated]',
                f'    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]',
            ])
            if filter_fields:
                ff = ", ".join([f"'{f}'" for f in filter_fields[:10]])
                lines.append(f'    filterset_fields = [{ff}]')
            if search_fields:
                sf = ", ".join([f"'{f}'" for f in search_fields[:5]])
                lines.append(f'    search_fields = [{sf}]')
            lines.append(f"    ordering_fields = ['created_at', 'updated_at']")
            lines.append(f"    ordering = ['-created_at']")
            lines.append('')

        return "\n".join(lines)

    @staticmethod
    def urls_file(app_name: str, models: List[TableDef]) -> str:
        lines = [
            f'"""',
            f'URL configuration for {app_name} app.',
            f'Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}',
            f'"""',
            f'from django.urls import path, include',
            f'from rest_framework.routers import DefaultRouter',
            f'from . import views',
            '',
            f"router = DefaultRouter()",
        ]
        for t in models:
            url_prefix = t.name.replace("_", "-")
            lines.append(
                f"router.register(r'{url_prefix}', views.{t.django_model_name}ViewSet)"
            )
        lines.extend([
            '',
            f"app_name = '{app_name}'",
            '',
            'urlpatterns = [',
            "    path('', include(router.urls)),",
            ']',
        ])
        return "\n".join(lines)

    @staticmethod
    def admin_file(app_name: str, models: List[TableDef]) -> str:
        model_imports = ", ".join(t.django_model_name for t in models)
        lines = [
            f'"""',
            f'Admin configuration for {app_name} app.',
            f'Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}',
            f'"""',
            f'from django.contrib import admin',
            f'from .models import ({model_imports})',
            '',
        ]
        for t in models:
            # id and created_at always available via BaseModel inheritance
            list_display = ["'id'"]
            for c in t.columns:
                if c.django_name in ("name", "title", "slug", "email", "status",
                                     "claim_number", "grievance_number"):
                    list_display.append(f"'{c.django_name}'")
            list_display.append("'created_at'")
            list_display = list_display[:6]

            list_filter = []
            for c in t.columns:
                if c.choices or c.django_field == "BooleanField":
                    list_filter.append(f"'{c.django_name}'")
            list_filter = list_filter[:4]

            search_fields = []
            for c in t.columns:
                if c.django_field in ("CharField", "TextField") and not c.is_foreign_key:
                    search_fields.append(f"'{c.django_name}'")
            search_fields = search_fields[:4]

            lines.extend([
                '',
                f'@admin.register({t.django_model_name})',
                f'class {t.django_model_name}Admin(admin.ModelAdmin):',
                f'    list_display = [{", ".join(list_display)}]',
            ])
            if list_filter:
                lines.append(f'    list_filter = [{", ".join(list_filter)}]')
            if search_fields:
                lines.append(f'    search_fields = [{", ".join(search_fields)}]')
            lines.append(f"    ordering = ['-created_at']")
            lines.append('')

        return "\n".join(lines)

    @staticmethod
    def tests_file(app_name: str, models: List[TableDef]) -> str:
        model_imports = ", ".join(t.django_model_name for t in models)
        lines = [
            f'"""',
            f'Tests for {app_name} models.',
            f'Auto-generated by Nzila Code Generator — {datetime.now().strftime("%Y-%m-%d")}',
            f'"""',
            f'import uuid',
            f'from django.test import TestCase',
            f'from .models import ({model_imports})',
            '',
        ]
        for t in models:
            lines.extend([
                '',
                f'class {t.django_model_name}ModelTest(TestCase):',
                f'    """Test {t.django_model_name} model."""',
                '',
                f'    def test_create_{t.name}(self):',
                f'        """Test creating a {t.django_model_name} instance."""',
                f'        # TODO: Add factory data and assertions',
                f'        pass',
                '',
                f'    def test_{t.name}_str(self):',
                f'        """Test __str__ representation."""',
                f'        # TODO: Create instance and verify str output',
                f'        pass',
                '',
            ])

        return "\n".join(lines)


# ──────────────────────────────────────────────
# Main Code Generator
# ──────────────────────────────────────────────

class CodeGenerator:
    """
    Main code generator that orchestrates schema parsing and Django code output.

    Usage:
        gen = CodeGenerator(output_root=Path("output/"))
        gen.load_sql_schemas(Path("legacy-codebases/abr/.../supabase/migrations/"))
        gen.load_drizzle_schemas(Path("legacy-codebases/UE/.../db/schema/"))
        results = gen.generate_all()
    """

    def __init__(self, output_root: Path):
        self.output_root = Path(output_root)
        self.tables: Dict[str, List[TableDef]] = {}  # app_name → [TableDef]
        self.all_tables: List[TableDef] = []

    # ──────── Schema Loading ────────

    def load_sql_schemas(self, migrations_dir: Path,
                         app_mapping: Optional[Dict[str, str]] = None) -> int:
        """Load all SQL migration files from a directory"""
        if not migrations_dir.exists():
            logger.warning(f"Migrations directory not found: {migrations_dir}")
            return 0

        count = 0
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            content = sql_file.read_text(encoding="utf-8", errors="ignore")
            tables = SQLSchemaParser.parse_sql_file(
                content, source_file=sql_file.name, app_name="core"
            )
            for table in tables:
                if app_mapping and table.name in app_mapping:
                    table.django_app = app_mapping[table.name]
                self._register_table(table)
                count += 1

        logger.info(f"Loaded {count} tables from SQL migrations in {migrations_dir}")
        return count

    def load_drizzle_schemas(self, schema_dir: Path,
                              app_mapping: Optional[Dict[str, str]] = None) -> int:
        """Load all Drizzle TypeScript schema files from a directory"""
        if not schema_dir.exists():
            logger.warning(f"Schema directory not found: {schema_dir}")
            return 0

        count = 0
        for ts_file in sorted(schema_dir.rglob("*.ts")):
            if ts_file.name.endswith(".d.ts"):
                continue
            content = ts_file.read_text(encoding="utf-8", errors="ignore")
            tables = DrizzleSchemaParser.parse_drizzle_file(
                content, source_file=ts_file.name, app_name="core"
            )
            for table in tables:
                if app_mapping and table.name in app_mapping:
                    table.django_app = app_mapping[table.name]
                self._register_table(table)
                count += 1

        logger.info(f"Loaded {count} tables from Drizzle schemas in {schema_dir}")
        return count

    def load_from_config(self, config_path: Path) -> int:
        """Load schema info from flagship_refactor_config.json"""
        if not config_path.exists():
            logger.warning(f"Config not found: {config_path}")
            return 0

        with open(config_path) as f:
            config = json.load(f)

        count = 0
        for platform_id, platform in config.get("flagships", {}).items():
            legacy_path = Path(config_path).parent.parent.parent / platform["legacy_path"]
            app_mapping = {}

            # Build app mapping from django_apps list
            for app in platform.get("django_apps", []):
                app_mapping[app] = app

            if platform["current_stack"].get("database", "").startswith("drizzle"):
                schema_dir = legacy_path / "db" / "schema"
                count += self.load_drizzle_schemas(schema_dir, app_mapping)
            else:
                migrations_dir = legacy_path / "supabase" / "migrations"
                count += self.load_sql_schemas(migrations_dir, app_mapping)

        return count

    def _register_table(self, table: TableDef):
        """Register a table definition"""
        if table.django_app not in self.tables:
            self.tables[table.django_app] = []

        # Avoid duplicates
        existing_names = [t.name for t in self.tables[table.django_app]]
        if table.name not in existing_names:
            self.tables[table.django_app].append(table)
            self.all_tables.append(table)

    def build_model_registry(self) -> Dict[str, str]:
        """Build a registry mapping model names to their app names"""
        registry = {}
        for table in self.all_tables:
            model_name = _table_to_model_name(table.name)
            registry[model_name] = table.django_app
        return registry

    # ──────── Code Generation ────────

    def generate_all(self) -> List[GenerationResult]:
        """Generate Django code for all loaded apps"""
        results = []
        for app_name, app_tables in self.tables.items():
            result = self.generate_app(app_name, app_tables)
            results.append(result)
        return results

    def generate_app(self, app_name: str, tables: List[TableDef]) -> GenerationResult:
        """Generate all Django files for an app"""
        # Build model registry for cross-app FK references
        model_registry = self.build_model_registry()
        
        # Models
        models_code = DjangoCodeTemplates.models_header(app_name)
        for table in tables:
            models_code += "\n\n" + table.to_django_model_str(model_registry=model_registry)

        # Serializers
        serializers_code = DjangoCodeTemplates.serializers_file(app_name, tables)

        # Views
        views_code = DjangoCodeTemplates.views_file(app_name, tables)

        # URLs
        urls_code = DjangoCodeTemplates.urls_file(app_name, tables)

        # Admin
        admin_code = DjangoCodeTemplates.admin_file(app_name, tables)

        # Tests
        tests_code = DjangoCodeTemplates.tests_file(app_name, tables)

        total_fields = sum(len(t.columns) for t in tables)

        result = GenerationResult(
            app_name=app_name,
            models_code=models_code,
            serializers_code=serializers_code,
            views_code=views_code,
            urls_code=urls_code,
            admin_code=admin_code,
            tests_code=tests_code,
            model_count=len(tables),
            field_count=total_fields,
            source_tables=[t.name for t in tables],
        )

        return result

    def write_app(self, result: GenerationResult, base_dir: Optional[Path] = None):
        """Write generated code to disk"""
        out = (base_dir or self.output_root) / result.app_name
        out.mkdir(parents=True, exist_ok=True)

        files = {
            "__init__.py": "",
            "models.py": result.models_code,
            "serializers.py": result.serializers_code,
            "views.py": result.views_code,
            "urls.py": result.urls_code,
            "admin.py": result.admin_code,
            "tests.py": result.tests_code,
            "apps.py": self._apps_py(result.app_name),
        }

        for filename, content in files.items():
            filepath = out / filename
            filepath.write_text(content, encoding="utf-8")
            logger.info(f"  Wrote {filepath}")

    def write_all(self, base_dir: Optional[Path] = None):
        """Generate and write all apps"""
        results = self.generate_all()
        for result in results:
            self.write_app(result, base_dir)
        return results

    @staticmethod
    def _apps_py(app_name: str) -> str:
        class_name = "".join(w.capitalize() for w in app_name.split("_"))
        return textwrap.dedent(f'''\
            from django.apps import AppConfig
            
            
            class {class_name}Config(AppConfig):
                default_auto_field = "django.db.models.BigAutoField"
                name = "{app_name}"
                verbose_name = "{app_name.replace('_', ' ').title()}"
        ''')

    # ──────── Reporting ────────

    def generate_report(self) -> Dict[str, Any]:
        """Generate a summary report of all parsed schemas"""
        return {
            "timestamp": datetime.now().isoformat(),
            "total_apps": len(self.tables),
            "total_tables": len(self.all_tables),
            "total_fields": sum(len(t.columns) for t in self.all_tables),
            "apps": {
                app_name: {
                    "table_count": len(tables),
                    "tables": [
                        {
                            "name": t.name,
                            "model_name": t.django_model_name,
                            "field_count": len(t.columns),
                            "source": t.source_type,
                            "source_file": t.source_file,
                            "has_fk": any(c.is_foreign_key for c in t.columns),
                            "has_enum": any(c.choices for c in t.columns),
                            "has_jsonb": any("JSON" in c.django_field for c in t.columns),
                        }
                        for t in tables
                    ],
                }
                for app_name, tables in self.tables.items()
            },
        }


# ──────────────────────────────────────────────
# ABR-Specific App Mapping
# ──────────────────────────────────────────────

ABR_TABLE_APP_MAPPING = {
    # Core
    "organizations": "auth_core",
    "profiles": "auth_core",
    "roles": "auth_core",
    "permissions": "auth_core",
    "role_permissions": "auth_core",
    "user_roles": "auth_core",
    "audit_logs": "auth_core",
    # Content / Learning
    "content_categories": "content",
    "courses": "content",
    "lessons": "content",
    "quizzes": "content",
    "tribunal_cases": "content",
    # Engagement
    "enrollments": "content",
    "lesson_progress": "content",
    "quiz_attempts": "content",
    "course_reviews": "content",
    "bookmarks": "content",
    # Gamification
    "achievements": "content",
    "user_achievements": "content",
    "user_points": "content",
    "learning_streaks": "content",
    # AI
    "classification_feedback": "ai_core",
    "training_jobs": "ai_core",
    "automated_training_config": "ai_core",
    "case_embeddings": "ai_core",
    "course_embeddings": "ai_core",
    "lesson_embeddings": "ai_core",
    "embedding_jobs": "ai_core",
    # Risk / Compliance
    "risk_score_history": "compliance",
    "organization_risk_history": "compliance",
    "evidence_bundles": "compliance",
    "evidence_bundle_components": "compliance",
    "evidence_bundle_policy_mappings": "compliance",
    "evidence_bundle_timeline": "compliance",
    # Search / Alerts
    "saved_searches": "analytics",
    "case_alerts": "analytics",
    "case_digests": "analytics",
    "alert_preferences": "notifications",
    # Billing
    "organization_subscriptions": "billing",
    "seat_allocations": "billing",
    "subscription_invoices": "billing",
    # Marketing
    "newsletter_subscribers": "notifications",
    "testimonials": "content",
}


# ──────────────────────────────────────────────
# UE-Specific App Mapping
# ──────────────────────────────────────────────

UE_TABLE_APP_MAPPING = {
    # ── auth_core (25) ─────────────────────────────────────
    "organizations": "auth_core",
    "organization_relationships": "auth_core",
    "organization_members": "auth_core",
    "profiles": "auth_core",
    "pending_profiles": "auth_core",
    "users": "auth_core",
    "organization_users": "auth_core",
    "user_sessions": "auth_core",
    "oauth_providers": "auth_core",
    "user_uuid_mapping": "auth_core",
    "sso_providers": "auth_core",
    "scim_configurations": "auth_core",
    "sso_sessions": "auth_core",
    "scim_events_log": "auth_core",
    "mfa_configurations": "auth_core",
    "member_contact_preferences": "auth_core",
    "member_employment_details": "auth_core",
    "member_consents": "auth_core",
    "member_history_events": "auth_core",
    "international_addresses": "auth_core",
    "country_address_formats": "auth_core",
    "address_validation_cache": "auth_core",
    "address_change_history": "auth_core",
    "feature_flags": "auth_core",
    "organization_sharing_settings": "auth_core",
    "cross_org_access_log": "auth_core",
    "organization_sharing_grants": "auth_core",

    # ── unions (68) ────────────────────────────────────────
    "member_employment": "unions",
    "employment_history": "unions",
    "member_leaves": "unions",
    "job_classifications": "unions",
    "member_addresses": "unions",
    "member_segments": "unions",
    "segment_executions": "unions",
    "segment_exports": "unions",
    "member_certifications": "unions",
    "congress_memberships": "unions",
    "steward_assignments": "unions",
    "role_tenure_history": "unions",
    "member_location_consent": "unions",
    "employers": "unions",
    "worksites": "unions",
    "bargaining_units": "unions",
    "committees": "unions",
    "committee_memberships": "unions",
    "voting_sessions": "unions",
    "voting_options": "unions",
    "voter_eligibility": "unions",
    "votes": "unions",
    "voting_notifications": "unions",
    "voting_audit_log": "unions",
    "training_courses": "unions",
    "course_sessions": "unions",
    "course_registrations": "unions",
    "training_programs": "unions",
    "program_enrollments": "unions",
    "organizing_campaigns": "unions",
    "organizing_contacts": "unions",
    "field_organizer_activities": "unions",
    "nlrb_clrb_filings": "unions",
    "organizing_campaign_milestones": "unions",
    "card_signing_events": "unions",
    "employer_responses": "unions",
    "union_representation_votes": "unions",
    "surveys": "unions",
    "survey_questions": "unions",
    "survey_responses": "unions",
    "survey_answers": "unions",
    "polls": "unions",
    "poll_votes": "unions",
    "award_templates": "unions",
    "award_history": "unions",
    "recognition_programs": "unions",
    "recognition_award_types": "unions",
    "recognition_awards": "unions",
    "reward_redemptions": "unions",
    "reward_wallet_ledger": "unions",
    "reward_budget_envelopes": "unions",
    "budget_pool": "unions",
    "budget_reservations": "unions",
    "calendars": "unions",
    "calendar_events": "unions",
    "event_attendees": "unions",
    "meeting_rooms": "unions",
    "room_bookings": "unions",
    "calendar_sharing": "unions",
    "external_calendar_connections": "unions",
    "event_reminders": "unions",
    "holidays": "unions",
    "outreach_sequences": "unions",
    "outreach_enrollments": "unions",
    "outreach_steps_log": "unions",
    "field_notes": "unions",
    "organizer_tasks": "unions",
    "task_comments": "unions",
    "member_relationship_scores": "unions",
    "federations": "unions",
    "federation_memberships": "unions",
    "federation_executives": "unions",
    "federation_meetings": "unions",
    "federation_campaigns": "unions",
    "federation_communications": "unions",
    "federation_remittances": "unions",
    "federation_resources": "unions",

    # ── grievances (24) ────────────────────────────────────
    "grievances": "grievances",
    "grievance_responses": "grievances",
    "arbitrations": "grievances",
    "settlements": "grievances",
    "grievance_timeline": "grievances",
    "grievance_deadlines": "grievances",
    "grievance_workflows": "grievances",
    "grievance_stages": "grievances",
    "grievance_transitions": "grievances",
    "grievance_assignments": "grievances",
    "grievance_documents": "grievances",
    "grievance_settlements": "grievances",
    "grievance_communications": "grievances",
    "grievance_approvals": "grievances",
    "claims": "grievances",
    "claim_updates": "grievances",
    "claim_deadlines": "grievances",
    "claim_precedent_analysis": "grievances",
    "deadline_rules": "grievances",
    "deadline_extensions": "grievances",
    "deadline_alerts": "grievances",
    "defensibility_packs": "grievances",
    "pack_download_log": "grievances",
    "pack_verification_log": "grievances",

    # ── bargaining (22) ───────────────────────────────────
    "collective_agreements": "bargaining",
    "cba_version_history": "bargaining",
    "cba_contacts": "bargaining",
    "negotiations": "bargaining",
    "bargaining_proposals": "bargaining",
    "tentative_agreements": "bargaining",
    "negotiation_sessions": "bargaining",
    "bargaining_team_members": "bargaining",
    "cba_clauses": "bargaining",
    "clause_comparisons": "bargaining",
    "wage_progressions": "bargaining",
    "benefit_comparisons": "bargaining",
    "cba_footnotes": "bargaining",
    "arbitration_decisions": "bargaining",
    "arbitrator_profiles": "bargaining",
    "bargaining_notes": "bargaining",
    "shared_clause_library": "bargaining",
    "clause_library_tags": "bargaining",
    "clause_comparisons_history": "bargaining",
    "arbitration_precedents": "bargaining",
    "precedent_tags": "bargaining",
    "precedent_citations": "bargaining",

    # ── notifications (35) ────────────────────────────────
    "notifications": "notifications",
    "notification_templates": "notifications",
    "notification_queue": "notifications",
    "notification_delivery_log": "notifications",
    "notification_bounces": "notifications",
    "notification_history": "notifications",
    "notification_tracking": "notifications",
    "user_notification_preferences": "notifications",
    "in_app_notifications": "notifications",
    "notification_log": "notifications",
    "push_devices": "notifications",
    "push_notifications": "notifications",
    "push_deliveries": "notifications",
    "push_notification_templates": "notifications",
    "mobile_notifications": "notifications",
    "mobile_analytics": "notifications",
    "mobile_devices": "notifications",
    "mobile_sync_queue": "notifications",
    "mobile_app_config": "notifications",
    "newsletter_templates": "notifications",
    "newsletter_campaigns": "notifications",
    "newsletter_recipients": "notifications",
    "newsletter_engagement": "notifications",
    "newsletter_distribution_lists": "notifications",
    "newsletter_list_subscribers": "notifications",
    "sms_campaigns": "notifications",
    "sms_messages": "notifications",
    "sms_conversations": "notifications",
    "sms_campaign_recipients": "notifications",
    "sms_opt_outs": "notifications",
    "sms_rate_limits": "notifications",
    "sms_templates": "notifications",
    "message_threads": "notifications",
    "messages": "notifications",
    "message_read_receipts": "notifications",
    "message_participants": "notifications",
    "message_notifications": "notifications",
    "message_log": "notifications",
    "message_templates": "notifications",
    "campaigns": "notifications",
    "communication_preferences": "notifications",
    "communication_preferences_phase4": "notifications",
    "communication_channels": "notifications",

    # ── billing (62) ──────────────────────────────────────
    "dues_rates": "billing",
    "member_dues_ledger": "billing",
    "member_arrears": "billing",
    "employer_remittances": "billing",
    "remittance_line_items": "billing",
    "remittance_exceptions": "billing",
    "dues_transactions": "billing",
    "payment_plans": "billing",
    "financial_periods": "billing",
    "autopay_settings": "billing",
    "payments": "billing",
    "payment_cycles": "billing",
    "payment_methods": "billing",
    "bank_reconciliation": "billing",
    "payment_disputes": "billing",
    "stripe_webhook_events": "billing",
    "stripe_connect_accounts": "billing",
    "separated_payment_transactions": "billing",
    "per_capita_remittances": "billing",
    "clc_chart_of_accounts": "billing",
    "remittance_approvals": "billing",
    "clc_per_capita_benchmarks": "billing",
    "clc_union_density": "billing",
    "clc_bargaining_trends": "billing",
    "clc_sync_log": "billing",
    "clc_oauth_tokens": "billing",
    "clc_webhook_log": "billing",
    "clc_organization_sync_log": "billing",
    "clc_remittance_mapping": "billing",
    "clc_api_config": "billing",
    "organization_contacts": "billing",
    "strike_fund_disbursements": "billing",
    "t4a_tax_slips": "billing",
    "rl1_tax_slips": "billing",
    "tax_year_end_processing": "billing",
    "weekly_threshold_tracking": "billing",
    "currency_enforcement_policy": "billing",
    "bank_of_canada_rates": "billing",
    "transaction_currency_conversions": "billing",
    "currency_enforcement_violations": "billing",
    "t106_filing_tracking": "billing",
    "transfer_pricing_documentation": "billing",
    "fx_rate_audit_log": "billing",
    "currency_enforcement_audit": "billing",
    "exchange_rates": "billing",
    "cross_border_transactions": "billing",
    "payment_classification_policy": "billing",
    "payment_routing_rules": "billing",
    "whiplash_violations": "billing",
    "strike_fund_payment_audit": "billing",
    "account_balance_reconciliation": "billing",
    "whiplash_prevention_audit": "billing",
    "donation_campaigns": "billing",
    "donations": "billing",
    "donation_receipts": "billing",
    "erp_connectors": "billing",
    "chart_of_accounts": "billing",
    "gl_account_mappings": "billing",
    "journal_entries": "billing",
    "journal_entry_lines": "billing",
    "erp_invoices": "billing",
    "bank_accounts": "billing",
    "bank_transactions": "billing",
    "bank_reconciliations": "billing",
    "sync_jobs": "billing",
    "financial_audit_log": "billing",
    "currency_exchange_rates": "billing",
    "cost_centers": "billing",
    "gl_transaction_log": "billing",
    "gl_trial_balance": "billing",
    "account_mappings": "billing",
    "organization_billing_config": "billing",
    "fmv_policy": "billing",
    "cpi_data": "billing",
    "fmv_benchmarks": "billing",
    "procurement_requests": "billing",
    "procurement_bids": "billing",
    "independent_appraisals": "billing",
    "cpi_adjusted_pricing": "billing",
    "fmv_violations": "billing",
    "fmv_audit_log": "billing",

    # ── compliance (87) ───────────────────────────────────
    "golden_shares": "compliance",
    "reserved_matter_votes": "compliance",
    "mission_audits": "compliance",
    "governance_events": "compliance",
    "council_elections": "compliance",
    "conflict_of_interest_policy": "compliance",
    "blind_trust_registry": "compliance",
    "conflict_disclosures": "compliance",
    "arms_length_verification": "compliance",
    "recusal_tracking": "compliance",
    "conflict_review_committee": "compliance",
    "conflict_training": "compliance",
    "conflict_audit_log": "compliance",
    "swiss_cold_storage": "compliance",
    "break_glass_system": "compliance",
    "disaster_recovery_drills": "compliance",
    "key_holder_registry": "compliance",
    "recovery_time_objectives": "compliance",
    "emergency_declarations": "compliance",
    "break_glass_activations": "compliance",
    "user_consents": "compliance",
    "cookie_consents": "compliance",
    "gdpr_data_requests": "compliance",
    "data_processing_records": "compliance",
    "data_retention_policies": "compliance",
    "data_anonymization_log": "compliance",
    "dsr_requests": "compliance",
    "dsr_activity_log": "compliance",
    "data_residency_configs": "compliance",
    "consent_records": "compliance",
    "data_classification_policy": "compliance",
    "data_classification_registry": "compliance",
    "firewall_access_rules": "compliance",
    "employer_access_attempts": "compliance",
    "access_justification_requests": "compliance",
    "union_only_data_tags": "compliance",
    "firewall_violations": "compliance",
    "firewall_compliance_audit": "compliance",
    "location_tracking": "compliance",
    "geofences": "compliance",
    "geofence_events": "compliance",
    "location_tracking_audit": "compliance",
    "location_deletion_log": "compliance",
    "location_tracking_config": "compliance",
    "band_councils": "compliance",
    "band_council_consent": "compliance",
    "indigenous_member_data": "compliance",
    "indigenous_data_access_log": "compliance",
    "indigenous_data_sharing_agreements": "compliance",
    "traditional_knowledge_registry": "compliance",
    "provincial_privacy_config": "compliance",
    "provincial_consent": "compliance",
    "privacy_breaches": "compliance",
    "provincial_data_handling": "compliance",
    "data_subject_access_requests": "compliance",
    "foreign_workers": "compliance",
    "lmbp_letters": "compliance",
    "gss_applications": "compliance",
    "mentorships": "compliance",
    "lmbp_compliance_alerts": "compliance",
    "lmbp_compliance_reports": "compliance",
    "pci_dss_saq_assessments": "compliance",
    "pci_dss_requirements": "compliance",
    "pci_dss_quarterly_scans": "compliance",
    "pci_dss_cardholder_data_flow": "compliance",
    "pci_dss_encryption_keys": "compliance",
    "policy_rules": "compliance",
    "policy_evaluations": "compliance",
    "retention_policies": "compliance",
    "legal_holds": "compliance",
    "policy_exceptions": "compliance",
    "lrb_agreements": "compliance",
    "lrb_employers": "compliance",
    "lrb_unions": "compliance",
    "lrb_sync_log": "compliance",
    "certification_types": "compliance",
    "staff_certifications": "compliance",
    "continuing_education": "compliance",
    "license_renewals": "compliance",
    "certification_alerts": "compliance",
    "certification_compliance_reports": "compliance",
    "certification_audit_log": "compliance",
    "workplace_incidents": "compliance",
    "safety_inspections": "compliance",
    "hazard_reports": "compliance",
    "safety_committee_meetings": "compliance",
    "safety_training_records": "compliance",
    "ppe_equipment": "compliance",
    "safety_audits": "compliance",
    "injury_logs": "compliance",
    "safety_policies": "compliance",
    "corrective_actions": "compliance",
    "safety_certifications": "compliance",

    # ── analytics (23) ────────────────────────────────────
    "analytics_metrics": "analytics",
    "kpi_configurations": "analytics",
    "trend_analyses": "analytics",
    "insight_recommendations": "analytics",
    "comparative_analyses": "analytics",
    "analytics_scheduled_reports": "analytics",
    "report_delivery_history": "analytics",
    "benchmark_categories": "analytics",
    "benchmark_data": "analytics",
    "organization_benchmark_snapshots": "analytics",
    "reports": "analytics",
    "report_templates": "analytics",
    "report_executions": "analytics",
    "scheduled_reports": "analytics",
    "report_shares": "analytics",
    "communication_analytics": "analytics",
    "user_engagement_scores": "analytics",
    "wage_benchmarks": "analytics",
    "union_density": "analytics",
    "cost_of_living_data": "analytics",
    "contribution_rates": "analytics",
    "external_data_sync_log": "analytics",
    "page_analytics": "analytics",

    # ── content (42) ──────────────────────────────────────
    "cms_templates": "content",
    "cms_pages": "content",
    "cms_blocks": "content",
    "cms_navigation_menus": "content",
    "cms_media_library": "content",
    "website_settings": "content",
    "public_events": "content",
    "event_registrations": "content",
    "event_check_ins": "content",
    "job_postings": "content",
    "job_applications": "content",
    "job_saved": "content",
    "social_accounts": "content",
    "social_posts": "content",
    "social_campaigns": "content",
    "social_analytics": "content",
    "social_feeds": "content",
    "social_engagement": "content",
    "document_folders": "content",
    "documents": "content",
    "member_documents": "content",
    "signature_documents": "content",
    "document_signers": "content",
    "signature_audit_trail": "content",
    "signature_templates": "content",
    "signature_webhooks_log": "content",
    "signature_workflows": "content",
    "signers": "content",
    "signature_verification": "content",
    "signature_audit_log": "content",
    "board_packets": "content",
    "board_packet_sections": "content",
    "board_packet_distributions": "content",
    "board_packet_templates": "content",
    "case_studies": "content",
    "testimonials": "content",
    "impact_metrics": "content",
    "pilot_applications": "content",
    "pilot_metrics": "content",
    "organizer_impacts": "content",
    "movement_trends": "content",
    "data_aggregation_consent": "content",
    "public_content": "content",
    "shopify_config": "content",
    "webhook_receipts": "content",

    # ── ai_core (18) ─────────────────────────────────────
    "chat_sessions": "ai_core",
    "chat_messages": "ai_core",
    "knowledge_base": "ai_core",
    "chatbot_suggestions": "ai_core",
    "chatbot_analytics": "ai_core",
    "ai_safety_filters": "ai_core",
    "ai_usage_metrics": "ai_core",
    "ai_rate_limits": "ai_core",
    "ai_budgets": "ai_core",
    "ml_predictions": "ai_core",
    "model_metadata": "ai_core",
    "ab_tests": "ai_core",
    "ab_test_variants": "ai_core",
    "ab_test_assignments": "ai_core",
    "ab_test_events": "ai_core",
    "accessibility_audits": "ai_core",
    "accessibility_issues": "ai_core",
    "wcag_success_criteria": "ai_core",
    "accessibility_test_suites": "ai_core",
    "accessibility_user_testing": "ai_core",

    # ── core (35) — Infrastructure, Integration, Automation ──
    "alert_rules": "core",
    "alert_conditions": "core",
    "alert_actions": "core",
    "alert_escalations": "core",
    "alert_executions": "core",
    "workflow_definitions": "core",
    "workflow_executions": "core",
    "alert_recipients": "core",
    "automation_rules": "core",
    "automation_execution_log": "core",
    "automation_schedules": "core",
    "webhook_subscriptions": "core",
    "webhook_deliveries": "core",
    "api_integrations": "core",
    "integration_sync_logs": "core",
    "api_access_tokens": "core",
    "integration_configs": "core",
    "integration_sync_log": "core",
    "integration_sync_schedules": "core",
    "integration_webhooks": "core",
    "integration_api_keys": "core",
    "webhook_events": "core",
    "knowledge_base_articles": "core",
    "sla_policies": "core",
    "support_tickets": "core",
    "ticket_comments": "core",
    "ticket_history": "core",
}


# ──────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────

def run_abr_generation(workspace_root: Path) -> List[GenerationResult]:
    """Generate Django code from ABR Insights Supabase schemas"""
    logger.info("=" * 60)
    logger.info("ABR Insights → Django Code Generation")
    logger.info("=" * 60)

    migrations_dir = (
        Path("D:/APPS/abr-insights-app-main/abr-insights-app-main/supabase/migrations")
    )

    output_dir = workspace_root / "packages" / "automation" / "data" / "generated" / "abr"

    gen = CodeGenerator(output_root=output_dir)
    gen.load_sql_schemas(migrations_dir, app_mapping=ABR_TABLE_APP_MAPPING)

    results = gen.write_all()

    report = gen.generate_report()
    report_path = output_dir / "generation_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"\nGeneration complete: {report['total_tables']} models across {report['total_apps']} apps")
    logger.info(f"Output: {output_dir}")
    logger.info(f"Report: {report_path}")

    return results


def run_ue_generation(workspace_root: Path) -> List[GenerationResult]:
    """Generate Django code from Union Eyes Drizzle schemas"""
    logger.info("=" * 60)
    logger.info("Union Eyes → Django Code Generation")
    logger.info("=" * 60)

    schema_dir = (
        Path("D:/APPS/Union_Eyes_app_v1-main/Union_Eyes_app_v1-main/db/schema")
    )

    output_dir = workspace_root / "packages" / "automation" / "data" / "generated" / "ue"

    gen = CodeGenerator(output_root=output_dir)
    gen.load_drizzle_schemas(schema_dir, app_mapping=UE_TABLE_APP_MAPPING)

    results = gen.write_all()

    report = gen.generate_report()
    report_path = output_dir / "generation_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"\nGeneration complete: {report['total_tables']} models across {report['total_apps']} apps")
    logger.info(f"Output: {output_dir}")
    logger.info(f"Report: {report_path}")

    return results


def main():
    """CLI entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Nzila Code Generator")
    parser.add_argument("--platform", choices=["abr", "ue", "all"], default="all",
                        help="Which platform to generate code for")
    parser.add_argument("--workspace", type=Path,
                        default=Path(__file__).parent.parent.parent,
                        help="Workspace root directory")
    parser.add_argument("--output", type=Path, default=None,
                        help="Custom output directory")

    args = parser.parse_args()

    if args.platform in ("abr", "all"):
        run_abr_generation(args.workspace)
    if args.platform in ("ue", "all"):
        run_ue_generation(args.workspace)


if __name__ == "__main__":
    main()
