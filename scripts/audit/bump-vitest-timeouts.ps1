# Bulk-patch per-project vitest configs missing testTimeout/hookTimeout to
# accommodate dynamic-import cold-start under monorepo-scale parallel runners
# on Windows. Idempotent — skips any config that already sets testTimeout.

$ErrorActionPreference = 'Stop'

$configs = Get-ChildItem -Path apps,packages,tooling,services -Recurse -Filter 'vitest.config.ts' -File -ErrorAction SilentlyContinue

$patched = 0
$skipped = 0
$failed = @()

foreach ($cfg in $configs) {
    $path = $cfg.FullName
    # Read whole file, then split explicitly so we control line boundaries and
    # never carry a stray CR into the captured indent.
    $raw = [System.IO.File]::ReadAllText($path)
    if ($raw -match 'testTimeout') { $skipped++; continue }

    $rawLf = $raw -replace "`r`n", "`n" -replace "`r", "`n"
    $lines = $rawLf.Split("`n")

    $idx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^[ \t]*test[ \t]*:[ \t]*\{[ \t]*$') { $idx = $i; break }
    }
    if ($idx -lt 0) { $failed += $path; continue }

    # Determine child indent from the first non-blank line inside the block.
    # Use `[ \t]` explicitly so \r/\n can never leak into the captured indent.
    $childIndent = '    '
    for ($j = $idx + 1; $j -lt $lines.Count; $j++) {
        $ln = $lines[$j]
        if ($ln -match '^[ \t]*$') { continue }
        if ($ln -match '^([ \t]+)\S') { $childIndent = $Matches[1]; break }
        break
    }

    $inject = @(
        "$childIndent// Dynamic-import barrel/route tests can exceed the 5s vitest default under",
        "$childIndent// monorepo-scale parallel runners on Windows; 30s provides comfortable headroom.",
        ($childIndent + 'testTimeout: 30_000,'),
        ($childIndent + 'hookTimeout: 30_000,')
    )

    $out = New-Object System.Collections.Generic.List[string]
    for ($k = 0; $k -lt $lines.Count; $k++) {
        [void]$out.Add($lines[$k])
        if ($k -eq $idx) {
            foreach ($inj in $inject) { [void]$out.Add($inj) }
        }
    }

    $newText = [string]::Join("`n", $out)
    [System.IO.File]::WriteAllText($path, $newText, [System.Text.UTF8Encoding]::new($false))
    $patched++
}

"Patched: $patched"
"Skipped (already had testTimeout): $skipped"
"Failed to locate insertion point: $($failed.Count)"
if ($failed.Count -gt 0) { $failed | ForEach-Object { "  $_" } }
