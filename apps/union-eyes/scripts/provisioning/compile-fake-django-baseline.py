"""Offline physical subset compiler. Migration/framework text is parsed, never run.

Only this compiler and the existing syntax reader are imported. Unsupported effects
are retained as ceilings; an inventory is not a full Django migration execution proof.
"""

import ast
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile


LOCK_PATH = (
    "docs/union-eyes/reality-remediation/"
    "PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json"
)
LOCK_SHA256 = "1e74413a98722c042888a5cd0e135f34719778e78407129a4c6821f2f7fc3b52"
DJANGO_WHEEL_SHA256 = "92ed81d500be6408ecd704d7bd1366c534f30427bffcc63c5fefb129561aec7c"
BACKEND_SHA256 = "d73b472e8d3f315b5e53f5a810e5e80d6a0310305fa668c7a0d0f345038aafa7"
SCHEMA_SHA256 = "cadbef8844b990df069efa8e5a9a83a11e0ee550c5fe495c43bf622839f06004"
UTILS_SHA256 = "c05c9055f56cd40c51e3cc9021543e965d6c0bd194782c5d3fe69abd82f496bb"
spec = importlib.util.spec_from_file_location(
    "fake_django_syntax_reader", Path(__file__).with_name("read-fake-django-fields.py")
)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def literal(node):
    if isinstance(node, ast.Constant) and isinstance(
        node.value, (str, int, bool, type(None))
    ):
        return node.value
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return [literal(x) for x in node.elts]
    if isinstance(node, ast.Dict):
        return {literal(k): literal(v) for k, v in zip(node.keys, node.values)}
    raise ValueError("FAKE_DJANGO_BACKEND_NONLITERAL")


def normalize_literal_sets(value):
    if isinstance(value, list):
        return [normalize_literal_sets(v) for v in value]
    if isinstance(value, dict):
        if value.get("EXPRESSION_CLASS") == "Set":
            return literal(ast.parse(value["UNRESOLVED_EXPRESSION"], mode="eval").body)
        if value.get("call") == "set" and len(value["args"]) == 1 and not value["kwargs"]:
            require(isinstance(value["args"][0], list), "LITERAL_SET_REQUIRED")
            return normalize_literal_sets(value["args"][0])
        return {k: normalize_literal_sets(v) for k, v in value.items()}
    return value


