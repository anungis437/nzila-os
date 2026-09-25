param(
  [string]$OutputPath = "docs/engineering-convergence/2026-09-25_P0_2_REPOSITORY_TOPOLOGY.md"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $result = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
  return @($result)
}

function Get-Count {
  param([string[]]$Values)
  return @($Values | Where-Object { $_ -ne $null -and $_ -ne "" }).Count
}

function Escape-Cell {
  param([AllowEmptyString()][string]$Value)
  return ($Value -replace "\|", "\|")
}

$baseline = @(Invoke-Git rev-parse origin/main)[0]
$capturedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$localRefs = @(Invoke-Git for-each-ref --format="%(refname:short)|%(objectname)|%(upstream:short)|%(upstream:track)" refs/heads)
$remoteRefs = @(
  Invoke-Git for-each-ref --format="%(refname:short)|%(objectname)" refs/remotes/origin |
    Where-Object { $_ -notmatch "^origin(?:/HEAD|/main)?\|" }
)
$stashRows = @(Invoke-Git stash list --format="%gd|%H|%ci|%gs")
$worktreeLines = @(Invoke-Git worktree list --porcelain)

$openPrJson = & gh pr list --repo anungis437/nzila-os --state open --limit 200 `
  --json number,title,isDraft,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus,author,url
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read open pull requests"
}
$openPrs = @($openPrJson | ConvertFrom-Json)

$worktrees = @()
$current = $null
foreach ($line in $worktreeLines) {
  if ($line -like "worktree *") {
    if ($null -ne $current) { $worktrees += $current }
    $current = [ordered]@{ path = $line.Substring(9); head = ""; branch = "DETACHED" }
  } elseif ($line -like "HEAD *") {
    $current.head = $line.Substring(5)
  } elseif ($line -like "branch refs/heads/*") {
    $current.branch = $line.Substring(18)
  }
}
if ($null -ne $current) { $worktrees += $current }

$dirtyWorktrees = 0
$worktreeDetails = @()
foreach ($worktree in $worktrees) {
  $status = @(& git -C $worktree.path status --porcelain=v1)
  if ($LASTEXITCODE -ne 0) { throw "Unable to inspect $($worktree.path)" }
  $staged = @($status | Where-Object { $_.Substring(0, 1) -notin @(" ", "?") }).Count
  $modified = @($status | Where-Object {
    $_.Length -ge 2 -and $_.Substring(1, 1) -ne " " -and $_.Substring(0, 2) -ne "??"
  }).Count
  $untracked = @($status | Where-Object { $_.StartsWith("??") }).Count
  if ($status.Count -gt 0) { $dirtyWorktrees++ }
  $worktreeDetails += [ordered]@{
    path = $worktree.path
    branch = $worktree.branch
    head = $worktree.head
    status = $status
    staged = $staged
    modified = $modified
    untracked = $untracked
  }
}

$localOnly = @(Invoke-Git rev-list --branches --not --remotes=origin)
$remoteOnly = @(Invoke-Git rev-list --remotes=origin --not --branches)
$allOffMain = @(Invoke-Git rev-list --branches --remotes=origin --not origin/main)

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# P0.2 Repository Topology Snapshot")
$lines.Add("")
$lines.Add("**Captured:** $capturedAt")
$lines.Add("**Authoritative baseline:** ``origin/main`` at ``$baseline``")
$lines.Add("")
$lines.Add("This is a read-only engineering-estate census. It records Git topology and")
$lines.Add("working-copy state without assigning final value or deletion authority.")
$lines.Add("")
$lines.Add("## Census")
$lines.Add("")
$lines.Add("| Surface | Count |")
$lines.Add("| --- | ---: |")
$lines.Add("| Local branches | $($localRefs.Count) |")
$lines.Add("| Remote feature refs | $($remoteRefs.Count) |")
$lines.Add("| Worktrees | $($worktrees.Count) |")
$lines.Add("| Dirty worktrees | $dirtyWorktrees |")
$lines.Add("| Clean worktrees | $($worktrees.Count - $dirtyWorktrees) |")
$lines.Add("| Stashes | $($stashRows.Count) |")
$lines.Add("| Open pull requests | $($openPrs.Count) |")
$lines.Add("| Commits off ``origin/main`` across recorded refs | $($allOffMain.Count) |")
$lines.Add("| Commits reachable only from local refs | $($localOnly.Count) |")
$lines.Add("| Commits reachable only from remote refs | $($remoteOnly.Count) |")
$lines.Add("")
$lines.Add("The commit-set counts are object-reachability measurements. Squash merges can")
$lines.Add("leave a feature tip outside ``main`` even when its effective change was merged;")
$lines.Add("P0.3 must inspect content before assigning a disposition.")
$lines.Add("")
$lines.Add("## Local branches")
$lines.Add("")
$lines.Add("| Branch | Head | Upstream | Track | Ahead | Behind | Tip ancestor of main |")
$lines.Add("| --- | --- | --- | --- | ---: | ---: | --- |")
foreach ($row in $localRefs) {
  $parts = $row -split "\|", 4
  $branch = $parts[0]
  $ahead = @(Invoke-Git rev-list --count "origin/main..$branch")[0]
  $behind = @(Invoke-Git rev-list --count "$branch..origin/main")[0]
  & git merge-base --is-ancestor $parts[1] origin/main 2>$null
  $ancestor = if ($LASTEXITCODE -eq 0) { "yes" } else { "no" }
  $lines.Add("| $(Escape-Cell $branch) | ``$($parts[1])`` | $(Escape-Cell $parts[2]) | $(Escape-Cell $parts[3]) | $ahead | $behind | $ancestor |")
}
$lines.Add("")
$lines.Add("## Remote feature refs")
$lines.Add("")
$lines.Add("| Ref | Head | Ahead | Behind | Open PR |")
$lines.Add("| --- | --- | ---: | ---: | --- |")
foreach ($row in $remoteRefs) {
  $parts = $row -split "\|", 2
  $ref = $parts[0]
  $headName = $ref.Substring(7)
  $ahead = @(Invoke-Git rev-list --count "origin/main..$ref")[0]
  $behind = @(Invoke-Git rev-list --count "$ref..origin/main")[0]
  $pr = @($openPrs | Where-Object { $_.headRefName -eq $headName })
  $prCell = if ($pr.Count -gt 0) { "#$($pr[0].number)" } else { "none" }
  $lines.Add("| $(Escape-Cell $ref) | ``$($parts[1])`` | $ahead | $behind | $prCell |")
}
$lines.Add("")
$lines.Add("## Worktrees")
$lines.Add("")
$lines.Add("| Path | Branch | Head | Staged | Modified | Untracked |")
$lines.Add("| --- | --- | --- | ---: | ---: | ---: |")
foreach ($worktree in $worktreeDetails) {
  $lines.Add("| $(Escape-Cell $worktree.path) | $(Escape-Cell $worktree.branch) | ``$($worktree.head)`` | $($worktree.staged) | $($worktree.modified) | $($worktree.untracked) |")
}
$lines.Add("")
$lines.Add("## Dirty worktree paths")
$lines.Add("")
foreach ($worktree in $worktreeDetails | Where-Object { $_.status.Count -gt 0 }) {
  $lines.Add("### $(Escape-Cell $worktree.path)")
  $lines.Add("")
  $lines.Add('```text')
  foreach ($statusLine in $worktree.status) { $lines.Add($statusLine) }
  $lines.Add('```')
  $lines.Add("")
}
$lines.Add("## Stashes")
$lines.Add("")
$lines.Add("| Stash | Object | Timestamp | Description |")
$lines.Add("| --- | --- | --- | --- |")
foreach ($row in $stashRows) {
  $parts = $row -split "\|", 4
  $lines.Add("| $(Escape-Cell $parts[0]) | ``$($parts[1])`` | $(Escape-Cell $parts[2]) | $(Escape-Cell $parts[3]) |")
}
$lines.Add("")
$lines.Add("## Open pull requests")
$lines.Add("")
$lines.Add("| PR | Head | SHA | Draft | Mergeability | Merge state | Owner | Title |")
$lines.Add("| ---: | --- | --- | --- | --- | --- | --- | --- |")
foreach ($pr in $openPrs | Sort-Object number -Descending) {
  $lines.Add("| [#$($pr.number)]($($pr.url)) | $(Escape-Cell $pr.headRefName) | ``$($pr.headRefOid)`` | $($pr.isDraft) | $($pr.mergeable) | $($pr.mergeStateStatus) | $(Escape-Cell $pr.author.login) | $(Escape-Cell $pr.title) |")
}
$lines.Add("")
$lines.Add("## P0.2 disposition")
$lines.Add("")
$lines.Add('```text')
$lines.Add("REPOSITORY_TOPOLOGY_CAPTURED = PASS")
$lines.Add("ESTATE_CLASSIFICATION = NOT YET COMPLETE")
$lines.Add("UNACCOUNTED_DEVELOPMENT != 0")
$lines.Add("SAAS_ACTIVATION = PAUSED")
$lines.Add('```')

$parent = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $parent | Out-Null
$lines | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "Wrote $OutputPath"
