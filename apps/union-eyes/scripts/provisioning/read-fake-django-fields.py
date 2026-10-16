"""Read Django field declarations as syntax only; never import migration modules."""

import ast
import hashlib
import json
import sys


def run_sql_expansion(node, module_assignments, expansions):
    if len(node.generators) != 1:
        return None
    generator = node.generators[0]
    if (
        generator.is_async
        or generator.ifs
        or not isinstance(generator.target, ast.Name)
        or not isinstance(generator.iter, ast.Name)
        or not isinstance(node.elt, ast.Call)
        or ast.unparse(node.elt.func) != "migrations.RunSQL"
        or node.elt.args
    ):
        return None
    keywords = {keyword.arg: keyword.value for keyword in node.elt.keywords}
    sql = keywords.get("sql")
    reverse = keywords.get("reverse_sql")
    if (
        len(node.elt.keywords) != 2
        or set(keywords) != {"sql", "reverse_sql"}
        or not isinstance(sql, ast.Name)
        or sql.id != generator.target.id
        or reverse is None
        or ast.unparse(reverse) != "migrations.RunSQL.noop"
    ):
        return None
    iterable = module_assignments.get(generator.iter.id)
    if not isinstance(iterable, (ast.List, ast.Tuple)) or any(
        not isinstance(item, ast.Constant) or not isinstance(item.value, str)
        for item in iterable.elts
    ):
        return None
    statements = [item.value for item in iterable.elts]
    expansions.append(
        {
            "EXPRESSION": ast.unparse(node),
            "LINE": node.lineno,
            "END_LINE": node.end_lineno,
            "ITERABLE": generator.iter.id,
            "ITERABLE_LINE": iterable.lineno,
            "ITERABLE_END_LINE": iterable.end_lineno,
            "STATEMENT_SHA256": [
                hashlib.sha256(statement.encode("utf-8")).hexdigest()
                for statement in statements
            ],
        }
    )
    return [
        {
            "call": "migrations.RunSQL",
            "args": [],
            "kwargs": {
                "sql": statement,
                "reverse_sql": {"symbol": "migrations.RunSQL.noop"},
            },
        }
        for statement in statements
    ]


def value(node, module_assignments=None, expansions=None):
    if module_assignments is None:
        module_assignments = {}
    if expansions is None:
        expansions = []
    if isinstance(node, ast.ListComp):
        expanded = run_sql_expansion(node, module_assignments, expansions)
        if expanded is not None:
            return expanded
    if isinstance(node, ast.Call):
        if any(keyword.arg is None for keyword in node.keywords):
            raise ValueError("FAKE_DJANGO_DYNAMIC_KEYWORDS_UNSUPPORTED")
        names = [keyword.arg for keyword in node.keywords]
        if len(names) != len(set(names)):
            raise ValueError("FAKE_DJANGO_DUPLICATE_KEYWORDS_UNSUPPORTED")
        return {
            "call": ast.unparse(node.func),
            "args": [value(arg, module_assignments, expansions) for arg in node.args],
            "kwargs": {
                keyword.arg: value(keyword.value, module_assignments, expansions)
                for keyword in node.keywords
            },
        }
    if isinstance(node, (ast.List, ast.Tuple)):
        return [value(item, module_assignments, expansions) for item in node.elts]
    if isinstance(node, ast.Dict):
        if any(
            not isinstance(key, ast.Constant) or not isinstance(key.value, str)
            for key in node.keys
        ):
            raise ValueError("FAKE_DJANGO_LITERAL_DICTIONARY_KEYS_REQUIRED")
        keys = [key.value for key in node.keys]
        if len(keys) != len(set(keys)):
            raise ValueError("FAKE_DJANGO_DUPLICATE_DICTIONARY_KEYS_UNSUPPORTED")
        return {
            key.value: value(item, module_assignments, expansions)
            for key, item in zip(node.keys, node.values)
        }
    if isinstance(node, ast.Constant):
        if not isinstance(node.value, (str, int, float, bool, type(None))):
            raise ValueError("FAKE_DJANGO_JSON_LITERAL_REQUIRED")
        return node.value
    if isinstance(node, (ast.Name, ast.Attribute)):
        return {"symbol": ast.unparse(node)}
    if (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, ast.USub)
        and isinstance(node.operand, ast.Constant)
        and type(node.operand.value) in (int, float)
    ):
        return -node.operand.value
    return {
        "UNRESOLVED_EXPRESSION": ast.unparse(node),
        "EXPRESSION_CLASS": type(node).__name__,
        "LINE": node.lineno,
        "END_LINE": node.end_lineno,
    }


def read_source(source):
    tree = ast.parse(source["TEXT"], filename=source["FILE"])
    migrations = [
        node
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == "Migration"
    ]
    if len(migrations) != 1:
        raise ValueError("FAKE_DJANGO_MIGRATION_CLASS_REQUIRED")
    migration = migrations[0]
    module_assignments = {}
    for node in tree.body:
        if node is migration:
            break
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if target.id in module_assignments:
                        raise ValueError("FAKE_DJANGO_DUPLICATE_MODULE_BINDING_UNSUPPORTED")
                    module_assignments[target.id] = node.value
    assignments = {}
    for node in migration.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    if target.id in assignments:
                        raise ValueError("FAKE_DJANGO_DUPLICATE_MIGRATION_BINDING_UNSUPPORTED")
                    assignments[target.id] = node.value
    for name in assignments:
        module_assignments.pop(name, None)
    operations = assignments.get("operations")
    if not isinstance(operations, ast.List):
        raise ValueError("FAKE_DJANGO_EXPLICIT_OPERATIONS_REQUIRED")
    extracted = []
    expansions = []
    for operation in operations.elts:
        try:
            declaration = value(operation, module_assignments, expansions)
        except ValueError as error:
            raise ValueError(f"{source['FILE']}:{operation.lineno}:{error}") from error
        extracted.append(
            {
                "LINE": operation.lineno,
                "END_LINE": operation.end_lineno,
                "VALUE": declaration,
            }
        )
    return {
        "FILE": source["FILE"],
        "SOURCE_SHA256": hashlib.sha256(source["TEXT"].encode()).hexdigest(),
        "DEPENDENCIES": value(assignments["dependencies"]),
        "OPERATIONS": extracted,
        "SYNTACTIC_EXPANSIONS": expansions,
    }


if __name__ == "__main__":
    if sys.argv[1:]:
        raise ValueError("Use stdin JSON only; no filesystem discovery or source execution")
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps([read_source(source) for source in json.load(sys.stdin)], allow_nan=False))
