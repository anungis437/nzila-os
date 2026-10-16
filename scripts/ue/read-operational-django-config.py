"""Extract configuration identities from supplied syntax without importing Django."""

import ast
import json
import sys


def constant(node):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError):
        return None


def read_source(file, text):
    tree = ast.parse(text, filename=file)
    assignments = {
        target.id: node.value
        for node in tree.body if isinstance(node, ast.Assign)
        for target in node.targets if isinstance(target, ast.Name)
    }
    result = {"FILE": file, "SOURCE_EXECUTED": False}
    for key in ("INSTALLED_APPS", "MIGRATION_MODULES", "AUTH_USER_MODEL"):
        if key in assignments:
            value = constant(assignments[key])
            result[key] = value
            result[key + "_LITERAL"] = value is not None
    result["DYNAMIC_CONFIG_ASSIGNMENTS"] = sorted({
        node.target.id for node in tree.body
        if isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name)
        and node.target.id in ("INSTALLED_APPS", "MIGRATION_MODULES")
    })
    result["SETTINGS_MODULE_DEFAULTS"] = [
        node.args[1].value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        and node.func.attr == "setdefault" and len(node.args) >= 2
        and isinstance(node.args[0], ast.Constant)
        and node.args[0].value == "DJANGO_SETTINGS_MODULE"
        and isinstance(node.args[1], ast.Constant)
        and isinstance(node.args[1].value, str)
    ]
    result["ENVIRONMENT_VARIABLE_NAMES"] = sorted({
        node.args[0].value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        and node.func.attr in ("get", "getenv", "setdefault") and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
        and node.args[0].value.isupper()
    })
    result["APP_CONFIG_NAMES"] = [
        value.value for node in tree.body if isinstance(node, ast.ClassDef)
        for entry in node.body if isinstance(entry, ast.Assign)
        for target in entry.targets if isinstance(target, ast.Name) and target.id == "name"
        for value in [entry.value]
        if isinstance(value, ast.Constant) and isinstance(value.value, str)
    ]
    return result


def self_test():
    result = read_source("test/settings.py", """
raise RuntimeError('must not execute')
import django
INSTALLED_APPS = ['auth_core']
MIGRATION_MODULES = {'auth_core': None}
PASSWORD = 'test-only-secret-must-not-serialize'
DATABASES = {'PASSWORD': PASSWORD}
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
""")
    assert result["INSTALLED_APPS"] == ["auth_core"]
    assert result["MIGRATION_MODULES"] == {"auth_core": None}
    assert result["SETTINGS_MODULE_DEFAULTS"] == ["config.settings"]
    assert "test-only-secret-must-not-serialize" not in json.dumps(result)
    dynamic = read_source("test/settings.py", "INSTALLED_APPS = get_apps()\nINSTALLED_APPS += extra")
    assert dynamic["INSTALLED_APPS_LITERAL"] is False
    assert dynamic["DYNAMIC_CONFIG_ASSIGNMENTS"] == ["INSTALLED_APPS"]
    print("PASS: syntax only, dynamic configuration explicit, no credential values serialized.")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif sys.argv[1:]:
        raise ValueError("Only stdin JSON or --self-test is supported")
    else:
        print(json.dumps([read_source(item["FILE"], item["TEXT"]) for item in json.load(sys.stdin)]))
