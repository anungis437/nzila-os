"""Start the current backend from copied source without any external connection."""

import hashlib
import ast
import inspect
import json
import os
import re
import sys
from pathlib import Path


def python_mutation_graph(root, backend, entrypoints, model_tables):
    """Conservative source reachability; unresolved dispatch is retained, never qualified."""
    nodes = {}
    symbols = {}
    modules = {}
    mutations = {
        "save": "UPSERT",
        "asave": "UPSERT",
        "create": "INSERT",
        "acreate": "INSERT",
        "bulk_create": "INSERT",
        "abulk_create": "INSERT",
        "get_or_create": "UPSERT",
        "aget_or_create": "UPSERT",
        "update_or_create": "UPSERT",
        "aupdate_or_create": "UPSERT",
        "update": "UPDATE",
        "aupdate": "UPDATE",
        "bulk_update": "UPDATE",
        "abulk_update": "UPDATE",
        "delete": "DELETE",
        "adelete": "DELETE",
    }

    def expression(node):
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parent = expression(node.value)
            return parent + "." + node.attr if parent else ""
        if isinstance(node, (ast.Call, ast.Subscript)):
            return expression(node.func if isinstance(node, ast.Call) else node.value)
        return ""

    def scope_items(body):
        for item in body:
            yield item
            if not isinstance(
                item, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
            ):
                yield from scope_items(list(ast.iter_child_nodes(item)))

    def imported_aliases(body, package):
        aliases = {}
        for item in scope_items(body):
            if isinstance(item, ast.Import):
                for alias in item.names:
                    aliases[alias.asname or alias.name.split(".")[0]] = (
                        alias.name if alias.asname else alias.name.split(".")[0]
                    )
            elif isinstance(item, ast.ImportFrom):
                prefix = (
                    ".".join(package[: len(package) - item.level + 1])
                    if item.level
                    else ""
                )
                imported = ".".join(part for part in (prefix, item.module) if part)
                for alias in item.names:
                    if alias.name != "*":
                        aliases[alias.asname or alias.name] = (
                            imported + "." + alias.name
                        )
        return aliases

    for file in sorted(backend.rglob("*.py")):
        if {"migrations", "__pycache__", "tests"} & set(
            file.parts
        ) or file.name.startswith("test_"):
            continue
        relative = file.relative_to(backend)
        parts = list(relative.with_suffix("").parts)
        is_package = parts[-1] == "__init__"
        if is_package:
            parts.pop()
        module = ".".join(parts)
        tree = ast.parse(file.read_text(encoding="utf-8-sig"), filename=str(file))
        source = file.relative_to(root).as_posix()
        source_digest = hashlib.sha256(file.read_bytes()).hexdigest()
        package = parts if is_package else parts[:-1]
        aliases = imported_aliases(tree.body, package)
        modules[module] = aliases

        def collect(body, parent="", enclosing_aliases=None):
            visible = enclosing_aliases if enclosing_aliases is not None else aliases
            for item in body:
                if isinstance(
                    item, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
                ):
                    name = ".".join(part for part in (parent, item.name) if part)
                    local_aliases = {**visible, **imported_aliases(item.body, package)}
                    if not isinstance(item, ast.ClassDef):
                        identifier = f"{source}#{name}:{item.lineno}"
                        nodes[identifier] = {
                            "id": identifier,
                            "source": source,
                            "sha256": source_digest,
                            "line": item.lineno,
                            "callable": module + "." + name,
                            "mutations": [],
                            "calls": [],
                            "unresolvedCalls": [],
                            "rootCallables": [],
                            "_ast": item,
                            "_module": module,
                            "_parent": parent,
                            "_aliases": local_aliases,
                        }
                        symbols.setdefault(module + "." + name, []).append(identifier)
                    collect(item.body, name, local_aliases)
                elif isinstance(
                    item,
                    (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith),
                ):
                    collect(item.body, parent, visible)
                    collect(getattr(item, "orelse", []), parent, visible)
                elif isinstance(item, (ast.Try, ast.TryStar)):
                    collect(item.body + item.orelse + item.finalbody, parent, visible)
                    for handler in item.handlers:
                        collect(handler.body, parent, visible)

        collect(tree.body)

    for node in nodes.values():
        aliases = node["_aliases"]
        inferred = {}

        def qualify(name):
            head, *tail = name.split(".")
            if head in {"self", "cls"} and node["_parent"]:
                return ".".join([node["_module"], node["_parent"], *tail])
            if head in inferred:
                return ".".join([inferred[head], *tail])
            if head in aliases:
                return ".".join([aliases[head], *tail])
            parents = node["callable"].split(".")[len(node["_module"].split(".")) :]
            for count in range(len(parents), -1, -1):
                candidate = ".".join([node["_module"], *parents[:count], name])
                if candidate in symbols:
                    return candidate
            return node["_module"] + "." + name

        def visit(item):
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                return
            if isinstance(item, (ast.Assign, ast.AnnAssign)):
                value = item.value
                if isinstance(value, ast.Call):
                    constructor = expression(value.func)
                    targets = (
                        item.targets if isinstance(item, ast.Assign) else [item.target]
                    )
                    for target in targets:
                        if isinstance(target, ast.Name) and constructor:
                            inferred[target.id] = qualify(constructor)
            if isinstance(item, ast.Call):
                name = expression(item.func)
                destination = qualify(name) if name else ""
                targets = symbols.get(destination, [])
                if targets:
                    node["calls"].extend(targets)
                elif isinstance(item.func, ast.Attribute):
                    node["unresolvedCalls"].append(
                        {
                            "expression": name,
                            "line": item.lineno,
                            "reason": "DYNAMIC_OR_DEPENDENCY_DISPATCH",
                        }
                    )
                method = item.func.attr if isinstance(item.func, ast.Attribute) else ""
                if method in mutations:
                    table = next(
                        (
                            model_tables[".".join(destination.split(".")[:index])]
                            for index in range(len(destination.split(".")), 0, -1)
                            if ".".join(destination.split(".")[:index]) in model_tables
                        ),
                        "UNRESOLVED_MODEL",
                    )
                    node["mutations"].append(
                        {
                            "operation": mutations[method],
                            "table": table,
                            "line": item.lineno,
                            "expression": name,
                            "classification": (
                                "MODEL_BOUND_ORM"
                                if table != "UNRESOLVED_MODEL"
                                else "UNRESOLVED_MUTATION_CANDIDATE"
                            ),
                        }
                    )
                elif method in {"execute", "executemany", "aexecute", "aexecutemany"}:
                    query = (
                        item.args[0].value
                        if item.args
                        and isinstance(item.args[0], ast.Constant)
                        and isinstance(item.args[0].value, str)
                        else None
                    )
                    matches = re.findall(
                        r"\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([\"\w.]+)",
                        query or "",
                        re.IGNORECASE,
                    )
                    if matches:
                        node["mutations"].extend(
                            {
                                "operation": operation.split()[0].upper(),
                                "table": table.replace('"', ""),
                                "line": item.lineno,
                                "expression": name,
                                "classification": "LITERAL_SQL",
                            }
                            for operation, table in matches
                        )
                    elif query is None:
                        node["mutations"].append(
                            {
                                "operation": "UNKNOWN",
                                "table": "UNRESOLVED_DYNAMIC_SQL",
                                "line": item.lineno,
                                "expression": name,
                                "classification": "UNRESOLVED_MUTATION_CANDIDATE",
                            }
                        )
            for child in ast.iter_child_nodes(item):
                visit(child)

        for statement in node["_ast"].body:
            visit(statement)
        node["calls"] = sorted(set(node["calls"]))

    root_bindings = {}
    for entry in entrypoints:
        name = entry["callable"].replace(".<locals>.", ".")
        root_bindings.setdefault(name, []).append(entry["id"])
    unresolved_roots = []
    for name, bindings in sorted(root_bindings.items()):
        targets = symbols.get(name, [])
        if not targets:
            unresolved_roots.append(
                {
                    "callable": name,
                    "bindings": bindings,
                    "reason": "INHERITED_DEPENDENCY_OR_UNRESOLVED_ROOT",
                }
            )
        seen = set()
        pending = list(targets)
        while pending:
            identifier = pending.pop()
            if identifier in seen:
                continue
            seen.add(identifier)
            node = nodes[identifier]
            node["rootCallables"].append(name)
            pending.extend(node["calls"])
    mutating = {identifier for identifier, node in nodes.items() if node["mutations"]}
    retained = set(mutating)
    changed = True
    while changed:
        changed = False
        for identifier, node in nodes.items():
            if identifier not in retained and any(
                target in retained for target in node["calls"]
            ):
                retained.add(identifier)
                changed = True
    for node in nodes.values():
        for private in ("_ast", "_module", "_parent", "_aliases"):
            del node[private]
    return {
        "rootBindings": root_bindings,
        "callers": [
            node
            for identifier, node in nodes.items()
            if identifier in retained and node["rootCallables"]
        ],
        "unreachableDirectWriters": [
            node
            for identifier, node in nodes.items()
            if identifier in mutating and not node["rootCallables"]
        ],
        "unresolvedRoots": unresolved_roots,
        "unresolvedReachableCalls": [
            {"caller": node["id"], **call}
            for node in nodes.values()
            if node["rootCallables"]
            for call in node["unresolvedCalls"]
        ],
        "denominatorComplete": False,
        "runtimeQualification": "NOT_PROVEN",
        "limitations": [
            "Source reachability is not runtime execution or actor qualification.",
            "Unresolved model, serializer, inherited, injected and dynamic dispatch require reconciliation.",
            "Module initialization, signals and management-command entrypoints require reconciliation.",
        ],
    }


