"""Quick ABR backend audit script."""
import os, re

base = r"D:\APPS\nzila-abr-insights\backend"
apps = ["ai_core","analytics","auth_core","billing","compliance","content","core","notifications"]

for app in apps:
    vf = os.path.join(base, app, "views.py")
    uf = os.path.join(base, app, "urls.py")
    if not os.path.isfile(vf):
        continue
    with open(vf, encoding="utf-8", errors="replace") as f:
        content = f.read()
    with open(uf, encoding="utf-8", errors="replace") as f:
        ucontent = f.read()
    
    names = re.findall(r"^(?:class|def) (\w+)", content, re.MULTILINE)
    routes = re.findall(r"path\(['\"]([^'\"]+)", ucontent)
    print(f"\n=== {app} ({len(names)} defs) ===")
    print(f"  Classes/funcs: {', '.join(names[:20])}")
    print(f"  Routes: {', '.join(routes[:20])}")
