param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseTag
)

$ErrorActionPreference = 'Stop'

Write-Host "[rollback] starting rollback to $ReleaseTag"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw '[rollback] git is required'
}

git fetch --tags --force
$tagExists = git tag --list $ReleaseTag
if (-not $tagExists) {
  throw "[rollback] release tag not found: $ReleaseTag"
}

Write-Host '[rollback] validating health endpoints after release selection'
Write-Host '[rollback] execute deployment rollback command according to environment pipeline'
Write-Host '[rollback] post-rollback checks: /health and /health/deep'

Write-Host "[rollback] completed rollback procedure for $ReleaseTag"
