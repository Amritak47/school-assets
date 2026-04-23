# =============================================================================
# Amrit - Claude Code Environment Setup (Windows)
# =============================================================================
# Run once on any Windows machine to get the full AI-augmented dev stack.
#
# What this installs:
#   1. uipro-cli            - UI/UX Pro Max skill (67 styles, 161 palettes)
#   2. superpowers          - Agentic dev methodology (TDD, debugging, code review)
#   3. everything-claude-code - Full agent harness (140 skills, 38 agents)
#   4. claude-mem           - Persistent cross-session memory
#   5. browser-use          - Browser automation skill + CLI
#   6. n8n-mcp              - n8n workflow MCP server (1,396 nodes)
#   7. sequential-thinking  - Structured reasoning MCP
#   8. context7             - Live library documentation MCP
#   9. duckduckgo-search    - Web search MCP (free, no API key)
#  10. postgres             - Database MCP (fill in your connection string)
#
# Usage (run as Administrator in PowerShell):
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#   C:\setup-windows.ps1
#
# Requirements (auto-installed if missing):
#   - winget (built into Windows 11 / Windows 10 1809+)
#   - Node.js 18+, Python 3.11+, git, uv
#   - Claude Code CLI: https://claude.ai/code
# =============================================================================

$ErrorActionPreference = "Stop"

function Write-Info    { Write-Host "[*] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Warn    { Write-Host "[!] $args" -ForegroundColor Yellow }
function Write-Err     { Write-Host "[X] $args" -ForegroundColor Red; exit 1 }
function Write-Header  { Write-Host "`n--- $args ---" -ForegroundColor Cyan }

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# -- Node.js ------------------------------------------------------------------
Write-Header "Checking Node.js"
$nodeOk = $false
try {
    $nodeVer = (node --version 2>$null) -replace 'v', '' | ForEach-Object { [int]($_ -split '\.')[0] }
    if ($nodeVer -ge 18) { $nodeOk = $true }
} catch {}

if (-not $nodeOk) {
    Write-Info "Installing Node.js 22 LTS via winget..."
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
}
Write-Success "Node.js $(node --version)"

# -- Python -------------------------------------------------------------------
Write-Header "Checking Python"
$pythonOk = $false
try {
    $pyVer = (python --version 2>$null) -replace 'Python ', ''
    $pyParts = $pyVer -split '\.'
    if ([int]$pyParts[0] -ge 3 -and [int]$pyParts[1] -ge 11) { $pythonOk = $true }
} catch {}

if (-not $pythonOk) {
    Write-Info "Installing Python 3.11 via winget..."
    winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
}
Write-Success "Python $(python --version)"

# -- git ----------------------------------------------------------------------
Write-Header "Checking git"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Info "Installing git via winget..."
    winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
}
Write-Success "git $(git --version)"

# -- uv -----------------------------------------------------------------------
Write-Header "Checking uv"
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Info "Installing uv..."
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    Refresh-Path
}
Write-Success "uv $(uv --version)"

# -- Claude directory ---------------------------------------------------------
$ClaudeDir = "$env:USERPROFILE\.claude"
$SkillsDir = "$ClaudeDir\skills"
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null

# -- 1. UI/UX Pro Max ---------------------------------------------------------
Write-Header "1/6  UI/UX Pro Max"
Push-Location $env:USERPROFILE
npx --yes uipro-cli@latest init --ai claude --offline
Pop-Location
Write-Success "UI/UX Pro Max -> $ClaudeDir\skills\ui-ux-pro-max\"

# -- 2. Superpowers -----------------------------------------------------------
Write-Header "2/6  Superpowers"
$TmpSP = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
git clone --depth=1 https://github.com/obra/superpowers.git $TmpSP
Copy-Item -Recurse -Force "$TmpSP\skills\*" $SkillsDir
Remove-Item -Recurse -Force $TmpSP
Write-Success "Superpowers (14 skills) -> $SkillsDir"