def load_sources(root, wheelhouse):
    root, wheelhouse = Path(root).resolve(), Path(wheelhouse).resolve()
    lock_bytes = (root / LOCK_PATH).read_bytes()
    require(digest(lock_bytes) == LOCK_SHA256, "FAKE_DJANGO_W1_LOCK_DRIFT")
    lock = json.loads(lock_bytes)
    nodes = {n["MIGRATION_ID"]: n for n in lock["migrationNodes"]}
    plan = lock["canonicalMigrationPlan"]
    require(
        len(nodes) == 82
        and len(plan) == 82
        and len({p["MIGRATION_ID"] for p in plan}) == 82
        and [p["ORDER_INDEX"] for p in plan] == list(range(82)),
        "FAKE_DJANGO_W1_PLAN_REQUIRED",
    )
    order = {p["MIGRATION_ID"]: p["ORDER_INDEX"] for p in plan}
    for edge in lock["migrationEdges"]:
        if edge["EDGE_CLASS"] == "DEPENDENCY":
            require(
                edge["RESOLUTION"] == "RESOLVED"
                and order[edge["TO_MIGRATION"]] < order[edge["FROM_MIGRATION"]],
                "FAKE_DJANGO_W1_DEPENDENCY_ORDER",
            )
    wheels = {}
    for distribution in lock["lockedDistributions"]:
        name = distribution["ARTIFACT_FILENAME"]
        require(Path(name).name == name, "FAKE_DJANGO_WHEEL_PATH")
        path = wheelhouse / name
        require(
            digest(path.read_bytes()) == distribution["ARTIFACT_SHA256"],
            "FAKE_DJANGO_WHEEL_HASH_DRIFT:" + name,
        )
        wheels[distribution["DISTRIBUTION"]] = path
    require(len(wheels) == 87, "FAKE_DJANGO_W1_WHEEL_COUNT")
    require(
        digest(wheels["django"].read_bytes()) == DJANGO_WHEEL_SHA256,
        "FAKE_DJANGO_BACKEND_WHEEL_DRIFT",
    )
    with zipfile.ZipFile(wheels["django"]) as archive:
        backend = archive.read("django/db/backends/postgresql/base.py")
        require(digest(backend) == BACKEND_SHA256, "FAKE_DJANGO_BACKEND_DRIFT")
        for name, expected in [
            ("django/db/backends/base/schema.py", SCHEMA_SHA256),
            ("django/db/backends/utils.py", UTILS_SHA256),
            ("django/db/backends/postgresql/schema.py",
             "37e739436117b93758a1e94d5c39e443c6a915ca584fa60545d867879a450585"),
            ("django/db/backends/ddl_references.py",
             "75496418b19d8ce9da711ffc3dac1e0395d2c200fcc288cc4c951538238a54b6"),
        ]:
            require(digest(archive.read(name)) == expected, "FAKE_DJANGO_NAMING_DRIFT")
        tree = ast.parse(backend)
        mappings = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in (
                        "data_types",
                        "data_type_check_constraints",
                    ):
                        mappings[target.id] = {
                            literal(k): (
                                {"backend_function": v.id}
                                if isinstance(v, ast.Name)
                                else literal(v)
                            )
                            for k, v in zip(node.value.keys, node.value.values)
                        }
    sources, unsupported = [], []
    for entry in plan:
        node = nodes[entry["MIGRATION_ID"]]
        require(
            node["FILE_SHA256"] == entry["FILE_SHA256"]
            and node["SOURCE_CLASS"] == entry["SOURCE_CLASS"],
            "FAKE_DJANGO_W1_PLAN_NODE_DRIFT",
        )
        name = node["SOURCE_FILE"]
        if node["SOURCE_CLASS"] == "LOCAL":
            path = (root / name).resolve()
            require(path.is_relative_to(root), "FAKE_DJANGO_SOURCE_PATH")
            data = path.read_bytes()
        else:
            with zipfile.ZipFile(wheels[node["DISTRIBUTION_NAME"]]) as archive:
                data = archive.read(name)
        require(digest(data) == node["FILE_SHA256"], "FAKE_DJANGO_SOURCE_HASH_DRIFT:" + name)
        text = data.decode("utf-8")
        try:
            declaration = normalize_literal_sets(reader.read_source({"FILE": name, "TEXT": text}))
            bindings = {}
            for statement in ast.parse(text).body:
                if isinstance(statement, ast.ClassDef) and statement.name == "Migration":
                    break
                if isinstance(statement, ast.Assign):
                    for target in statement.targets:
                        if isinstance(target, ast.Name):
                            bindings[target.id] = statement.value
            declaration["LITERAL_SQL_BINDINGS"] = {
                name: value.value
                for name, value in bindings.items()
                if isinstance(value, ast.Constant) and isinstance(value.value, str)
            }
            sources.append({**node, **declaration})
        except (ValueError, KeyError) as error:
            require(node["SOURCE_CLASS"] != "LOCAL", "FAKE_DJANGO_LOCAL_AST_FAILED")
            unsupported.append(
                {
                    "migration": node["MIGRATION_ID"],
                    "file": name,
                    "line": 0,
                    "operation": "AST_READ",
                    "reason": str(error),
                    "tables": [],
                }
            )
    return lock, sources, mappings, unsupported, digest(lock_bytes)


def index_name(table, columns, suffix):
    # Literal implementation of the pinned schema.py / utils.py algorithm, max 63.
    checksum = hashlib.md5("".join([table, *columns]).encode(), usedforsecurity=False)
    hash_suffix = checksum.hexdigest()[:8] + suffix
    name = "%s_%s_%s" % (table, "_".join(columns), hash_suffix)
    if len(name) <= 63:
        return name
    if len(hash_suffix) > 63 / 3:
        hash_suffix = hash_suffix[:21]
    other_length = (63 - len(hash_suffix)) // 2 - 1
    name = "%s_%s_%s" % (
        table[:other_length],
        "_".join(columns)[:other_length],
        hash_suffix,
    )
    return "D" + name[:-1] if name[0] == "_" or name[0].isdigit() else name


NATIVE = {
    "uuid": ("uuid", "uuid"),
    "text": ("text", "text"),
    "varchar": ("varchar", "character varying"),
    "boolean": ("bool", "boolean"),
    "integer": ("int4", "integer"),
    "bigint": ("int8", "bigint"),
    "smallint": ("int2", "smallint"),
    "jsonb": ("jsonb", "jsonb"),
    "date": ("date", "date"),
    "timestamp with time zone": ("timestamptz", "timestamp with time zone"),
    "time": ("time", "time without time zone"),
    "numeric": ("numeric", "numeric"),
    "double precision": ("float8", "double precision"),
    "bytea": ("bytea", "bytea"),
    "interval": ("interval", "interval"),
    "inet": ("inet", "inet"),
}


def native_column(name, sql_type, nullable, identity="", default=None):
    normalized = sql_type.strip().lower()
    aliases = {"timestamptz": "timestamp with time zone", "bool": "boolean"}
    normalized = aliases.get(normalized, normalized)
    array = normalized.endswith("[]")
    if array:
        normalized = normalized[:-2]
    base = normalized.split("(")[0].strip()
    require(base in NATIVE, "FAKE_DJANGO_NATIVE_TYPE_UNSUPPORTED:" + sql_type)
    typename, display = NATIVE[base]
    size = normalized[len(base):].replace(" ", "")
    return {
        "name": name,
        "type_schema": "pg_catalog",
        "type_name": ("_" if array else "") + typename,
        "type_kind": "b",
        "postgres_type": display + size + ("[]" if array else ""),
        "not_null": not nullable,
        "identity": identity,
        "generated": "",
        "default_expression": default,
        "collation_default": True,
        "acl": None,
    }


