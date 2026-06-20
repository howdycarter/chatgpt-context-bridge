param(
  [string]$LaunchConfigPath = "social/launch-posts.json",
  [string]$EnvFile = "C:\Users\built\Documents\Socials\.env.local",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Read-EnvFileValue {
  param([string]$Path, [string]$Name)
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$Name=(.*)$" } | Select-Object -First 1
  if ($line -and $line -match "^$Name=(.*)$") {
    return $Matches[1]
  }
  return $null
}

$repoRoot = (Resolve-Path ".").Path
$configFullPath = Join-Path $repoRoot $LaunchConfigPath
if (-not (Test-Path -LiteralPath $configFullPath)) {
  throw "Missing launch config: $configFullPath"
}

$config = Get-Content -LiteralPath $configFullPath -Raw | ConvertFrom-Json
$repoGitUrl = "$($config.repoUrl).git"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$repoCheckOutput = & git ls-remote $repoGitUrl 2>&1
$repoCheckExit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($repoCheckExit -ne 0) {
  throw "Public repo is not reachable yet: $repoGitUrl"
}

if (-not $env:OMNISOCIALS_API_KEY) {
  $env:OMNISOCIALS_API_KEY = Read-EnvFileValue -Path $EnvFile -Name "OMNISOCIALS_API_KEY"
}
if (-not $env:OMNISOCIALS_API_KEY) {
  throw "OMNISOCIALS_API_KEY is missing. Set it or provide a valid EnvFile."
}

$headers = @{
  Authorization = "Bearer $env:OMNISOCIALS_API_KEY"
  "Content-Type" = "application/json"
}

$accountsResponse = Invoke-RestMethod -Method Get -Uri "https://api.omnisocials.com/v1/accounts" -Headers @{ Authorization = "Bearer $env:OMNISOCIALS_API_KEY" }
$activeAccountIds = @($accountsResponse.data | Where-Object { $_.status -eq "active" } | ForEach-Object { "$($_.id)" })

$created = @()
foreach ($post in $config.posts) {
  foreach ($accountId in @($post.accounts)) {
    if ($activeAccountIds -notcontains "$accountId") {
      throw "Configured account is not active or not connected: $accountId"
    }
  }

  $body = @{
    content = $post.content
    accounts = @($post.accounts)
    scheduled_at = $post.scheduled_at
  } | ConvertTo-Json -Depth 20

  if ($DryRun) {
    $created += [pscustomobject]@{
      name = $post.name
      status = "dry_run"
      scheduled_at = $post.scheduled_at
      accounts = @($post.accounts)
    }
    continue
  }

  $response = Invoke-RestMethod -Method Post -Uri "https://api.omnisocials.com/v1/posts/create" -Headers $headers -Body $body
  $created += [pscustomobject]@{
    name = $post.name
    status = "created"
    scheduled_at = $post.scheduled_at
    accounts = @($post.accounts)
    response_id = $response.data.id
  }
}

$proof = [pscustomobject]@{
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  repo_url = $config.repoUrl
  dry_run = [bool]$DryRun
  created = $created
}

$proofPath = Join-Path $repoRoot "social/launch-schedule-proof.json"
$proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $proofPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 20
