"""Patch ABR urls.py to add canlii-rate-limiter ViewSet registration."""

urls_path = r"D:\APPS\nzila-abr-insights\backend\services\api\urls.py"

with open(urls_path, "r") as f:
    lines = f.readlines()

imp_line = "from .canlii_rate_limiter_views import CanLIIRateLimiterViewSet\n"
reg_line = "router.register(r'canlii-rate-limiter', CanLIIRateLimiterViewSet, basename='canlii-rate-limiter')\n"

has_import = any("canlii_rate_limiter_views" in l for l in lines)
has_register = any("canlii-rate-limiter" in l for l in lines)

if not has_import:
    last_imp_idx = max(i for i, l in enumerate(lines) if l.strip().startswith("from ."))
    lines.insert(last_imp_idx + 1, imp_line)
    print(f"Inserted import at line {last_imp_idx + 2}")

if not has_register:
    last_reg_idx = max(i for i, l in enumerate(lines) if l.strip().startswith("router.register"))
    lines.insert(last_reg_idx + 1, reg_line)
    print(f"Inserted registration at line {last_reg_idx + 2}")

if not has_import or not has_register:
    with open(urls_path, "w") as f:
        f.writelines(lines)
    print("urls.py patched successfully")
else:
    print("Already up to date")
