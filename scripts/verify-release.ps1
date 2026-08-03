$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExtensionRoot = Join-Path $RepoRoot "extension"

Push-Location $ExtensionRoot
try {
    npm.cmd test -- --run
    if ($LASTEXITCODE -ne 0) { throw "Extension tests failed" }

    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Extension build failed" }

    $Manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath "manifest.json" | ConvertFrom-Json
    if ($Manifest.permissions -notcontains "clipboardWrite") {
        throw "Required extension permission missing: clipboardWrite"
    }
    if (@($Manifest.host_permissions) -contains "http://127.0.0.1:8765/*") {
        throw "Local helper host permission must not be present"
    }
    foreach ($Permission in @("cookies", "webRequest", "webRequestBlocking")) {
        if ($Manifest.permissions -contains $Permission) {
            throw "Forbidden extension permission: $Permission"
        }
    }
}
finally {
    Pop-Location
}

Push-Location $RepoRoot
try {
    $Tracked = git ls-files
    $ForbiddenFiles = $Tracked | Where-Object {
        $_ -match "(^|/)(data|runtime|logs|exports)/" -or
        $_ -match "\.(sqlite3?|db|csv|tsv|xlsx?|log)$"
    }
    if ($ForbiddenFiles) {
        throw "Tracked runtime or candidate files detected: $($ForbiddenFiles -join ', ')"
    }
}
finally {
    Pop-Location
}

Write-Host "Clipboard extension release verification passed."
