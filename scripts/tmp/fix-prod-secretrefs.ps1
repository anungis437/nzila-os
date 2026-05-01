$ErrorActionPreference = 'Stop'
$rg = 'nzila-canada-staging-rg'
$apps = @('nzila-os-web','nzila-os-console','nzila-os-union-eyes','nzila-os-zonga','nzila-os-partners','nzila-os-control-plane','nzila-os-platform-admin')

function Invoke-AzJson {
  param([string[]]$AzArgs)
  $out = az @AzArgs -o json 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out | Out-String) }
  return ($out | Out-String | ConvertFrom-Json)
}

function Invoke-Az {
  param([string[]]$AzArgs)
  $out = az @AzArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out | Out-String) }
  return ($out | Out-String)
}

function Get-SensitiveEnvKeys {
  param($appJson)
  $keys = @()
  $containers = @($appJson.properties.template.containers)
  foreach ($c in $containers) {
    foreach ($e in @($c.env)) {
      if ($null -ne $e -and $e.PSObject.Properties.Name -contains 'name') {
        $hasValue = $e.PSObject.Properties.Name -contains 'value'
        if ($hasValue -and $null -ne $e.value -and ($e.name -match '(?i)(secret|token|password|credential|private[_-]?key|client[_-]?secret|auth[_-]?secret|api[_-]?key)')) {
          $keys += $e.name
        }
      }
    }
  }
  return ($keys | Sort-Object -Unique)
}

function Get-EnvValue {
  param($appJson, [string]$key)
  $containers = @($appJson.properties.template.containers)
  foreach ($c in $containers) {
    foreach ($e in @($c.env)) {
      if ($null -ne $e -and $e.name -eq $key -and ($e.PSObject.Properties.Name -contains 'value')) {
        return [string]$e.value
      }
    }
  }
  return $null
}

function Get-ContainerForKey {
  param($appJson, [string]$key)
  $containers = @($appJson.properties.template.containers)
  foreach ($c in $containers) {
    foreach ($e in @($c.env)) {
      if ($null -ne $e -and $e.name -eq $key) {
        return [string]$c.name
      }
    }
  }
  # fallback: first container
  if ($containers.Count -gt 0) { return [string]$containers[0].name }
  return $null
}

function Normalize-SecretName {
  param([string]$key)
  $s = $key.ToLowerInvariant() -replace '_','-' -replace '[^a-z0-9-]','-' -replace '-+','-'
  $s = $s.Trim('-')
  if ([string]::IsNullOrWhiteSpace($s)) { $s = 'secret-ref' }
  if ($s.Length -gt 50) { $s = $s.Substring(0,50).Trim('-') }
  return "prod-$s"
}

$pending = [System.Collections.Generic.HashSet[string]]::new()
$apps | ForEach-Object { [void]$pending.Add($_) }
$round = 0
$maxRounds = 6

while ($pending.Count -gt 0 -and $round -lt $maxRounds) {
  $round++
  Write-Host "Round $round - pending apps: $($pending.Count)"
  $doneThisRound = @()

  foreach ($app in @($pending)) {
    try {
      $json = Invoke-AzJson @('containerapp','show','-g',$rg,'-n',$app)
      $keys = Get-SensitiveEnvKeys -appJson $json

      if ($keys.Count -eq 0) {
        Write-Host "  $app : no sensitive plain env values"
        $doneThisRound += $app
        continue
      }

      Write-Host "  $app : converting $($keys.Count) keys"
      foreach ($k in $keys) {
        $v = Get-EnvValue -appJson $json -key $k
        if ($null -eq $v) { continue }
        $secretName = Normalize-SecretName -key $k
        $hasNewlines = $v -match "`n|\r"
        $cn = Get-ContainerForKey -appJson $json -key $k
        $updateArgs = @('containerapp','update','-g',$rg,'-n',$app,'--set-env-vars',"$k=secretref:$secretName")
        if ($null -ne $cn) { $updateArgs += @('--container-name',$cn) }

        if ($hasNewlines) {
          # Use az rest for multi-line values (e.g., PEM keys) to avoid CLI arg parsing issues
          Write-Host "    $k : multi-line value detected, using REST API path"
          try {
            $subId = (az account show -o tsv --query id 2>$null)
            $secretPayload = @{ properties = @{ configuration = @{ secrets = @(@{ name = $secretName; value = $v }) } } } | ConvertTo-Json -Depth 10 -Compress
            $url = "https://management.azure.com/subscriptions/$subId/resourceGroups/$rg/providers/Microsoft.App/containerApps/$app`?api-version=2024-03-01"
            $restOut = az rest --method PATCH --url $url --body $secretPayload --headers "Content-Type=application/json" 2>&1
            if ($LASTEXITCODE -ne 0) { throw ($restOut | Out-String) }
            Write-Host "    $k : secret created via REST"
            Invoke-Az $updateArgs | Out-Null
            Write-Host "    $k -> secretref:$secretName"
          } catch {
            Write-Warning "    $k : REST path failed -> $($_.Exception.Message)"
            Write-Host "    MANUAL ACTION REQUIRED: set secret '$secretName' for app '$app' manually, then re-run"
          }
        } else {
          try {
            Invoke-Az @('containerapp','secret','set','-g',$rg,'-n',$app,'--secrets',"$secretName=$v") | Out-Null
            Invoke-Az $updateArgs | Out-Null
            Write-Host "    $k -> secretref:$secretName"
          } catch {
            Write-Warning "    $k : failed -> $($_.Exception.Message)"
          }
        }
      }

      $after = Invoke-AzJson @('containerapp','show','-g',$rg,'-n',$app)
      $afterKeys = Get-SensitiveEnvKeys -appJson $after
      if ($afterKeys.Count -eq 0) {
        Write-Host "  $app : conversion verified"
        $doneThisRound += $app
      } else {
        Write-Host "  $app : still pending ($($afterKeys -join ', '))"
      }
    }
    catch {
      $msg = $_.Exception.Message
      if ($msg -match 'ContainerAppOperationInProgress|Another operation is in progress|provisioning') {
        Write-Host "  $app : locked, retrying in next round"
      } else {
        Write-Host "  $app : error -> $msg"
      }
    }
  }

  foreach ($d in $doneThisRound) { [void]$pending.Remove($d) }
}

$summary = @()
foreach ($app in $apps) {
  try {
    $json = Invoke-AzJson @('containerapp','show','-g',$rg,'-n',$app)
    $keys = Get-SensitiveEnvKeys -appJson $json
    $summary += [pscustomobject]@{ app = $app; sensitivePlainValueCount = $keys.Count; sensitivePlainValueKeys = $keys }
  } catch {
    $summary += [pscustomobject]@{ app = $app; sensitivePlainValueCount = -1; sensitivePlainValueKeys = @('error') }
  }
}

$summary | ConvertTo-Json -Depth 10
