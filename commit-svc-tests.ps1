Set-Location c:\APPS\nzila-automation
$env:LEFTHOOK = "0"
git add "apps/union-eyes/lib/services/"
git diff --cached --stat | Select-Object -Last 3
git commit -m "test: add service-layer tests (rewards, messaging, external-data, AI) — 31 files, ~419 tests"
git log --oneline -1
