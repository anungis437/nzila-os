#!/usr/bin/env python3
"""Static Python backend entrypoint candidates; no Django or Celery imports, no I/O to services."""
import ast
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
PREFIX = "apps/union-eyes/backend/"
SHA = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
dirty = subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=all", "--", PREFIX], cwd=ROOT, text=True)
if dirty.strip():
    raise SystemExit("Dirty Python source scope")
files = sorted(x.decode() for x in subprocess.check_output(["git", "ls-files", "-z", "--", PREFIX], cwd=ROOT).split(b"\0") if x)
records, errors = [], []
names = {"path", "re_path", "include", "register", "add_url_rule", "shared_task", "task", "receiver", "connect", "autodiscover_tasks", "add_periodic_task", "send_task", "apply_async", "delay"}

def suffix(n):
    if isinstance(n, ast.Name):
        return n.id
    if isinstance(n, ast.Attribute):
        return n.attr
    return ""

def argument(n):
    if isinstance(n, ast.Constant):
        return n.value if isinstance(n.value, (str, int, float, bool, type(None))) else repr(n.value)
    return ast.unparse(n)

def discover(tree):
    candidates = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Call) and suffix(n.func) in names:
            # Syntax only: similarly named unrelated calls remain visible.
            candidates.append({"kind": "CALL_CANDIDATE", "line": n.lineno, "column": n.col_offset,
                "symbol": ast.unparse(n.func), "arguments": [argument(x) for x in n.args[:3]],
                "keywords": [x.arg for x in n.keywords]})
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            for d in n.decorator_list:
                target = d.func if isinstance(d, ast.Call) else d
                if suffix(target) in names:
                    candidates.append({"kind": "DECORATOR_CANDIDATE", "line": d.lineno, "column": d.col_offset,
                        "symbol": ast.unparse(target), "declaration": n.name})
        if isinstance(n, (ast.Assign, ast.AnnAssign)):
            targets = n.targets if isinstance(n, ast.Assign) else [n.target]
            for target in targets:
                if isinstance(target, ast.Name) and target.id in {
                    "urlpatterns", "INSTALLED_APPS", "CELERY_BEAT_SCHEDULE", "CELERY_TASK_ROUTES",
                    "CELERY_TASK_QUEUES", "ROOT_URLCONF", "REST_FRAMEWORK"}:
                    candidates.append({"kind": "CONFIGURATION_CANDIDATE","line": n.lineno,"column": n.col_offset,"symbol": target.id})
    return sorted(candidates,key=lambda x:(x["line"],x["column"],x["kind"]))

for name in files:
    if not name.endswith(".py"):
        continue
    rel = pathlib.PurePosixPath(name)
    if any(x in {"migrations", "tests", "__pycache__"} for x in rel.parts) or rel.name.startswith("test_") or rel.name.endswith("_test.py"):
        continue
    data = (ROOT / name).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    try:
        tree = ast.parse(data, filename=name)
        found = discover(tree)
        records.append({"path": name, "sha256": digest, "candidates": found})
    except (SyntaxError, ValueError) as exc:
        errors.append({"path": name, "sha256": digest, "error": str(exc)})
output = {"record":"UE_STEP1_PYTHON_ENTRYPOINT_CENSUS","sourceSha":SHA,"decision":"STEP1_OPEN_STEP2_HELD",
    "filesParsed":len(records),"parseFailures":errors,"candidateCount":sum(len(r["candidates"]) for r in records),"files":records,
    "limitations":["Syntax candidates only, not registered Django endpoints, task IDs, callable reachability or deploy exposure.",
                   "Aliases, dynamically constructed handlers and service/worker transitive calls require additional resolution.",
                   "No application module imported or external task invoked."]}
dest=pathlib.Path(sys.argv[1]).resolve()
if dest==ROOT or ROOT in dest.parents:
    raise SystemExit("Output must be outside checkout")
dest.write_text(json.dumps(output,indent=2)+"\n",encoding="utf8")
print(json.dumps({k:v for k,v in output.items() if k not in {"files","parseFailures"}},indent=2))
if errors:
    raise SystemExit(1)
