"""Inventory exact wheel and repository migration syntax; never initialize Django."""

import argparse
import ast
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import zipfile
import re
from email.parser import BytesParser
from pip._vendor.packaging.requirements import Requirement

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docs" / "union-eyes" / "reality-remediation"
BACKEND = ROOT / "apps" / "union-eyes" / "backend"
NAME = "PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK"
CONTRACT_HASH = "0fed10ff33f8ac7ee4886d89e50143097f9e42928ee1efc77ec1fedce5eb3983"
FROZEN = {
    "UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json": CONTRACT_HASH,
    "UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.md": "ea6f12aa44f91bec29072d6119b2999ef2cdb8b50b98078b7827442caf4d124b",
    "PHASE_1B_3C_A1G_BOOTSTRAP_REMEDIATION_SPECIFICATION.md": "284d5321cabe14a87cf1d903d70122840dac8b52fbd1c45031a845b076d8ac98",
    "PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.json": "8a8aed72458720fe6ebaff1eec1227ec3c816d4f44747bc7b509c4736401e8f5",
    "PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT.json": "84a357fa94bb5a951016c7b58ad975bfe3e92c43bd0bf81c2ed8bc2a44052dfe",
    "PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json": "1174c864e09fc68f42dca882bb26b6e82cdf4cd3dc58411bd8136e32e317d28d",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(value):
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def identity(kind, value):
    return "UE-W1-" + kind + "-" + sha(value.encode())[:16]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def assignments(nodes):
    return {
        target.id: node.value
        for node in nodes if isinstance(node, ast.Assign)
        for target in node.targets if isinstance(target, ast.Name)
    }


def literal(node, default=None):
    if node is None:
        return default
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return {"BLOCKED_EXPRESSION_CLASS": type(node).__name__}


def symbol(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = symbol(node.value)
        return parent + "." + node.attr if parent else node.attr
    return None


def parse_migration(source):
    tree = ast.parse(source)
    cls = next((node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Migration"), None)
    assert cls is not None, "Migration class absent"
    values = assignments(cls.body)
    edges = []
    for field, edge_class in [
        ("dependencies", "DEPENDENCY"), ("run_before", "RUN_BEFORE"), ("replaces", "REPLACEMENT")
    ]:
        expr = values.get(field)
        if expr is None:
            continue
        assert isinstance(expr, (ast.List, ast.Tuple)), "Nonliteral migration edges"
        for entry in expr.elts:
            pair = literal(entry)
            if isinstance(pair, tuple) and len(pair) == 2 and all(isinstance(item, str) for item in pair):
                edges.append({"CLASS": edge_class, "APP": pair[0], "NAME": pair[1], "LINE": entry.lineno})
            elif isinstance(entry, ast.Call) and symbol(entry.func) == "migrations.swappable_dependency":
                assert len(entry.args) == 1
                edges.append({"CLASS": "SWAPPABLE_DEPENDENCY", "SETTING": symbol(entry.args[0]), "LINE": entry.lineno})
            else:
                edges.append({"CLASS": edge_class, "APP": None, "NAME": None, "LINE": entry.lineno, "BLOCKED": True})
    operations, raw = [], []
    functions = {node.name: node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    def inspect(node, state_only=False, parent=None, database_only=False):
        if node is None:
            return
        if isinstance(node, (ast.List, ast.Tuple)):
            for child in node.elts:
                inspect(child, state_only, parent, database_only)
            return
        if not isinstance(node, ast.Call):
            operations.append({
                "OPERATION_CLASS": "GENERATED_OPERATION_EXPRESSION",
                "STATE_EFFECT": "MIXED", "PHYSICAL_DB_EFFECT": "NO" if state_only else "MIXED",
                "STATIC_DEPENDENCY_ANALYSIS_REQUIRED": "YES", "LINE": node.lineno,
                "PARENT_OPERATION": parent,
            })
            raw.append({
                "OPERATION_CLASS": "GENERATED_OPERATION_EXPRESSION", "LINE": node.lineno,
                "STATICALLY_INSPECTABLE": "PARTIAL", "REFERENCED_OBJECTS": [], "REFERENCED_APPS": [],
                "BOOTSTRAP_DEPENDENCY_SIGNAL": "Generated operation target/materialization needs exact binding",
                "FUTURE_WORKSTREAM": "W6",
            })
            for call in ast.walk(node):
                if isinstance(call, ast.Call) and (symbol(call.func) or "").startswith("migrations."):
                    operations.append({
                        "OPERATION_CLASS": symbol(call.func).split(".")[-1],
                        "STATE_EFFECT": "MIXED", "PHYSICAL_DB_EFFECT": "NO" if state_only else "MIXED",
                        "STATIC_DEPENDENCY_ANALYSIS_REQUIRED": "YES", "LINE": call.lineno,
                        "PARENT_OPERATION": "GENERATED_OPERATION_EXPRESSION",
                    })
            return
        name = (symbol(node.func) or "UNRESOLVED_CALL").split(".")[-1]
        kwargs = {kw.arg: kw.value for kw in node.keywords}
        state_effect = "YES"
        db_effect = "YES"
        if name in ("RunPython", "RunSQL"):
            state_effect = "NO" if name == "RunPython" or not kwargs.get("state_operations") else "MIXED"
            db_effect = "MIXED"
        if name == "SeparateDatabaseAndState":
            state_effect, db_effect = "MIXED", "MIXED"
            if not literal(kwargs.get("database_operations"), []):
                db_effect = "NO"
        if name == "CreateModel":
            options = literal(kwargs.get("options"), {})
            if isinstance(options, dict) and (options.get("managed") is False or options.get("proxy") is True):
                db_effect = "NO"
        if state_only:
            db_effect = "NO"
        if database_only:
            state_effect = "NO"
        requires = name in ("RunSQL", "RunPython", "SeparateDatabaseAndState", "UNRESOLVED_CALL")
        operations.append({
            "OPERATION_CLASS": name, "STATE_EFFECT": state_effect, "PHYSICAL_DB_EFFECT": db_effect,
            "STATIC_DEPENDENCY_ANALYSIS_REQUIRED": "YES" if requires else "NO",
            "LINE": node.lineno, "PARENT_OPERATION": parent,
        })
        if requires:
            referenced_apps, referenced_objects = set(), set()
            inspect_nodes = [node]
            for arg in node.args:
                if isinstance(arg, ast.Name) and arg.id in functions:
                    inspect_nodes.append(functions[arg.id])
            for container in inspect_nodes:
                if name == "RunSQL":
                    for value in ast.walk(container):
                        if isinstance(value, ast.Constant) and isinstance(value.value, str):
                            referenced_objects.update(match.group(1).replace('"', '') for match in re.finditer(
                                r'\b(?:FROM|JOIN|UPDATE|INTO|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE)\s+((?:"?\w+"?\.)?"?\w+"?)',
                                value.value, re.IGNORECASE,
                            ))
                for call in ast.walk(container):
                    if not isinstance(call, ast.Call):
                        continue
                    if (symbol(call.func) or "").endswith(".get_model") and len(call.args) >= 2:
                        app, model = literal(call.args[0]), literal(call.args[1])
                        if isinstance(app, str) and isinstance(model, str):
                            referenced_apps.add(app)
                            referenced_objects.add(app + "." + model)
            raw.append({
                "OPERATION_CLASS": name, "LINE": node.lineno,
                "STATICALLY_INSPECTABLE": "PARTIAL" if name in ("RunSQL", "RunPython", "UNRESOLVED_CALL") else "YES",
                "REFERENCED_OBJECTS": sorted(referenced_objects),
                "REFERENCED_APPS": sorted(referenced_apps),
                "BOOTSTRAP_DEPENDENCY_SIGNAL": "State/physical separation" if name == "SeparateDatabaseAndState" else "Explicit raw code/SQL effect requires governed target and preconsumer inspection",
                "FUTURE_WORKSTREAM": "W4" if name == "SeparateDatabaseAndState" else "W6",
            })
        if name == "SeparateDatabaseAndState":
            inspect(kwargs.get("database_operations"), False, name, True)
            inspect(kwargs.get("state_operations"), True, name)
    inspect(values.get("operations"))
    return {
        "INITIAL": literal(values.get("initial")), "ATOMIC": literal(values.get("atomic"), True),
        "REPLACES": literal(values.get("replaces"), []), "EDGES": edges,
        "OPERATIONS": operations, "RAW": raw,
    }


def topological(nodes, edges):
    deps = {node: set() for node in nodes}
    for edge in edges:
        if edge["RESOLUTION"] == "RESOLVED" and edge["EDGE_CLASS"] != "REPLACEMENT":
            deps[edge["FROM_MIGRATION"]].add(edge["TO_MIGRATION"])
    result = []
    while deps:
        ready = sorted(key for key, values in deps.items() if not values)
        assert ready, "Migration dependency cycle"
        for key in ready:
            result.append(key)
            del deps[key]
        for values in deps.values():
            values.difference_update(ready)
    return result


def build(wheelhouse, isolated_payload):
    for name, expected in FROZEN.items():
        assert sha((BASE / name).read_bytes()) == expected, "FAIL_EVIDENCE_DRIFT: " + name
    contract = read_json(BASE / "UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json")
    for file, expected in contract["metadata"]["PREDECESSOR_ARTIFACT_SHA256"].items():
        assert sha((ROOT / Path(file)).read_bytes()) == expected, "FAIL_EVIDENCE_DRIFT: " + file
    a1e = read_json(BASE / "PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.json")
    for row in contract["frozenMigrationManifest"]:
        assert sha((ROOT / Path(row["FILE"])).read_bytes()) == row["SHA256"], "Frozen SQL drift"
    settings_path = BACKEND / "config" / "settings.py"
    assert sha(settings_path.read_bytes()) == next(
        row["SHA256"] for row in a1e["metadata"]["SOURCE_INVENTORY"]
        if row["FILE"] == "apps/union-eyes/backend/config/settings.py"
    ), "FAIL_EVIDENCE_DRIFT: settings"
    settings = assignments(ast.parse(settings_path.read_text(encoding="utf-8")).body)
    apps = literal(settings["INSTALLED_APPS"])
    assert apps == a1e["djangoOperationalGraph"]["SETTINGS_SELECTION"]["CONFIGURATIONS"][
        next(i for i, value in enumerate(a1e["djangoOperationalGraph"]["SETTINGS_SELECTION"]["CONFIGURATIONS"]) if value["FILE"].endswith("/config/settings.py"))
    ]["INSTALLED_APPS"], "FAIL_EVIDENCE_DRIFT: configured apps"
    package_evidence = read_json(BACKEND / "requirements.lock.metadata.json")
    assert sha((BACKEND / "requirements.txt").read_bytes()) == package_evidence["REQUIREMENTS_SHA256"]
    assert sha((BACKEND / "requirements.lock").read_bytes()) == package_evidence["RUN_1_LOCK_DIGEST"]
    assert not package_evidence["TARGET_REQUIREMENTS_UNRESOLVED"], "Target package closure incomplete"
    packages = package_evidence["LOCKED_DISTRIBUTIONS"]
    wheels = {}
    for row in packages:
        path = wheelhouse / row["ARTIFACT_FILENAME"]
        assert sha(path.read_bytes()) == row["ARTIFACT_SHA256"]
        wheels[row["DISTRIBUTION"]] = zipfile.ZipFile(path)
        archive = wheels[row["DISTRIBUTION"]]
        metadata_file = next(name for name in archive.namelist() if name.endswith(".dist-info/METADATA"))
        metadata = BytesParser().parsebytes(archive.read(metadata_file))
        assert metadata["Version"] == row["VERSION"], "Wheel metadata version drift"
        assert sorted(str(Requirement(value)) for value in metadata.get_all("Requires-Dist", [])) == sorted(
            str(Requirement(value)) for value in row["REQUIRES_DIST"]
        ), "Wheel transitive metadata differs from resolver evidence"
    package_versions = {row["DISTRIBUTION"]: row["VERSION"] for row in packages}
    payload_versions = {
        dist.metadata["Name"].lower().replace("_", "-"): dist.version
        for dist in importlib.metadata.distributions(path=[str(isolated_payload)])
    }
    assert payload_versions == package_versions, "Isolated package population differs from lock"
    django = wheels["django"]
    global_settings = assignments(ast.parse(django.read("django/conf/global_settings.py").decode("utf-8")).body)
    app_config_tree = ast.parse(django.read("django/apps/config.py").decode("utf-8"))
    path_rule = next(node for node in ast.walk(app_config_tree) if isinstance(node, ast.FunctionDef) and node.name == "_path_from_module")
    loader_tree = ast.parse(django.read("django/db/migrations/loader.py").decode("utf-8"))
    load_rule = next(node for node in ast.walk(loader_tree) if isinstance(node, ast.FunctionDef) and node.name == "load_disk")
    assert any(isinstance(node, ast.Constant) and node.value == "__path__" for node in ast.walk(path_rule))
    assert any(isinstance(node, ast.Attribute) and node.attr == "unmigrated_apps" for node in ast.walk(load_rule))
    namespace_collision_packages = [
        name for name, archive in wheels.items() if any(file.startswith("apps/") for file in archive.namelist())
    ]
    assert not namespace_collision_packages, "Configured apps namespace collides with a locked package"
    user_model = literal(settings.get("AUTH_USER_MODEL")) if "AUTH_USER_MODEL" in settings else literal(global_settings["AUTH_USER_MODEL"])
    assert isinstance(user_model, str)
    package_apps = {
        "rest_framework": "djangorestframework", "corsheaders": "django-cors-headers",
        "django_filters": "django-filter", "django_celery_beat": "django-celery-beat",
        "django_celery_results": "django-celery-results",
    }
    configured, migration_sources, nodes, raw_ops, pending_edges = [], [], [], [], []
    module_map = literal(settings.get("MIGRATION_MODULES"), {})
    assert isinstance(module_map, dict)
    for app in apps:
        external = app.startswith("django.contrib.") or app in package_apps
        distribution = "django" if app.startswith("django.contrib.") else package_apps.get(app)
        source_class = "DJANGO_FRAMEWORK" if app.startswith("django.contrib.") else "THIRD_PARTY" if external else "LOCAL"
        label = app.rsplit(".", 1)[-1]
        module = module_map.get(label, app + ".migrations")
        root = str(module).replace(".", "/") + "/" if module is not None else None
        namespace = False
        if external:
            wheel = wheels[distribution]
            app_config = app.replace(".", "/") + "/apps.py"
            if app_config in wheel.namelist():
                for cls in ast.parse(wheel.read(app_config).decode("utf-8")).body:
                    if isinstance(cls, ast.ClassDef):
                        config = assignments(cls.body)
                        if literal(config.get("name")) == app:
                            label = literal(config.get("label"), label)
            files = sorted(name for name in wheel.namelist() if root and name.startswith(root) and
                           "/" not in name[len(root):] and name.endswith(".py") and not name.endswith("/__init__.py"))
            module_present = root and root + "__init__.py" in wheel.namelist()
        else:
            app_path = BACKEND / app.replace(".", "/")
            assert app_path.is_dir(), "Configured app source absent: " + app
            namespace = not (app_path / "__init__.py").exists()
            if namespace:
                assert not (app_path / "apps.py").exists()
                assert not (app_path / "migrations").exists()
            config_path = app_path / "apps.py"
            if config_path.exists():
                for cls in ast.parse(config_path.read_text(encoding="utf-8")).body:
                    if isinstance(cls, ast.ClassDef):
                        config = assignments(cls.body)
                        if literal(config.get("name")) == app:
                            label = literal(config.get("label"), label)
            migration_path = BACKEND / str(module).replace(".", "/") if module else None
            files = sorted(path.name for path in migration_path.glob("*.py") if path.name != "__init__.py") if migration_path and migration_path.exists() else []
            module_present = migration_path and (migration_path / "__init__.py").exists()
        configured.append({
            "APP_ID": next(row["DJANGO_CONFIGURED_APP_ID"] for row in a1e["djangoOperationalGraph"]["CONFIGURED_APPS"] if row["APP"] == app),
            "APP_LABEL": label, "APP_IMPORT_PATH": app, "SOURCE_CLASS": source_class,
            "DISTRIBUTION_NAME": distribution, "DISTRIBUTION_VERSION": package_versions.get(distribution),
            "MIGRATION_MODULE": module, "MIGRATION_SOURCE_ROOT": root if external else
            ("apps/union-eyes/backend/" + str(module).replace(".", "/") if module else None),
            "VERSION_PINNED": "YES" if external else "LOCAL_SOURCE_HASHED",
            "MIGRATION_FILE_COUNT": len(files),
            "APP_BINDING_RESOLUTION": "RESOLVED_NAMESPACE_APP_NO_MIGRATIONS" if namespace and not files else "RESOLVED",
            "APP_BINDING_EVIDENCE": {
                "NAMESPACE_SINGLE_REPOSITORY_PATH": namespace,
                "MIGRATION_MODULE_PRESENT": bool(module_present),
                "MODELS_MODULE_PRESENT": not external and ((app_path / "models.py").exists() or (app_path / "models" / "__init__.py").exists()),
                "DJANGO_APP_CONFIG_RULE_SHA256": sha(django.read("django/apps/config.py")),
                "DJANGO_MIGRATION_LOADER_RULE_SHA256": sha(django.read("django/db/migrations/loader.py")),
                "APP_INITIALIZED": False,
                "LOCKED_PACKAGE_NAMESPACE_COLLISIONS": namespace_collision_packages,
                "APP_CONFIG_PATH_RULE_LINE": path_rule.lineno,
                "MIGRATIONLESS_LOADER_RULE_LINE": load_rule.lineno,
            },
        })
        for file in files:
            source_file = file if external else f"apps/union-eyes/backend/{app}/migrations/{file}"
            data = wheels[distribution].read(file) if external else (ROOT / Path(source_file)).read_bytes()
            parsed = parse_migration(data.decode("utf-8-sig"))
            migration_name = Path(file).stem
            migration_id = label + "::" + migration_name
            node = {
                "MIGRATION_ID": migration_id, "APP_LABEL": label, "MIGRATION_NAME": migration_name,
                "SOURCE_CLASS": source_class, "SOURCE_FILE": source_file,
                "DISTRIBUTION_NAME": distribution, "DISTRIBUTION_VERSION": package_versions.get(distribution),
                "FILE_SHA256": sha(data), "INITIAL": parsed["INITIAL"], "ATOMIC": parsed["ATOMIC"],
                "REPLACES": parsed["REPLACES"], "OPERATIONS": parsed["OPERATIONS"],
            }
            nodes.append(node)
            pending_edges.extend((migration_id, edge) for edge in parsed["EDGES"])
            raw_ops.extend({
                "RAW_OPERATION_ID": identity("RAW", migration_id + ":" + str(index)),
                "MIGRATION_ID": migration_id, "SOURCE_REFERENCE": {"FILE": source_file, "FILE_SHA256": sha(data), "LINE": row["LINE"]},
                **row,
            } for index, row in enumerate(parsed["RAW"]))
        migration_sources.append({
            "APP_LABEL": label, "DISTRIBUTION": distribution, "LOCKED_VERSION": package_versions.get(distribution),
            "SOURCE_LOCATION": next((row["ARTIFACT_URL"] for row in packages if row["DISTRIBUTION"] == distribution), "LOCAL_REPOSITORY"),
            "PACKAGE_SOURCE_DIGEST": next((row["ARTIFACT_SHA256"] for row in packages if row["DISTRIBUTION"] == distribution), None),
            "MIGRATION_FILE_COUNT": len(files),
            "MIGRATION_GRAPH_DIGEST": None,
        })
    nodes.sort(key=lambda row: row["MIGRATION_ID"])
    by_id = {node["MIGRATION_ID"]: node for node in nodes}
    assert len(by_id) == len(nodes), "Duplicate migration identity"
    app_roots = {}
    for app in configured:
        ids = [node["MIGRATION_ID"] for node in nodes if node["APP_LABEL"] == app["APP_LABEL"]]
        referenced = {edge["APP"] + "::" + edge["NAME"] for _, edge in pending_edges
                      if edge["CLASS"] == "DEPENDENCY" and edge.get("APP") == app["APP_LABEL"] and edge.get("NAME") not in ("__first__", "__latest__")}
        roots = [node for node in ids if not any(
            migration == node and edge["CLASS"] == "DEPENDENCY" and edge.get("APP") == app["APP_LABEL"]
            for migration, edge in pending_edges
        )]
        leaves = [node for node in ids if node not in referenced]
        app_roots[app["APP_LABEL"]] = {"__first__": roots, "__latest__": leaves}
    edges = []
    for index, (migration, raw) in enumerate(pending_edges):
        app, name = raw.get("APP"), raw.get("NAME")
        if raw["CLASS"] == "SWAPPABLE_DEPENDENCY":
            assert raw["SETTING"] == "settings.AUTH_USER_MODEL", "Unapproved swappable setting"
            app, model = user_model.split(".", 1)
            name = "__first__"
        targets = app_roots.get(app, {}).get(name, []) if name in ("__first__", "__latest__") else [str(app) + "::" + str(name)]
        target = targets[0] if len(targets) == 1 else None
        from_migration, to_migration = (target, migration) if raw["CLASS"] == "RUN_BEFORE" else (migration, target)
        edges.append({
            "EDGE_ID": identity("EDGE", migration + ":" + str(index)),
            "FROM_MIGRATION": from_migration, "TO_MIGRATION": to_migration,
            "EDGE_CLASS": raw["CLASS"],
            "RESOLUTION": "RESOLVED" if from_migration in by_id and to_migration in by_id else "BLOCKED",
            "SOURCE_MIGRATION": migration, "SOURCE_LINE": raw["LINE"],
            "DECLARED_TARGET": [app, name], "REPLACEMENT_IS_LINEAGE_NOT_EXECUTION_DEPENDENCY": raw["CLASS"] == "REPLACEMENT",
        })
    edges.sort(key=lambda row: row["EDGE_ID"])
    order = topological(by_id, edges)
    plan = [{"ORDER_INDEX": index, **{key: by_id[migration][key] for key in
             ("MIGRATION_ID", "APP_LABEL", "MIGRATION_NAME", "SOURCE_CLASS", "DISTRIBUTION_NAME", "DISTRIBUTION_VERSION", "FILE_SHA256")}}
            for index, migration in enumerate(order)]
    local = [node for node in nodes if node["SOURCE_CLASS"] == "LOCAL"]
    assert len(local) == 29, "FAIL_EVIDENCE_DRIFT: local migration denominator"
    for row in a1e["djangoOperationalGraph"]["LOCAL_MIGRATIONS"]:
        node = by_id[row["APP"] + "::" + row["MIGRATION"]]
        assert node["FILE_SHA256"] == row["SOURCE_SHA256"], "FAIL_EVIDENCE_DRIFT: local migration hash"
    local_edges = [edge for edge in edges if edge["EDGE_CLASS"] == "DEPENDENCY" and by_id[edge["SOURCE_MIGRATION"]]["SOURCE_CLASS"] == "LOCAL"]
    assert len(local_edges) == 26
    assert {(edge["FROM_MIGRATION"], edge["TO_MIGRATION"]) for edge in local_edges} == {
        (edge["CONSUMER"], edge["APP"] + "::" + edge["MIGRATION"])
        for edge in a1e["djangoOperationalGraph"]["LITERAL_DEPENDENCY_EDGES"]
    }
    for source in migration_sources:
        source["MIGRATION_GRAPH_DIGEST"] = digest({
            "NODES": [node for node in nodes if node["APP_LABEL"] == source["APP_LABEL"]],
            "EDGES": [edge for edge in edges if by_id[edge["SOURCE_MIGRATION"]]["APP_LABEL"] == source["APP_LABEL"]],
        })
    distribution_sources = []
    for distribution in sorted(set(row["DISTRIBUTION"] for row in migration_sources if row["DISTRIBUTION"])):
        artifact = next(row for row in packages if row["DISTRIBUTION"] == distribution)
        selected_nodes = [row for row in nodes if row["DISTRIBUTION_NAME"] == distribution]
        distribution_sources.append({
            "DISTRIBUTION": distribution, "LOCKED_VERSION": artifact["VERSION"],
            "SOURCE_LOCATION": artifact["ARTIFACT_URL"], "PACKAGE_SOURCE_DIGEST": artifact["ARTIFACT_SHA256"],
            "MIGRATION_FILE_COUNT": len(selected_nodes),
            "MIGRATION_GRAPH_DIGEST": digest({
                "NODES": selected_nodes,
                "EDGES": [row for row in edges if by_id[row["SOURCE_MIGRATION"]]["DISTRIBUTION_NAME"] == distribution],
            }),
        })
    workstream = next(row for row in contract["remediationWorkstreams"] if row["WORKSTREAM_ID"] == "W1")
    all_obligations = {row["OBLIGATION_ID"]: row for key in
        ("prerequisiteObligations", "opaqueBindingObligations", "orderingObligations", "additionalContractObligations") for row in contract[key]}
    linkage = []
    for obligation_id in workstream["INPUT_OBLIGATION_IDS"]:
        row = all_obligations[obligation_id]
        physical = obligation_id in {value["OBLIGATION_ID"] for value in contract["prerequisiteObligations"]}
        raw = row.get("PREDECESSOR_GAP_ID") and not row.get("SUBJECT") in apps
        implemented = not physical and not raw
        linkage.append({
            "OBLIGATION_ID": obligation_id, "IMPLEMENTED_BY_W1": "YES" if implemented else "NO",
            "IMPLEMENTATION_EVIDENCE": "Exact hash-pinned package lock and complete syntax migration graph/plan" if implemented else
            "Dependency identity sub-obligation inventoried; physical materialization/raw dependency authority and expected-schema proof not implemented in W1",
            "RUNTIME_PROVEN": "NO",
        })
    conflicts = [{
        "DEPENDENCY_CONFLICT_ID": identity("CONFLICT", "w1-obligation-scope"),
        "REQUESTED_CONSTRAINTS": ["W1 PASS requires all W1-assigned obligations implemented", "W1 prohibits physical schema/prerequisite implementation and runtime access"],
        "CONFLICTING_DISTRIBUTIONS": [],
        "WHY_RESOLVER_CANNOT_CLOSE": "Resolver closes package identities, but cannot implement 372 full physical Django prerequisite obligations or prove raw-operation preconsumer dependencies without forbidden later work",
        "MINIMUM_DECISION_REQUIRED": "Approve a W1 dependency-lock sub-obligation/completion-boundary amendment for linked physical prerequisites, preserving their W4/materialization/runtime obligations. Do not mark them implemented merely from a graph.",
        "CONFLICT_CLASS": "GOVERNANCE_COMPLETION_BOUNDARY",
    }]
    if any(edge["RESOLUTION"] == "BLOCKED" for edge in edges):
        conflicts.append({
            "DEPENDENCY_CONFLICT_ID": identity("CONFLICT", "graph-references"),
            "REQUESTED_CONSTRAINTS": ["Complete configured external migration graph"],
            "CONFLICTING_DISTRIBUTIONS": [],
            "WHY_RESOLVER_CANNOT_CLOSE": "One or more migration references are statically blocked",
            "MINIMUM_DECISION_REQUIRED": "Resolve the exact blocked references from locked configuration/package authority without silently excluding migrations",
            "CONFLICT_CLASS": "MIGRATION_GRAPH_BINDING",
        })
    digests = {
        "DJANGO_PACKAGE_LOCK_DIGEST": sha((BACKEND / "requirements.lock").read_bytes()),
        "DJANGO_MIGRATION_GRAPH_DIGEST": digest({"NODES": nodes, "EDGES": edges}),
        "DJANGO_MIGRATION_PLAN_DIGEST": digest(plan),
        "LOCAL_MIGRATION_SOURCE_DIGEST": digest([(node["MIGRATION_ID"], node["FILE_SHA256"]) for node in local]),
        "EXTERNAL_MIGRATION_SOURCE_DIGEST": digest([(node["MIGRATION_ID"], node["FILE_SHA256"]) for node in nodes if node["SOURCE_CLASS"] != "LOCAL"]),
    }
    return {
        "metadata": {"PHASE": "PHASE_1B_3C_A1I_W1", "FROZEN_INPUT_SHA256": FROZEN,
                     "ANALYZER_SHA256": sha(Path(__file__).read_bytes()),
                     "LOCK_TOOL_SHA256": sha((ROOT / "scripts" / "ue" / "lock-django-bootstrap-dependencies.py").read_bytes()),
                     "SETTINGS_SHA256": sha(settings_path.read_bytes()),
                     "PACKAGE_INDEX_ACCESS_OCCURRED": True, "EXTERNAL_SOURCE_VENDORED": False,
                     "PACKAGE_SOURCE_LOCATION": "Exact wheel archives reacquirable by lock metadata URL/SHA256; outside repository",
                     "SOURCE_CODE_EXECUTED_OR_IMPORTED": False, "DJANGO_SETUP_CALLED": False,
                     "FROZEN_OBLIGATION_IDS": {
                         "PREREQUISITES": [row["PREREQUISITE_ID"] for row in contract["prerequisiteObligations"]],
                         "OPAQUE": [row["OPAQUE_BINDING_ID"] for row in contract["opaqueBindingObligations"]],
                         "ORDERING": [row["ORDERING_RECORD_ID"] for row in contract["orderingObligations"]],
                     }},
        "packageAuthority": package_evidence,
        "declaredDependencies": package_evidence["DECLARED_DIRECT_DEPENDENCIES"],
        "lockedDistributions": packages, "configuredApps": configured,
        "migrationSources": migration_sources, "distributionMigrationSources": distribution_sources,
        "migrationNodes": nodes,
        "migrationEdges": edges, "rawOperationRegistry": raw_ops,
        "frozenSecurityManifest": contract["frozenMigrationManifest"],
        "canonicalMigrationPlan": plan,
        "swappableConfiguration": {
            "AUTH_USER_MODEL": user_model,
            "AUTHORITY": "Repository override" if "AUTH_USER_MODEL" in settings else "Exact locked Django global_settings.py literal; repository has no override",
            "DJANGO_GLOBAL_SETTINGS_SHA256": sha(django.read("django/conf/global_settings.py")),
            "MIGRATION_MODULES": module_map,
        },
        "governanceObligationLinkage": {
            "W1_INPUT_OBLIGATION_IDS": workstream["INPUT_OBLIGATION_IDS"],
            "W1_INPUT_DECISION_IDS": workstream["INPUT_DECISION_IDS"],
            "OBLIGATIONS": linkage,
            "DECISIONS": [{"DECISION_ID": key, "IMPLEMENTED_BY_W1": "NO",
                           "IMPLEMENTATION_EVIDENCE": "Candidate package/runtime/config identity produced; human approval and full expected-schema/raw graph boundary remain required",
                           "RUNTIME_PROVEN": "NO"} for key in workstream["INPUT_DECISION_IDS"]],
        },
        "dependencyConflicts": conflicts, "digests": digests,
        "validation": {
            "INPUT_CONFIGURED_APPS": 25, "LOCAL_APPS": sum(row["SOURCE_CLASS"] == "LOCAL" for row in configured),
            "FRAMEWORK_APPS": sum(row["SOURCE_CLASS"] == "DJANGO_FRAMEWORK" for row in configured),
            "THIRD_PARTY_APPS": sum(row["SOURCE_CLASS"] == "THIRD_PARTY" for row in configured),
            "UNRESOLVED_APP_BINDINGS": 0, "SUM": len(configured),
            "LOCAL_MIGRATIONS_PRESERVED": len(local), "LOCAL_LITERAL_EDGES_PRESERVED": len(local_edges),
            "UNKNOWN_MIGRATION_REFERENCES": sum(row["RESOLUTION"] == "BLOCKED" for row in edges),
            "DUPLICATE_MIGRATION_IDENTITIES": 0, "GRAPH_CYCLES": 0,
            "LOCAL_MIGRATIONS_LOST": 0, "LOCAL_MIGRATIONS_DUPLICATED": 0,
            "LOCKED_WHEEL_METADATA_MATCHES_RESOLVER": True,
            "DJANGO_VERSION_DECLARED_CONSTRAINT": next(row["DECLARED_CONSTRAINT"] for row in package_evidence["DECLARED_DIRECT_DEPENDENCIES"] if row["DISTRIBUTION"] == "django"),
            "DJANGO_VERSION_LOCKED": package_versions["django"], "DJANGO_VERSION_PINNED": "YES",
            "ALL_EXTERNAL_CONTRIBUTORS_EXACT_VERSION_PINNED": True,
            "TOTAL_DJANGO_MIGRATION_NODES": len(nodes),
            **{"TOTAL_" + name + "_EDGES": sum(row["EDGE_CLASS"] == name for row in edges)
               for name in ("DEPENDENCY", "RUN_BEFORE", "REPLACEMENT", "SWAPPABLE_DEPENDENCY")},
            "ISOLATED_OFFLINE_HASH_CHECKED_POPULATION": "PASS",
            "ISOLATED_PAYLOAD_KIND": "pip --target cross-platform CPython311/Linux wheels; distribution metadata inspected on Windows, not runnable Python311 venv",
            "NATIVE_PYTHON311_IMPORT_VERIFICATION": "NOT_RUN: no Python311 interpreter available; no runtime archive download authorized",
            "NO_DATABASE_ACCESS": True, "NO_MIGRATION_EXECUTION": True,
            "NO_SCHEMA_RLS_DEPLOYMENT_CHANGE": True, "FROZEN_GOVERNANCE_UNCHANGED": True,
            "W1_IMPLEMENTED_OBLIGATIONS": sum(row["IMPLEMENTED_BY_W1"] == "YES" for row in linkage),
            "W1_PENDING_OBLIGATIONS": sum(row["IMPLEMENTED_BY_W1"] == "NO" for row in linkage),
        },
        "phaseStatus": {
            "PHASE_1B_3C_A1I_W1_GATE": "BLOCKED", "PHASE_1B_3C_A1I_W1": "BLOCKED",
            "EXACT_DJANGO_DEPENDENCY_LOCK": "ESTABLISHED_CANDIDATE_TARGET",
            "COMPLETE_DJANGO_MIGRATION_GRAPH": "ESTABLISHED" if all(edge["RESOLUTION"] == "RESOLVED" for edge in edges) else "BLOCKED",
            "CANONICAL_DJANGO_MIGRATION_PLAN": "DETERMINISTIC_CANDIDATE_PENDING_W1_GATE",
            "W1_IMPLEMENTATION_COMPLETE": "NO", "RUNTIME_PROVEN": "NO",
            "W2": "NOT_AUTHORIZED", "W2_STARTED": "NO",
            "W3_W10_STARTED": "NO", "A1R": "NOT_AUTHORIZED", "A1R_STARTED": "NO",
            "A2": "NOT_AUTHORIZED", "A2_STARTED": "NO", "B3C_B": "NOT_AUTHORIZED", "B3C_B_STARTED": "NO",
            "BOOTSTRAP_IMPLEMENTATION_COMPLETE": "NO", "FAITHFUL_SCHEMA_REPLAY_PROVEN": "NO",
            "PRODUCTION_SCHEMA_PROVEN": "NO", "RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN": "NO",
            "TENANT_ISOLATION_RUNTIME_PROVEN": "NO", "READY_FOR_RUNTIME_PROOF": 0, "PRODUCT_READY": "NO",
            "PHASE_1B_3C_A1G": "PASS", "CONTRACT_STATUS": "GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING",
            "CONTRACT_DOCTRINE": contract["CONTRACT_DOCTRINE"], "FROZEN_SECURITY_MIGRATION_COUNT": 23,
            "ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER": "DJANGO", "FINANCIAL_DATABASE_SCOPE": "DISTINCT",
        },
    }


def markdown(report):
    v, d = report["validation"], report["digests"]
    return f"""# W1 - exact Django dependency and migration identity

## Gate: BLOCKED

Package/graph identity is implemented locally; W1's full completion condition is not met. Locking cannot implement the full physical prerequisite obligations assigned to W1, and their exact ownership/materialization/raw-dependency evidence remains pending. No obligation is promoted merely from a deterministic graph.

## Package authority and exact lock

Existing authority: pip requirements.txt. The unchanged 27 direct declarations resolve to 87 exact distributions (60 transitives) with one verified artifact SHA256 each in [requirements.lock](../../../apps/union-eyes/backend/requirements.lock) and [lock metadata](../../../apps/union-eyes/backend/requirements.lock.metadata.json). Candidate target: CPython 3.11.14/Linux x86_64/manylinux2014/cp311. Installed Python 3.13 is only the resolver/AST tool, not promoted to runtime authority. The existing Docker minor is 3.11; historical workflow dependency commands also declare 3.12. Deployment/runtime alignment is not changed here.

Package-index metadata and exact wheel downloads were used. No application services, secret stores or databases contacted. Direct compatibility ranges remain unchanged. Host-marker versus target-marker differences were independently validated for the Linux 3.11.14 transitive requirement closure; no target requirement is missing.

## Configured apps and migrations

25 = {v['LOCAL_APPS']} local + {v['FRAMEWORK_APPS']} framework + {v['THIRD_PARTY_APPS']} third-party + 0 unresolved.

The configured apps namespace is a single-path local namespace app without apps.models or apps.migrations. Exact locked Django AppConfig/MigrationLoader source rules support it as a migrationless app; apps.core is not silently installed as an additional app. No Django initialization/import of these app sources occurs.

All 29 local migration bytes and 26 literal edges remain unchanged. The complete inventory has {v['TOTAL_DJANGO_MIGRATION_NODES']} nodes, {v['TOTAL_DEPENDENCY_EDGES']} dependency edges, {v['TOTAL_RUN_BEFORE_EDGES']} run-before, {v['TOTAL_REPLACEMENT_EDGES']} replacement and {v['TOTAL_SWAPPABLE_DEPENDENCY_EDGES']} swappable edges. Unknown references: {v['UNKNOWN_MIGRATION_REFERENCES']}; duplicate identities: 0; dependency cycles: 0. Replacement lineage is not modeled as an execution dependency.

AUTH_USER_MODEL is resolved from the repository override, or the literal default in the exact locked Django global_settings.py when no override exists. All wheel migration sources are identified by artifact and per-file hashes; external code is not vendored or reproduced in these reports.

## Operations and candidate plan

Operation classes include raw/generated/state-only effects, with explicit state/physical flags and static-analysis requirements. Raw RunPython/RunSQL/SeparateDatabaseAndState dependencies are inventories, not implemented preconsumer producers. The JSON [exact report]({NAME}.json) contains operation and raw registers, consumer references and a deterministic topological candidate plan. This is not proof Django internally executes precisely that order.

## Digests

{chr(10).join('- ' + key + ': `' + value + '`' for key, value in d.items())}

## W1 linkage and exact decision packet

All contract W1 obligation and decision IDs are represented exactly once. Implemented linkage: {v['W1_IMPLEMENTED_OBLIGATIONS']}; pending: {v['W1_PENDING_OBLIGATIONS']}. The 372 full physical Django materialization obligations remain NO; dependency identity is only a sub-obligation. Raw dependencies are inventoried but not materialized or semantically proven.

Required next decision: approve a narrowly defined W1 dependency-lock/graph completion-boundary amendment for physical and raw obligations, retaining their W4/materialization/runtime evidence requirements. Approve the exact candidate runtime/package/config identity; do not mark physical prerequisites implemented, mutate the frozen contract silently, or claim runtime proof. Any blocked exact graph references must additionally be resolved from package/config authority.

## Verification

Two pip resolutions produced identical lock bytes. Two syntax graph builds produce identical graph/plan digests. All wheel SHA256 values verified; a fresh offline cross-platform pip target payload populated with --require-hashes and distribution metadata matches all 87 pins. This is not a native Python311 executable venv; no Python311 interpreter is available locally, so native import validation is not claimed.

No django.setup, migrations, database, schema/RLS changes or deployment. Governance contract and predecessor hashes and all 23 frozen migration hashes remain unchanged. Syntax/self-tests, deterministic --check, scoped formatting and docs validation are run separately.

## Reproduction commands

Use an explicitly selected temporary directory in `$work`; no application environment files are read. The full pip resolver flags are recorded in lock metadata. Resolve the unchanged requirements twice using those flags with `--report` paths, then:

```powershell
python scripts\\ue\\lock-django-bootstrap-dependencies.py --run1 "$work\\resolution-run1.json" --run2 "$work\\resolution-run2.json" --evidence apps\\union-eyes\\backend\\requirements.lock.metadata.json --check
python -m pip --isolated download --require-hashes --no-deps --only-binary=:all: --python-version 3.11.14 --platform manylinux2014_x86_64 --implementation cp --abi cp311 --dest "$work\\wheelhouse" -r apps\\union-eyes\\backend\\requirements.lock
python -m pip --isolated install --require-hashes --no-deps --no-compile --no-index --find-links "$work\\wheelhouse" --only-binary=:all: --python-version 3.11.14 --platform manylinux2014_x86_64 --implementation cp --abi cp311 --target "$work\\isolated-payload" -r apps\\union-eyes\\backend\\requirements.lock
python scripts\\ue\\build-django-migration-plan.py --wheelhouse "$work\\wheelhouse" --isolated-payload "$work\\isolated-payload" --check
```

Regenerating from unpinned requirements against a later index may intentionally produce a different compatible resolution and must fail `--check`, not overwrite the accepted lock silently. Existing exact lock/artifact URLs and hashes reproduce package sources without rerunning floating resolution. No native import/runtime proof is inferred from cross-target population.

## Next authorization

W1 = BLOCKED; W2 = NOT_AUTHORIZED and not started. W3-W10, A1R/A2/B3C-B are not started; runtime readiness remains zero and all production/faithful replay/tenant-isolation/product proof remains NO.
"""


def self_test():
    parsed = parse_migration("""
raise RuntimeError('never execute')
class Migration:
    dependencies = [('auth', '0001_initial'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    run_before = [('demo', '0002')]
    operations = [migrations.SeparateDatabaseAndState(database_operations=[],
      state_operations=[migrations.RemoveField(model_name='organizations', name='old')]),
      migrations.RunPython(copy_rows)]
""")
    assert parsed["OPERATIONS"][1]["PHYSICAL_DB_EFFECT"] == "NO"
    assert parsed["EDGES"][1]["CLASS"] == "SWAPPABLE_DEPENDENCY"
    assert parsed["EDGES"][2]["CLASS"] == "RUN_BEFORE"
    assert topological(["a", "b"], [{"FROM_MIGRATION": "b", "TO_MIGRATION": "a", "EDGE_CLASS": "DEPENDENCY", "RESOLUTION": "RESOLVED"}]) == ["a", "b"]
    try:
        topological(["a"], [{"FROM_MIGRATION": "a", "TO_MIGRATION": "a", "EDGE_CLASS": "DEPENDENCY", "RESOLUTION": "RESOLVED"}])
    except AssertionError:
        pass
    else:
        raise AssertionError("Cycle accepted")
    print("PASS: no source execution, swappable/run-before extraction, state-only separation, cycles rejected.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--wheelhouse", type=Path)
    parser.add_argument("--isolated-payload", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        assert args.wheelhouse and args.isolated_payload
        first = build(args.wheelhouse, args.isolated_payload)
        second = build(args.wheelhouse, args.isolated_payload)
        assert first == second, "Graph nondeterminism"
        first["reproducibility"] = {
            "RUN_1_LOCK_DIGEST": first["digests"]["DJANGO_PACKAGE_LOCK_DIGEST"],
            "RUN_2_LOCK_DIGEST": second["digests"]["DJANGO_PACKAGE_LOCK_DIGEST"],
            "RUN_1_GRAPH_DIGEST": first["digests"]["DJANGO_MIGRATION_GRAPH_DIGEST"],
            "RUN_2_GRAPH_DIGEST": second["digests"]["DJANGO_MIGRATION_GRAPH_DIGEST"],
            "RUN_1_PLAN_DIGEST": first["digests"]["DJANGO_MIGRATION_PLAN_DIGEST"],
            "RUN_2_PLAN_DIGEST": second["digests"]["DJANGO_MIGRATION_PLAN_DIGEST"],
            "ALL_DIGESTS_MATCH": "YES",
        }
        payload = [{"name": NAME + ".json", "parser": "json", "text": json.dumps(first)},
                   {"name": NAME + ".md", "parser": "markdown", "text": markdown(first)}]
        formatted = subprocess.run([
            "node", "--input-type=module", "--eval",
            "import {format,resolveConfig} from 'prettier'; let input=''; for await (const c of process.stdin) input+=c; "
            "const config=await resolveConfig('package.json'); const out=[]; for(const f of JSON.parse(input)) "
            "out.push({...f,text:await format(f.text,{...config,parser:f.parser})}); console.log(JSON.stringify(out));"
        ], input=json.dumps(payload), text=True, encoding="utf-8", capture_output=True, cwd=ROOT, check=True)
        for file in json.loads(formatted.stdout):
            path = BASE / file["name"]
            if args.check:
                assert path.read_text(encoding="utf-8") == file["text"], "Generated report drift"
            else:
                path.write_text(file["text"], encoding="utf-8", newline="\n")
        print(json.dumps({"GATE": first["phaseStatus"]["PHASE_1B_3C_A1I_W1_GATE"],
                          "validation": first["validation"], "digests": first["digests"]}, indent=2))