# -- 3. Everything Claude Code ------------------------------------------------
Write-Header "3/6  Everything Claude Code"
$TmpECC = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
git clone --depth=1 https://github.com/affaan-m/everything-claude-code.git $TmpECC
Push-Location $TmpECC
npm install --no-audit --no-fund --loglevel=error
node scripts/install-apply.js --profile full --target claude
Pop-Location
Remove-Item -Recurse -Force $TmpECC
Write-Success "Everything Claude Code (140 skills, 38 agents, 72 commands)"

# -- 4. claude-mem ------------------------------------------------------------
Write-Header "4/6  claude-mem"
npx --yes claude-mem install
Write-Success "claude-mem installed"

# -- 5. browser-use -----------------------------------------------------------
Write-Header "5/6  browser-use"
New-Item -ItemType Directory -Force -Path "$SkillsDir\browser-use" | Out-Null
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/browser-use/browser-use/main/skills/browser-use/SKILL.md" `
    -OutFile "$SkillsDir\browser-use\SKILL.md"
Write-Success "browser-use skill -> $SkillsDir\browser-use\"
try {
    uv tool install browser-use 2>&1 | Select-Object -Last 3
    Write-Success "browser-use CLI installed"
} catch {
    Write-Warn "browser-use CLI install had issues - run manually: uv tool install browser-use"
}

# -- 6. MCP Servers -----------------------------------------------------------
Write-Header "6/6  MCP Servers"
npx --yes n8n-mcp telemetry disable 2>$null

$McpFile = "$ClaudeDir\.mcp.json"
$McpConfig = @{
    mcpServers = @{
        "n8n-mcp" = @{
            command = "npx"
            args    = @("n8n-mcp")
            env     = @{ MCP_MODE = "stdio"; LOG_LEVEL = "error"; DISABLE_CONSOLE_OUTPUT = "true" }
        }
        "sequential-thinking" = @{
            command = "npx"
            args    = @("-y", "@modelcontextprotocol/server-sequential-thinking")
        }
        "duckduckgo-search" = @{
            command = "npx"
            args    = @("-y", "duck-duck-mcp")
        }
        "context7" = @{
            command = "npx"
            args    = @("-y", "@upstash/context7-mcp")
        }
        "postgres" = @{
            command = "npx"
            args    = @("-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@localhost:5432/mydb")
        }
    }
}

if (Test-Path $McpFile) {
    $existing = Get-Content $McpFile -Raw | ConvertFrom-Json
    if (-not $existing.mcpServers) { $existing | Add-Member -NotePropertyName mcpServers -NotePropertyValue @{} }
    foreach ($key in $McpConfig.mcpServers.Keys) {
        if (-not $existing.mcpServers.$key) {
            $existing.mcpServers | Add-Member -NotePropertyName $key -NotePropertyValue $McpConfig.mcpServers[$key]
        }
    }
    $existing | ConvertTo-Json -Depth 10 | Set-Content $McpFile -Encoding UTF8
} else {
    $McpConfig | ConvertTo-Json -Depth 10 | Set-Content $McpFile -Encoding UTF8
}
Write-Success "MCP servers configured -> $McpFile"

# -- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Windows setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed stack:" -ForegroundColor White
Write-Host "  [OK] UI/UX Pro Max        - design intelligence"
Write-Host "  [OK] Superpowers          - agentic methodology"
Write-Host "  [OK] Everything CC        - 140 skills, 38 agents, 72 commands"
Write-Host "  [OK] claude-mem           - persistent memory"
Write-Host "  [OK] browser-use          - browser automation"
Write-Host "  [OK] n8n-mcp              - n8n workflow MCP"
Write-Host "  [OK] sequential-thinking  - structured reasoning MCP"
Write-Host "  [OK] duckduckgo-search    - web search MCP"
Write-Host "  [OK] context7             - live docs MCP"
Write-Host "  [!!] postgres             - edit $McpFile with your DB connection string"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Install Claude Code CLI if not already: https://claude.ai/code"
Write-Host "  2. Start a new Claude Code session"
Write-Host "  3. Run 'uvx browser-use install' to add Chromium"
Write-Host ""
