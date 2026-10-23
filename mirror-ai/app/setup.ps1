# Mirror AI setup for Windows (PowerShell 5.1+)
# Run: .\setup.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$MinNodeMajor = 22
$EnvFile = Join-Path $Root ".env"
$EnvExample = Join-Path $Root ".env.example"

function Say($Text) { Write-Host $Text }
function Ask($Prompt, $Default = "") {
  if ($Default) { $r = Read-Host "$Prompt [$Default]" } else { $r = Read-Host $Prompt }
  if (-not $r -and $Default) { return $Default }
  return $r
}
function Ask-Secret($Prompt) {
  $sec = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Confirm($Prompt) {
  $r = Ask $Prompt "y"
  return $r -match '^[Yy]'
}

Say ""
Say "=============================================="
Say "  Mirror AI — setup (Windows)"
Say "=============================================="
Say ""
Say "Supported on Windows: web UI, static compare, CLI audits, Android-oriented workflows."
Say "Not supported on Windows: iOS screenshot rendering (requires macOS + Xcode)."
Say ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say "ERROR: Node.js not found. Install Node.js 22+ from https://nodejs.org/"
  exit 1
}
$nodeVer = (node -p "process.versions.node")
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt $MinNodeMajor) {
  Say "ERROR: Node.js $nodeVer found; need v$MinNodeMajor+."
  exit 1
}
Say "OK  Node $nodeVer"
Say "OK  npm $(npm -v)"

if (Get-Command git -ErrorAction SilentlyContinue) {
  Say "OK  git $(git --version)"
} else {
  Say "WARN git not found — install Git for Windows to clone remote repos."
  if (-not (Confirm "Continue without git?")) { exit 1 }
}

$hasClaude = $false
if (Get-Command claude -ErrorAction SilentlyContinue) {
  try { claude --version 2>$null | Out-Null; $hasClaude = $true; Say "OK  Claude Code CLI" } catch {}
}
if (-not $hasClaude) {
  Say "NOTE Claude Code CLI not found — set ANTHROPIC_API_KEY for audits."
}

$configureEnv = $false
if (Test-Path $EnvFile) {
  Say "Found existing .env"
  $configureEnv = Confirm "Update configuration interactively?"
} else {
  $configureEnv = $true
  if (Test-Path $EnvExample) { Copy-Item $EnvExample $EnvFile; Say "Created .env from .env.example" }
  else { New-Item -ItemType File -Path $EnvFile | Out-Null }
}

function Set-EnvLine($Key, $Value) {
  $lines = @()
  if (Test-Path $EnvFile) { $lines = Get-Content $EnvFile }
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$Key=") { $found = $true; "$Key=$Value" } else { $line }
  }
  if (-not $found) { $out += "$Key=$Value" }
  $out | Set-Content -Path $EnvFile -Encoding utf8
}

if ($configureEnv) {
  Say ""
  if (-not $hasClaude) {
    $apiKey = Ask-Secret "ANTHROPIC_API_KEY"
    if (-not $apiKey) {
      Say "ERROR: ANTHROPIC_API_KEY required without Claude CLI."
      exit 1
    }
    Set-EnvLine "ANTHROPIC_API_KEY" $apiKey
    Set-EnvLine "MIRROR_AI_RUNNER" "api"
  } else {
    $runner = Ask "Audit runner (cli|api|blank for auto)" ""
    if ($runner) {
      if ($runner -notin @("cli", "api")) { Say "ERROR: invalid runner"; exit 1 }
      Set-EnvLine "MIRROR_AI_RUNNER" $runner
    }
  }

  $bb = Ask "Configure Bitbucket credentials for private clones? (y/n)" "n"
  if ($bb -match '^[Yy]') {
    $u = Ask "BITBUCKET_USERNAME"
    $t = Ask-Secret "BITBUCKET_TOKEN"
    if (-not $u -or -not $t) { Say "ERROR: username and token required"; exit 1 }
    Set-EnvLine "BITBUCKET_USERNAME" $u
    Set-EnvLine "BITBUCKET_TOKEN" $t
  }

  $port = Ask "PORT" "4173"
  if ($port -notmatch '^\d+$' -or [int]$port -lt 1 -or [int]$port -gt 65535) {
    Say "ERROR: invalid port"; exit 1
  }
  Set-EnvLine "PORT" $port
  Say "Configuration saved to .env"
}

Say ""
if ((Test-Path (Join-Path $Root "node_modules")) -and -not (Confirm "Run npm install?")) {
  Say "Skipping npm install"
} else {
  Say "Installing npm dependencies…"
  npm install
}

New-Item -ItemType Directory -Force -Path (Join-Path $Root ".cache\repos") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root "generated reports") | Out-Null

Say ""
Say "Running tests…"
npm test
if ($LASTEXITCODE -ne 0) {
  Say "ERROR: tests failed"
  exit 1
}

Say ""
Say "Setup complete. Start with:  npm run serve"
Say "Documentation: README.md"