class PhysicalCompiler:
    def __init__(self, mappings, auth_user_model="auth.User"):
        self.mappings = mappings
        self.auth_user_model = auth_user_model
        self.models = {}
        self.physical = {}
        self.unsupported = []
        self.provenance = []
        self.client_defaults = []
        self.sql_effects = []
        self.sql_indexes = []
        self.operation_count = 0
        self.current = None
        self.line = 0

    def ceiling(self, operation, reason, tables=None):
        self.unsupported.append(
            {
                "migration": self.current["MIGRATION_ID"],
                "file": self.current["SOURCE_FILE"],
                "line": self.line,
                "operation": operation,
                "reason": reason,
                "tables": tables or [],
            }
        )

    def model_key(self, name):
        return self.current["APP_LABEL"] + "." + name.lower()

    def field(self, name, declaration, trail=None):
        require(isinstance(declaration, dict) and "call" in declaration, "FIELD_CALL_REQUIRED")
        kind = declaration["call"].split(".")[-1]
        k = declaration["kwargs"]
        for flag in ("null", "primary_key", "unique", "db_index", "db_constraint"):
            require(flag not in k or type(k[flag]) is bool, "FIELD_BOOLEAN_LITERAL_REQUIRED")
        require("db_column" not in k or isinstance(k["db_column"], str),
                "FIELD_COLUMN_LITERAL_REQUIRED")
        require(not declaration["args"] or kind in ("ForeignKey", "OneToOneField", "ArrayField"),
                "POSITIONAL_FIELD_UNSUPPORTED")
        allowed_calls = {"models." + key for key in self.mappings["data_types"]}
        allowed_calls.update(("models.ForeignKey", "models.OneToOneField", "models.URLField",
                              "models.EmailField", "django.contrib.postgres.fields.ArrayField"))
        require(declaration["call"] in allowed_calls, "CUSTOM_FIELD_UNSUPPORTED:" + declaration["call"])
        require(not any(x in k for x in ("db_default", "db_collation", "generated")),
                "FIELD_DATABASE_EXPRESSION_UNSUPPORTED")
        relational = kind in ("ForeignKey", "OneToOneField")
        column = k.get("db_column") or name + ("_id" if relational else "")
        nullable = k.get("null", False)
        require(type(nullable) is bool, "FIELD_NULL_LITERAL_REQUIRED")
        if relational:
            target = k.get("to") or (declaration["args"][0] if declaration["args"] else None)
            if target == {"symbol": "settings.AUTH_USER_MODEL"}:
                target = self.auth_user_model
            require(isinstance(target, str), "FOREIGN_KEY_TARGET_UNSUPPORTED")
            if target == "self":
                target = self.model_key(self.active_model)
            elif "." not in target:
                target = self.current["APP_LABEL"] + "." + target
            target = target.lower()
            require(target in self.models, "FOREIGN_KEY_MODEL_UNRESOLVED:" + target)
            parent = self.models[target]
            parent_fields = parent["fields"]
            candidates = [fn for fn, f in parent_fields.items()
                          if f["kwargs"].get("primary_key", False)]
            to_field = k.get("to_field") or (candidates[0] if len(candidates) == 1 else None)
            require(to_field in parent_fields, "FOREIGN_KEY_PARENT_KEY_UNRESOLVED")
            require(to_field not in parent.get("unstable_reference_fields", []),
                    "FOREIGN_KEY_TEMPORAL_TARGET_MUTATION_UNSUPPORTED")
            trail = [*(trail or []), target + "." + to_field]
            require(len(trail) == len(set(trail)), "FOREIGN_KEY_TYPE_CYCLE")
            previous_model = self.active_model
            self.active_model = parent["name"]
            parent_column, _ = self.field(to_field, parent_fields[to_field], trail)
            self.active_model = previous_model
            sql_type = parent_column["postgres_type"]
            # Related auto fields use integer storage, not identity.
            sql_type = sql_type.replace("character varying", "varchar")
            physical_column = native_column(column, sql_type, nullable)
            return physical_column, {
                "target": target,
                "parent_table": parent["table"],
                "parent_column": parent_column["name"],
                "db_constraint": k.get("db_constraint", True),
                "on_delete": k.get("on_delete"),
                "one_to_one": kind == "OneToOneField",
            }
        if kind == "ArrayField":
            base = k.get("base_field") or (declaration["args"][0] if declaration["args"] else None)
            base_column, relation = self.field(name, base)
            require(relation is None and not k.get("size"), "ARRAY_DIMENSION_UNSUPPORTED")
            return native_column(column, base_column["postgres_type"].replace(
                "character varying", "varchar") + "[]", nullable), None
        internal = {"URLField": "CharField", "EmailField": "CharField"}.get(kind, kind)
        sql_type = self.mappings["data_types"].get(internal)
        require(sql_type is not None, "FIELD_TYPE_UNSUPPORTED:" + kind)
        if internal == "CharField":
            max_length = k.get("max_length", 200 if kind == "URLField" else
                               254 if kind == "EmailField" else None)
            require(max_length is None or type(max_length) is int and max_length > 0,
                    "VARCHAR_LENGTH_UNSUPPORTED")
            sql_type = "varchar" if max_length is None else "varchar(%s)" % max_length
        elif "%(" in sql_type:
            require(internal in ("DecimalField", "FileField", "FilePathField", "SlugField"),
                    "BACKEND_TEMPLATE_UNSUPPORTED")
            sql_type = sql_type % k
        return native_column(column, sql_type, nullable,
                             "d" if kind in ("AutoField", "BigAutoField", "SmallAutoField") else ""), None

    def apply(self, value, state=True, database=True):
        self.operation_count += 1
        require(isinstance(value, dict) and "call" in value, "DYNAMIC_OPERATION_UNSUPPORTED")
        call = value["call"]
        k = value["kwargs"]
        require(not value["args"], "POSITIONAL_OPERATION_UNSUPPORTED")
        if call == "migrations.SeparateDatabaseAndState":
            for op in k.get("database_operations", []):
                self.apply(op, state=False, database=database)
            for op in k.get("state_operations", []):
                self.apply(op, state=state, database=False)
            return
        if call == "migrations.RunSQL":
            if database:
                sql = k.get("sql")
                if isinstance(sql, dict) and "symbol" in sql:
                    sql = self.current["LITERAL_SQL_BINDINGS"].get(sql["symbol"])
                require(isinstance(sql, str), "RUNSQL_LITERAL_REQUIRED")
                self.apply_sql(sql)
            for op in k.get("state_operations", []):
                self.apply(op, state=state, database=False)
            return
        if call == "migrations.CreateModel":
            name = k["name"]
            key = self.model_key(name)
            options = k.get("options", {})
            require(k.get("bases", [{"symbol": "models.Model"}]) in (
                [{"symbol": "models.Model"}], []), "MODEL_INHERITANCE_UNSUPPORTED")
            require(not any(x in options for x in ("proxy", "managed",
                                                  "db_tablespace")), "MODEL_ROUTING_UNSUPPORTED")
            if "swappable" in options:
                require(options["swappable"] == "AUTH_USER_MODEL"
                        and key == self.auth_user_model.lower(), "MODEL_SWAPPED_OUT")
            require(len(k["fields"]) == len({n for n, _ in k["fields"]}),
                    "DUPLICATE_FIELD")
            model = {
                "name": name, "table": options.get("db_table", self.current["APP_LABEL"] + "_" + name.lower()),
                "fields": dict(k["fields"]), "options": options, "constraints": list(options.get("constraints", [])),
                "indexes": list(options.get("indexes", [])),
                "field_origins": {fn: self.origin() for fn, _ in k["fields"]},
                "app": self.current["APP_LABEL"],
                "field_name_columns": {fn: field_column_name(fn, field) for fn, field in k["fields"]},
            }
            require(key not in self.models, "DUPLICATE_MODEL")
            if state:
                self.models[key] = model
            if database:
                require(model["table"] not in self.physical, "DUPLICATE_TABLE")
                self.physical[model["table"]] = {
                    **model, "fields": dict(model["fields"]), "options": dict(options),
                    "constraints": list(model["constraints"]), "indexes": list(model["indexes"]),
                    "field_origins": dict(model["field_origins"]),
                    "field_name_columns": dict(model["field_name_columns"]),
                    "app": self.current["APP_LABEL"], "origin": self.origin(),
                }
            return
        name = k.get("model_name", k.get("name", ""))
        key = self.model_key(name)
        require(key in self.models, "MODEL_REQUIRED:" + key)
        model = self.models[key]
        physical = self.physical.get(model["table"])
        targets = ([model] if state else []) + ([physical] if database and physical else [])
        # Model state and physical declarations intentionally have distinct dictionaries.
        if call in ("migrations.AddField", "migrations.AlterField"):
            for target in targets:
                if call.endswith("AddField"):
                    require(k["name"] not in target["fields"], "DUPLICATE_COLUMN")
                else:
                    require(k["name"] in target["fields"], "ALTER_FIELD_REQUIRED")
                    previous = target["fields"][k["name"]]
                    # Resolving all FK types against final state is safe only
                    # while their target's physical identity remains stable.
                    physical_options = ("primary_key", "db_column", "max_length",
                                        "max_digits", "decimal_places", "to", "to_field")
                    if previous["call"] != k["field"]["call"] or any(
                        previous["kwargs"].get(option) != k["field"]["kwargs"].get(option)
                        for option in physical_options
                    ):
                        target.setdefault("unstable_reference_fields", []).append(k["name"])
                target["fields"][k["name"]] = k["field"]
                target["field_origins"][k["name"]] = self.origin()
                target["field_name_columns"].setdefault(k["name"],
                                                        field_column_name(k["name"], k["field"]))
        elif call == "migrations.RenameField":
            for target in targets:
                require(k["old_name"] in target["fields"] and k["new_name"] not in target["fields"],
                        "RENAME_FIELD_REQUIRED")
                target.setdefault("unstable_reference_fields", []).extend(
                    [k["old_name"], k["new_name"]])
                target["fields"] = {
                    (k["new_name"] if fn == k["old_name"] else fn): f
                    for fn, f in target["fields"].items()
                }
                target["field_origins"][k["new_name"]] = self.origin()
                del target["field_origins"][k["old_name"]]
                target["field_name_columns"][k["new_name"]] = target["field_name_columns"].pop(k["old_name"])
                for member in ("indexes", "constraints"):
                    for definition in target[member]:
                        if "fields" in definition["kwargs"]:
                            definition["kwargs"]["fields"] = [
                                ("-" if fn.startswith("-") else "") + k["new_name"]
                                if fn.lstrip("-") == k["old_name"] else fn
                                for fn in definition["kwargs"]["fields"]
                            ]
        elif call == "migrations.RemoveField":
            for target in targets:
                require(k["name"] in target["fields"], "REMOVE_FIELD_REQUIRED")
                del target["fields"][k["name"]]
                del target["field_origins"][k["name"]]
                del target["field_name_columns"][k["name"]]
        elif call in ("migrations.AddIndex", "migrations.AddConstraint"):
            member = "indexes" if call.endswith("AddIndex") else "constraints"
            for target in targets:
                target[member].append(k["index" if member == "indexes" else "constraint"])
        elif call in ("migrations.RemoveIndex", "migrations.RemoveConstraint"):
            member = "indexes" if call.endswith("RemoveIndex") else "constraints"
            for target in targets:
                old = target[member]
                target[member] = [v for v in old if v["kwargs"].get("name") != k["name"]]
                require(len(old) != len(target[member]), "REMOVE_KEY_REQUIRED")
        elif call == "migrations.AlterModelOptions":
            if state:
                model["options"].update(k["options"])
        elif call == "migrations.AlterUniqueTogether":
            for target in targets:
                target["options"]["unique_together"] = k["unique_together"]
        else:
            raise ValueError("OPERATION_UNSUPPORTED:" + call)
        if physical and database:
            physical["last_origin"] = self.origin()

    def origin(self):
        return {
            "migration": self.current["MIGRATION_ID"],
            "file": self.current["SOURCE_FILE"],
            "sha256": self.current["FILE_SHA256"],
            "line": self.line,
        }

    def apply_sql(self, sql):
        effect = {"source": sql, "sha256": digest(sql.encode()),
                  "origin": self.origin(), "modeled": False}
        self.sql_effects.append(effect)
        # Source-pinned DO block: only its fresh, empty, no-legacy-column branch.
        # Never synthesize the populated/backfill or preexisting-schema branches.
        if effect["sha256"] == "b0a12dfb56f0261c5dddb3eaef2262f9cf56931ba1b71b483d24648b26195c1c":
            require("automation_rules" in self.physical, "GUARD_UNDEFINED_TABLE")
            model = self.physical["automation_rules"]
            require(not any(n in model["fields"] or n in model.get("sql_columns", {})
                            for n in ("org_id", "organization_id")), "GUARD_BRANCH_UNSUPPORTED")
            branch = re.search(
                r"ADD COLUMN organization_id varchar\(255\) NOT NULL;", sql)
            require(branch is not None, "GUARD_ADD_BRANCH_REQUIRED")
            model.setdefault("sql_columns", {})["organization_id"] = native_column(
                "organization_id", "varchar(255)", False)
            self.sql_indexes.append(self.make_index(
                "automation_rules", ["organization_id"], "idx_automation_rules_org"))
            effect["modeled"] = True
            effect["branch"] = "FRESH_EMPTY_NO_LEGACY_COLUMN"
            return
        uncommented = re.sub(r"--[^\n]*", "", sql).strip()
        for statement in split_literals(uncommented, ";"):
            if re.fullmatch(r"SELECT\s+1", statement, re.I):
                continue
            index = re.fullmatch(
                r"CREATE INDEX IF NOT EXISTS ([a-z_][a-z0-9_]*)\s+ON "
                r"([a-z_][a-z0-9_]*)\s*\(([^()]+)\)", statement, re.I)
            if index:
                name, table, fields = index.groups()
                require(table in self.physical, "RUNSQL_INDEX_TABLE_REQUIRED")
                columns = [s.strip() for s in fields.split(",")]
                require(all(re.fullmatch(r"[a-z_][a-z0-9_]*", c) for c in columns),
                        "RUNSQL_INDEX_EXPRESSION_UNSUPPORTED")
                self.sql_indexes.append(self.make_index(table, columns, name))
                continue
            create = re.fullmatch(
                r"CREATE TABLE IF NOT EXISTS ([a-z_][a-z0-9_]*)\s*\((.*)\)",
                statement, re.I | re.S)
            if create:
                table, body = create.groups()
                if table not in self.physical:
                    columns = [parse_sql_column(part) for part in split_literals(body, ",")]
                    require(len(columns) == len({c["column"]["name"] for c in columns}),
                            "RUNSQL_DUPLICATE_COLUMN")
                    self.physical[table] = {
                        "name": table, "table": table, "fields": {}, "field_origins": {},
                        "field_name_columns": {},
                        "options": {}, "constraints": [], "indexes": [],
                        "app": self.current["APP_LABEL"], "origin": self.origin(),
                        "sql_columns": {c["column"]["name"]: c["column"] for c in columns},
                        "sql_pk": [c["column"]["name"] for c in columns if c["primary"]],
                    }
                continue
            alter = re.fullmatch(
                r"ALTER TABLE ([a-z_][a-z0-9_]*)\s+(.*)", statement, re.I | re.S)
            require(alter is not None, "RUNSQL_PHYSICAL_SEMANTICS_UNSUPPORTED")
            table, body = alter.groups()
            require(table in self.physical, "RUNSQL_TABLE_REQUIRED:" + table)
            physical = self.physical[table]
            for part in split_literals(body, ","):
                add = re.fullmatch(r"ADD COLUMN IF NOT EXISTS\s+(.*)", part, re.I | re.S)
                require(add is not None, "RUNSQL_ALTER_UNSUPPORTED")
                parsed = parse_sql_column(add[1])
                require(not parsed["primary"], "RUNSQL_ADD_PK_UNSUPPORTED")
                column = parsed["column"]
                existing = [
                    f["kwargs"].get("db_column") or fn + (
                        "_id" if f["call"].split(".")[-1] in ("ForeignKey", "OneToOneField") else "")
                    for fn, f in physical["fields"].items()
                ]
                overrides = physical.setdefault("sql_columns", {})
                if column["name"] not in existing and column["name"] not in overrides:
                    overrides[column["name"]] = column
        effect["modeled"] = True

    def run(self, sources):
        for source in sources:
            self.current = source
            for operation in source["OPERATIONS"]:
                self.line = operation["LINE"]
                before = len(self.unsupported)
                effects_before = len(self.sql_effects)
                value = operation["VALUE"]
                if value.get("call") in ("migrations.SeparateDatabaseAndState", "migrations.RunSQL"):
                    saved = copy.deepcopy((self.models, self.physical, self.sql_indexes))
                else:
                    saved = (dict(self.models), dict(self.physical), list(self.sql_indexes))
                    key = self.model_key(value.get("kwargs", {}).get(
                        "model_name", value.get("kwargs", {}).get("name", "")))
                    if key in self.models:
                        self.models[key] = copy.deepcopy(self.models[key])
                        table = self.models[key]["table"]
                        if table in self.physical:
                            self.physical[table] = copy.deepcopy(self.physical[table])
                try:
                    self.apply(operation["VALUE"])
                except (ValueError, KeyError, TypeError) as error:
                    self.models, self.physical, self.sql_indexes = saved
                    for effect in self.sql_effects[effects_before:]:
                        effect["modeled"] = False
                        effect["rolledBack"] = True
                    value = operation["VALUE"]
                    name = value.get("kwargs", {}).get("model_name", "")
                    model = self.models.get(self.model_key(name))
                    tables = [model["table"]] if model else []
                    self.ceiling(value.get("call", "expression"), str(error), tables)
                self.provenance.append({**self.origin(), "supported": before == len(self.unsupported)})
        return self.render()

    def render(self):
        tables, indexes, foreign_keys, installs = [], list(self.sql_indexes), [], []
        for table_name, model in self.physical.items():
            self.active_model = model["name"]
            self.current = {
                "MIGRATION_ID": model["origin"]["migration"],
                "SOURCE_FILE": model["origin"]["file"],
                "FILE_SHA256": model["origin"]["sha256"],
                "APP_LABEL": model["app"],
            }
            self.line = model["origin"]["line"]
            columns, pk, uniques, checks = [], list(model.get("sql_pk", [])), [], []
            if not pk and not any(f["kwargs"].get("primary_key") is True
                                  for f in model["fields"].values()):
                self.ceiling("model", "IMPLICIT_PRIMARY_KEY_UNSUPPORTED", [table_name])
            names = {}
            for name, declaration in model["fields"].items():
                try:
                    if declaration["call"] == "models.ManyToManyField":
                        self.ceiling("field:" + name, "MANY_TO_MANY_THROUGH_TABLE_UNSUPPORTED",
                                     [table_name + "_" + name])
                        continue
                    column, relation = self.field(name, declaration)
                    original_column = model["field_name_columns"][name]
                    require(column["name"] not in names.values(), "DUPLICATE_PHYSICAL_COLUMN")
                    names[name] = column["name"]
                    columns.append(column)
                    k = declaration["kwargs"]
                    if "default" in k:
                        self.client_defaults.append({"table": table_name, "column": column["name"],
                                                     "declaration": k["default"],
                                                     "origin": model["field_origins"][name]})
                    if k.get("primary_key", False):
                        column["not_null"] = True
                        pk.append(column["name"])
                    elif k.get("unique", False) or relation and relation["one_to_one"]:
                        uniques.append({"name": None, "columns": [column["name"]]})
                    if k.get("db_index", relation is not None) and not (
                        k.get("unique") or k.get("primary_key") or relation and relation["one_to_one"]
                    ):
                        indexes.append(self.make_index(table_name, [column["name"]],
                                                       index_name(table_name, [original_column], "")))
                    if column["type_name"] in ("varchar", "text") and (
                        k.get("db_index", relation is not None) or k.get("unique")
                        or k.get("primary_key") or relation and relation["one_to_one"]
                    ):
                        opclass = column["type_name"] + "_pattern_ops"
                        pattern = self.make_index(table_name, [column["name"]],
                                                  index_name(table_name, [original_column], "_like"))
                        pattern["opclasses_default"] = False
                        pattern["key_definitions"] = [column["name"] + " " + opclass]
                        indexes.append(pattern)
                    kind = declaration["call"].split(".")[-1]
                    check = self.mappings["data_type_check_constraints"].get(kind)
                    if check:
                        expression = check % {"column": column["name"]}
                        checks.append({"name": index_name(table_name, [original_column], "_check"),
                                       "expression": expression})
                    if relation and relation["db_constraint"]:
                        foreign_keys.append({
                            "schema": "public", "table": table_name,
                            "name": index_name(table_name, [original_column],
                                               "_fk_%s_%s" % (relation["parent_table"], relation["parent_column"])),
                            "kind": "f", "columns": [column["name"]],
                            "parent_schema": "public", "parent_name": relation["parent_table"],
                            "parent_columns": [relation["parent_column"]],
                            # Django on_delete is client Collector behavior, not SQL CASCADE.
                            "delete_action": "a", "update_action": "a", "match": "s",
                            "validated": True, "deferrable": True, "deferred": True,
                            "local": True, "inherited": 0,
                        })
                except (ValueError, KeyError, TypeError) as error:
                    self.ceiling("field:" + name, str(error), [table_name])
            columns.extend(model.get("sql_columns", {}).values())
            require(len(columns) == len({c["name"] for c in columns}), "DUPLICATE_RENDERED_COLUMN")
            # Django Options.get_field() accepts a FK attname as well as field.name.
            names.update({c["name"]: c["name"] for c in columns})
            for constraint in model["constraints"]:
                k = constraint["kwargs"]
                if constraint["call"] != "models.UniqueConstraint" or set(k) != {"fields", "name"}:
                    self.ceiling("constraint", "CONSTRAINT_EXPRESSION_UNSUPPORTED", [table_name])
                    continue
                try:
                    uniques.append({"name": k["name"], "columns": [names[n] for n in k["fields"]]})
                except KeyError:
                    self.ceiling("constraint", "CONSTRAINT_COLUMN_REQUIRED", [table_name])
            for group in model["options"].get("unique_together", []):
                try:
                    cols = [names[n] for n in group]
                    uniques.append({"name": index_name(table_name, cols, "_uniq"), "columns": cols})
                except KeyError:
                    self.ceiling("unique_together", "UNIQUE_COLUMN_REQUIRED", [table_name])
            for index in model["indexes"]:
                k = index["kwargs"]
                if index["call"] != "models.Index" or set(k) - {"fields", "name"}:
                    self.ceiling("index", "INDEX_EXPRESSION_UNSUPPORTED", [table_name])
                    continue
                try:
                    cols = [names[n.lstrip("-")] for n in k["fields"]]
                    row = self.make_index(table_name, cols, k["name"])
                    row["options"] = [3 if n.startswith("-") else 0 for n in k["fields"]]
                    row["key_definitions"] = [
                        col + (" DESC" if option else "") for col, option in zip(cols, row["options"])
                    ]
                    indexes.append(row)
                except KeyError:
                    self.ceiling("index", "INDEX_COLUMN_REQUIRED", [table_name])
            table = {
                "schema": "public", "name": table_name, "kind": "r", "standalone": True,
                "enabled": False, "forced": False, "rowCountVisible": True,
                "columns": columns, "rows": [], "policies": [], "primaryKey": pk,
                "uniqueConstraints": uniques,
                "checkConstraints": [
                    {**check, "columns": [name for name in names.values()
                                         if quote(name) in check["expression"]]}
                    for check in checks
                ],
            }
            tables.append(table)
            self.provenance.extend(
                {**origin, "table": table_name, "column": names[fn], "supported": True}
                for fn, origin in model["field_origins"].items() if fn in names)
        for index in indexes:
            table = next(t for t in tables if t["name"] == index["table_name"])
            require(set(index["columns"]) <= {c["name"] for c in table["columns"]},
                    "COMPILED_INDEX_COLUMN_REQUIRED")
            installs.append("CREATE INDEX %s ON %s (%s);" % (
                quote(index["name"]), quote(index["table_name"]), ", ".join(
                    quote(col) + (" DESC" if opt else "") + (
                        " " + definition.split(" ")[-1] if not index["opclasses_default"] else "")
                    for col, opt, definition in zip(index["columns"], index["options"],
                                                     index["key_definitions"]))))
        for fk in foreign_keys:
            installs.append(
                "ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (%s) "
                "DEFERRABLE INITIALLY DEFERRED;" % (
                    quote(fk["table"]), quote(fk["name"]), quote(fk["columns"][0]),
                    quote(fk["parent_name"]), quote(fk["parent_columns"][0])))
        return {"tables": tables, "indexes": indexes, "foreignKeys": foreign_keys,
                "catalogInstallSql": installs, "unsupported": self.unsupported,
                "provenance": self.provenance, "clientDefaults": self.client_defaults,
                "sqlEffects": self.sql_effects, "operationCount": self.operation_count}

    @staticmethod
    def make_index(table, columns, name):
        return {
            "schema": "public", "name": name, "table_schema": "public", "table_name": table,
            "kind": "i", "method": "btree", "unique": False, "valid": True,
            "ready": True, "live": True, "primary": False, "exclusion": False,
            "nulls_not_distinct": False, "predicate": None, "expressions": None,
            "key_count": len(columns), "total_count": len(columns), "columns": columns,
            "options": [0] * len(columns), "key_definitions": columns,
            "opclasses_default": True, "collations_default": True,
        }