def execution_inventory(root, backend, resolver):
    """Resolve actual framework registrations without opening a database connection."""
    from django.urls import URLResolver
    from django.apps import apps

    routes = []
    framework_owned_routes = []
    tasks = []
    unresolved = []

    def binding(target):
        try:
            source = inspect.getsourcefile(target)
            line = inspect.getsourcelines(target)[1]
        except (TypeError, OSError) as error:
            return {"source": None, "line": None, "unresolved": type(error).__name__}
        source_path = Path(source).resolve() if source else None
        if source_path is None:
            return {"source": None, "line": line, "unresolved": "SOURCE_UNAVAILABLE"}
        try:
            name = source_path.relative_to(root).as_posix()
        except ValueError:
            return {"dependency": target.__module__, "line": line}
        return {
            "source": name,
            "line": line,
            "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        }

    def walk(patterns, prefix=""):
        for pattern in patterns:
            route = prefix + str(pattern.pattern)
            if isinstance(pattern, URLResolver):
                walk(pattern.url_patterns, route)
                continue
            callback = pattern.callback
            view = getattr(callback, "cls", getattr(callback, "view_class", None))
            actions = getattr(callback, "actions", None)
            if actions is None and view is not None:
                actions = {
                    method: method
                    for method in getattr(view, "http_method_names", [])
                    if hasattr(view, method)
                }
            if actions is None:
                actions = {"UNRESOLVED": getattr(callback, "__name__", "callback")}
                unresolved.append(
                    {"route": route, "reason": "FUNCTION_METHOD_DISPATCH"}
                )
            queryset = getattr(view, "queryset", None) if view else None
            model = getattr(queryset, "model", None)
            for method, action in sorted(actions.items()):
                target = getattr(view, action, callback) if view else callback
                target_binding = binding(target)
                routes.append(
                    {
                        "id": route + "#" + method.upper(),
                        "route": route,
                        "method": method.upper(),
                        "action": action,
                        "callable": getattr(
                            target, "__module__", type(target).__module__
                        )
                        + "."
                        + getattr(target, "__qualname__", type(target).__qualname__),
                        "binding": target_binding,
                        "viewBinding": binding(view) if view else binding(callback),
                        "table": model._meta.db_table if model else "UNRESOLVED_MODEL",
                        "methodCandidateOnly": method.lower()
                        in {"post", "put", "patch", "delete"},
                        "permissionClasses": (
                            [
                                permission.__module__ + "." + permission.__qualname__
                                for permission in getattr(
                                    view, "permission_classes", []
                                )
                            ]
                            if view
                            else []
                        ),
                        "runtimeQualification": "NOT_PROVEN",
                    }
                )
                if not target_binding.get("source"):
                    framework_owned_routes.append(route + "#" + method.upper())

    walk(resolver.url_patterns)
    from config.celery import app as celery_app

    celery_app.loader.import_default_modules()
    celery_app.autodiscover_tasks(force=True)
    celery_app.finalize()
    registered_tasks = []
    registered_sources = {}
    for name, task in sorted(celery_app.tasks.items()):
        target = inspect.unwrap(task.run)
        if name.startswith("celery.") or target.__module__.startswith("celery."):
            continue
        source_binding = binding(target)
        registered_tasks.append(
            {
                "name": name,
                "callable": target.__module__ + "." + target.__qualname__,
                "binding": source_binding,
                "runtimeQualification": "NOT_PROVEN",
            }
        )
        source_name = source_binding.get("source")
        if source_name:
            registered_sources.setdefault((source_name, target.__name__), []).append(
                name
            )
    scheduled_tasks = [
        {"name": name, "task": entry.get("task")}
        for name, entry in sorted(celery_app.conf.beat_schedule.items())
    ]
    for entry in scheduled_tasks:
        if entry["task"] not in celery_app.tasks:
            unresolved.append(
                {
                    "route": "celery-beat:" + entry["name"],
                    "reason": "SCHEDULED_TASK_NOT_REGISTERED:" + str(entry["task"]),
                }
            )
    for file in sorted(backend.rglob("*.py")):
        if {"migrations", "__pycache__", "tests"} & set(file.parts) or file.name.startswith(
            "test_"
        ):
            continue
        relative = file.relative_to(backend)
        tree = ast.parse(file.read_text(encoding="utf-8-sig"), filename=str(file))
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            decorators = [ast.unparse(decorator) for decorator in node.decorator_list]
            if not any(
                "shared_task" in decorator or ".task" in decorator
                for decorator in decorators
            ):
                continue
            tasks.append(
                {
                    "id": relative.as_posix() + "#" + node.name,
                    "source": file.relative_to(root).as_posix(),
                    "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                    "line": node.lineno,
                    "decorators": decorators,
                    "registeredNames": registered_sources.get(
                        (file.relative_to(root).as_posix(), node.name), []
                    ),
                    "registration": (
                        "REGISTERED_BY_CURRENT_CELERY_APPLICATION"
                        if (file.relative_to(root).as_posix(), node.name)
                        in registered_sources
                        else "NOT_REGISTERED_BY_CURRENT_CELERY_APPLICATION"
                    ),
                    "runtimeQualification": "NOT_PROVEN",
                }
            )
    graph = python_mutation_graph(
        root,
        backend,
        [
            {"id": route["id"], "callable": route["callable"]}
            for route in routes
            if route["binding"].get("source")
        ]
        + [
            {"id": "celery:" + task["name"], "callable": task["callable"]}
            for task in registered_tasks
        ],
        {
            model.__module__ + "." + model.__qualname__: model._meta.db_table
            for model in apps.get_models(include_auto_created=True)
        },
    )
    return {
        "routes": routes,
        "frameworkOwnedRoutes": framework_owned_routes,
        "taskCandidates": tasks,
        "registeredTasks": registered_tasks,
        "scheduledTasks": scheduled_tasks,
        "mutationGraph": graph,
        "unresolved": unresolved,
        "denominatorComplete": False,
        "limitations": [
            "Resolved Django URL dispatch includes inherited DRF handlers and admin registrations.",
            "HTTP methods alone do not establish mutation reachability; GET side effects require call-graph reconciliation.",
            "Celery registrations are collected from the actual finalized application after default imports and autodiscovery.",
            "A registered or scheduled task is a reachability root, not proof of its mutations or actor authority.",
            "Framework metadata is not caller/actor runtime qualification.",
        ],
    }


def main():
    root = Path(sys.argv[1]).resolve()
    backend = root / "apps" / "union-eyes" / "backend"
    import django

    lock = (backend / "requirements.lock").read_bytes()
    expected = next(
        line.split("==")[1].split()[0]
        for line in lock.decode().splitlines()
        if line.lower().startswith("django==")
    )
    if django.get_version() != expected:
        raise RuntimeError(
            f"UE_V2_DJANGO_LOCK_VERSION_REQUIRED:{expected}:actual={django.get_version()}"
        )
    if (backend / ".env").exists() or (backend / ".env.local").exists():
        raise RuntimeError("UE_V2_APPLICATION_ENV_FILE_FORBIDDEN")
    os.environ.update(
        {
            "DJANGO_SETTINGS_MODULE": "config.settings",
            "DJANGO_SECRET_KEY": "synthetic-offline-application-startup-key",
            "DJANGO_DEBUG": "False",
            "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1",
            "PGHOST": "127.0.0.1",
            "PGPORT": "1",
            "PGDATABASE": "ue_v2_clean_startup_only",
            "PGUSER": "union_eyes_runtime",
            "PGPASSWORD": "synthetic-not-a-live-credential",
            "REDIS_URL": "redis://127.0.0.1:1/0",
            "CELERY_BROKER_URL": "memory://",
            "CELERY_RESULT_BACKEND": "cache+memory://",
        }
    )
    sys.path.insert(0, str(backend))
    from django.db.backends.base.base import BaseDatabaseWrapper

    def deny_connection(*args, **kwargs):
        raise RuntimeError("UE_V2_APPLICATION_STARTUP_CONNECTION_FORBIDDEN")

    BaseDatabaseWrapper.connect = deny_connection
    from django.core.wsgi import get_wsgi_application

    application = get_wsgi_application()
    from django.conf import settings
    from django.core.checks import run_checks
    from django.urls import get_resolver

    errors = [str(error) for error in run_checks() if error.is_serious()]
    if errors:
        raise RuntimeError("UE_V2_CURRENT_APPLICATION_CHECK_FAILED:" + ";".join(errors))
    resolver = get_resolver()
    if not resolver.url_patterns:
        raise RuntimeError("UE_V2_CURRENT_APPLICATION_URLS_REQUIRED")
    if settings.ROOT_URLCONF != "config.urls":
        raise RuntimeError("UE_V2_CURRENT_APPLICATION_URLCONF_REQUIRED")
    from django.apps import apps

    print(
        json.dumps(
            {
                "lineage": "PROSPECTIVE_UE_BOOTSTRAP_V2",
                "contractVersion": "2.0",
                "djangoVersion": django.get_version(),
                "startup": "PASS" if application is not None else "FAIL",
                "currentSettings": settings.SETTINGS_MODULE,
                "modelChecks": "PASS",
                "urlChecks": "PASS",
                "rootUrlPatterns": len(resolver.url_patterns),
                "currentManagedModels": sum(
                    1
                    for model in apps.get_models(include_auto_created=True)
                    if model._meta.managed and not model._meta.proxy
                ),
                "databaseConnections": 0,
                "runtimeDatabaseQualification": "NOT_PROVEN",
                "executionInventory": execution_inventory(root, backend, resolver),
                "sourceDigests": {
                    path.relative_to(root)
                    .as_posix(): hashlib.sha256(path.read_bytes())
                    .hexdigest()
                    for path in sorted(backend.rglob("*.py"))
                    if "migrations" not in path.parts
                    and "__pycache__" not in path.parts
                },
            }
        )
    )


if __name__ == "__main__":
    main()
