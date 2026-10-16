"""Read supplied, previously inventoried Python sources as syntax, never import them."""

import ast
import json
import sys


def assignments(nodes):
    result = {}
    for node in nodes:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    result[target.id] = node.value
    return result


def literal(node):
    if node is None:
        return None
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return {"UNRESOLVED_EXPRESSION": ast.unparse(node)}


def name(node):
    return ast.unparse(node.func) if isinstance(node, ast.Call) else None


def operations(node, state_only=False):
    if node is None:
        return []
    if not isinstance(node, (ast.List, ast.Tuple)):
        return [{
            "OPERATION": "SOURCE_CEILING",
            "EXPRESSION": ast.unparse(node),
            "STATE_ONLY": state_only,
            "LINE": node.lineno,
        }]
    result = []
    for entry in node.elts:
        if not isinstance(entry, ast.Call):
            result.append({
                "OPERATION": "SOURCE_CEILING", "EXPRESSION": ast.unparse(entry),
                "STATE_ONLY": state_only, "LINE": entry.lineno,
            })
            continue
        kwargs = {kw.arg: kw.value for kw in entry.keywords if kw.arg is not None}
        operation = name(entry).split(".")[-1]
        if operation == "SeparateDatabaseAndState":
            result.extend(operations(kwargs.get("database_operations")))
            result.extend(operations(kwargs.get("state_operations"), True))
            continue
        result.append({
            "OPERATION": operation,
            "STATE_ONLY": state_only,
            "MODEL_NAME": literal(kwargs.get("model_name")),
            "NAME": literal(kwargs.get("name")),
            "OLD_NAME": literal(kwargs.get("old_name")),
            "NEW_NAME": literal(kwargs.get("new_name")),
            "OPTIONS": literal(kwargs.get("options")),
            "FOREIGN_KEY_TARGETS": sorted({
                value.value
                for call in ast.walk(entry)
                if isinstance(call, ast.Call)
                and name(call).split(".")[-1] in ("ForeignKey", "OneToOneField", "ManyToManyField")
                for value in [
                    next((kw.value for kw in call.keywords if kw.arg == "to"), None)
                ]
                if isinstance(value, ast.Constant) and isinstance(value.value, str)
            }),
            "EXPRESSION": ast.unparse(entry),
            "LINE": entry.lineno,
        })
    return result


def read_source(file, text):
    tree = ast.parse(text, filename=file)
    values = assignments(tree.body)
    if file.endswith("/config/settings.py"):
        database = values.get("DATABASES")
        bindings = {}
        if isinstance(database, ast.Dict):
            default = next(
                (value for key, value in zip(database.keys, database.values)
                 if isinstance(key, ast.Constant) and key.value == "default"), None,
            )
            if isinstance(default, ast.Dict):
                bindings = {
                    key.value: ast.unparse(value)
                    for key, value in zip(default.keys, default.values)
                    if isinstance(key, ast.Constant)
                    and key.value in ("ENGINE", "NAME", "HOST", "PORT")
                }
        return {
            "FILE": file,
            "INSTALLED_APPS": literal(values.get("INSTALLED_APPS")),
            "AUTH_USER_MODEL": literal(values.get("AUTH_USER_MODEL")),
            "DATABASE_IDENTITY_FIELD_BINDINGS": bindings,
            "CREDENTIAL_EXPRESSIONS_SERIALIZED": False,
        }
    migration = next(
        (node for node in tree.body if isinstance(node, ast.ClassDef)
         and node.name == "Migration"), None,
    )
    if migration is None:
        raise ValueError(f"Migration class missing in inventoried file: {file}")
    values = assignments(migration.body)
    dependency_node = values.get("dependencies")
    if not isinstance(dependency_node, (ast.List, ast.Tuple)):
        raise ValueError(f"Dependencies are not an explicit list in {file}")
    dependencies = []
    for dependency in dependency_node.elts:
        value = literal(dependency)
        literal_pair = isinstance(value, tuple) and len(value) == 2 and all(
            isinstance(part, str) for part in value
        )
        dependencies.append({
            "KIND": "LITERAL" if literal_pair else "DYNAMIC",
            "APP": value[0] if literal_pair else None,
            "MIGRATION": value[1] if literal_pair else None,
            "EXPRESSION": ast.unparse(dependency),
            "LINE": dependency.lineno,
        })
    return {
        "FILE": file, "DEPENDENCIES": dependencies,
        "OPERATIONS": operations(values.get("operations")),
        "RUN_BEFORE": literal(values.get("run_before")) or [],
        "REPLACES": literal(values.get("replaces")) or [],
    }


def self_test():
    sample = """
raise RuntimeError('must never execute')
class Migration:
    dependencies = [('auth_core', '0001_initial'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[migrations.RemoveField(model_name='organizations', name='old')],
            database_operations=[]),
        migrations.AddField(model_name='organizations', name='new', field=models.TextField()),
    ]
"""
    result = read_source("test/migrations/sample.py", sample)
    assert len(result["DEPENDENCIES"]) == 2
    assert result["DEPENDENCIES"][1]["KIND"] == "DYNAMIC"
    assert result["OPERATIONS"][0]["STATE_ONLY"] is True
    assert result["OPERATIONS"][1]["STATE_ONLY"] is False
    model = read_source("test/migrations/model.py", """
class Migration:
    dependencies = []
    operations = [migrations.CreateModel(name='Child', fields=[
        ('parent', models.ForeignKey(to='auth_core.organizations', on_delete=models.CASCADE))
    ], options={'db_table':'child'})]
""")
    assert model["OPERATIONS"][0]["FOREIGN_KEY_TARGETS"] == ["auth_core.organizations"]
    settings = read_source("test/config/settings.py", """
INSTALLED_APPS = ['auth_core']
DATABASES = {'default': {'NAME': 'test_db', 'HOST': 'localhost',
                        'PASSWORD': 'test-only-do-not-serialize'}}
""")
    assert settings["DATABASE_IDENTITY_FIELD_BINDINGS"]["NAME"] == "'test_db'"
    assert "test-only-do-not-serialize" not in json.dumps(settings)
    assert literal(ast.parse("dangerous()", mode="eval").body) == {
        "UNRESOLVED_EXPRESSION": "dangerous()"
    }
    print("PASS: AST-only reading, no source execution, dynamic dependency and state-only operations.")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif sys.argv[1:]:
        raise ValueError("Use stdin JSON sources or --self-test; filesystem discovery is not supported")
    else:
        payload = json.load(sys.stdin)
        print(json.dumps([read_source(item["FILE"], item["TEXT"]) for item in payload]))