def quote(name):
    require(isinstance(name, str) and "\x00" not in name, "IDENTIFIER_REQUIRED")
    return '"' + name.replace('"', '""') + '"'


def field_column_name(name, field):
    return field["kwargs"].get("db_column") or name + (
        "_id" if field["call"] in ("models.ForeignKey", "models.OneToOneField") else "")


def split_literals(source, separator):
    parts, start, depth, quoted, index = [], 0, 0, False, 0
    while index < len(source):
        char = source[index]
        if char == "'":
            if quoted and index + 1 < len(source) and source[index + 1] == "'":
                index += 2
                continue
            quoted = not quoted
        elif not quoted:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                require(depth >= 0, "SQL_PARENTHESIS")
            elif char == separator and depth == 0:
                parts.append(source[start:index].strip())
                start = index + 1
        index += 1
    require(not quoted and depth == 0, "SQL_LITERAL_BALANCE")
    parts.append(source[start:].strip())
    return [s for s in parts if s]


def parse_sql_column(source):
    match = re.fullmatch(
        r"([a-z_][a-z0-9_]*)\s+"
        r"(uuid|text|integer|bigint|jsonb|timestamptz|varchar\(\d+\))"
        r"(\s+PRIMARY KEY|\s+NOT NULL)?"
        r"(?:\s+DEFAULT (now\(\)|gen_random_uuid\(\)|\d+|'(?:[^']|'')*'))?",
        source.strip(), re.I)
    require(match is not None, "RUNSQL_COLUMN_DEFINITION_UNSUPPORTED")
    name, sql_type, modifier, default = match.groups()
    return {"column": native_column(name, sql_type, modifier is None, default=default),
            "primary": modifier is not None and modifier.strip().upper() == "PRIMARY KEY"}


def compile_baseline(root, wheelhouse):
    lock, sources, mappings, unsupported, lock_hash = load_sources(root, wheelhouse)
    compiler = PhysicalCompiler(mappings, lock["swappableConfiguration"]["AUTH_USER_MODEL"])
    result = compiler.run(sources)
    result["unsupported"] = unsupported + result["unsupported"]
    result["authority"] = {
        "scope": "OFFLINE_SOURCE_BOUND_PHYSICAL_SUBSET",
        "lockSha256": lock_hash,
        "djangoWheelSha256": DJANGO_WHEEL_SHA256,
        "backendSha256": BACKEND_SHA256,
        "authenticatedWheels": 87,
        "authenticatedLocalSources": sum(n["SOURCE_CLASS"] == "LOCAL" for n in sources),
        "authenticatedExternalSources": 53,
        "fullDjangoGraphVerified": False,
        "sourceExecuted": False,
        "djangoInitialized": False,
        "emptyInitialTables": True,
        "implicitKeyIndexNamesModeled": False,
    }
    return result


if __name__ == "__main__":
    require(not sys.argv[1:], "Use stdin JSON only")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    request = json.load(sys.stdin)
    require(set(request) == {"repositoryRoot", "wheelhouse"}, "FAKE_DJANGO_REQUEST_KEYS")
    print(json.dumps(compile_baseline(request["repositoryRoot"], request["wheelhouse"]),
                     ensure_ascii=False, allow_nan=False))
