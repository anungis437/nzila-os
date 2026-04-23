#Requires -Version 5.1
<#
.SYNOPSIS
    Export the Union Eyes buyer deck to PPTX (and optionally PDF).

.DESCRIPTION
    Parses docs/commercial/close-package/UNION_EYES_BUYER_DECK.md and
    produces a branded PPTX via python-pptx. Optionally converts to PDF
    using LibreOffice (soffice) or Microsoft Office COM automation if available.

.PARAMETER Out
    Output PPTX path. Defaults to demo-output/union-eyes-buyer-deck.pptx.

.PARAMETER Pdf
    Also export a PDF alongside the PPTX.

.PARAMETER Deck
    Path to source Markdown deck. Defaults to the repo standard location.

.EXAMPLE
    .\scripts\Export-BuyerDeck.ps1
    .\scripts\Export-BuyerDeck.ps1 -Pdf
    .\scripts\Export-BuyerDeck.ps1 -Out "C:\Presentations\union-eyes-q2-2026.pptx" -Pdf
#>
[CmdletBinding()]
param(
    [string]$Out  = "demo-output/union-eyes-buyer-deck.pptx",
    [string]$Deck = "docs/commercial/close-package/UNION_EYES_BUYER_DECK.md",
    [switch]$Pdf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $RepoRoot

try {
    # ── 1. Resolve Python ────────────────────────────────────────────────────
    $VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
    if (Test-Path $VenvPython) {
        $Python = $VenvPython
        Write-Host "Using venv Python: $Python" -ForegroundColor Cyan
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $Python = "python"
        Write-Host "Using system Python: $(python --version 2>&1)" -ForegroundColor Cyan
    } else {
        Write-Error "Python not found. Install Python 3.9+ or activate the repo venv."
        exit 1
    }

    # ── 2. Ensure python-pptx ───────────────────────────────────────────────
    $PptxCheck = & $Python -c "import pptx; print(pptx.__version__)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "python-pptx not found — installing..." -ForegroundColor Yellow
        & $Python -m pip install python-pptx --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install python-pptx. Run: pip install python-pptx"
            exit 1
        }
        Write-Host "python-pptx installed." -ForegroundColor Green
    } else {
        Write-Host "python-pptx $($PptxCheck.Trim()) already installed." -ForegroundColor Green
    }

    # ── 3. Build PPTX ───────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "Building PPTX..." -ForegroundColor Cyan
    & $Python "scripts/export_buyer_deck.py" --deck $Deck --out $Out
    if ($LASTEXITCODE -ne 0) {
        Write-Error "PPTX export failed."
        exit 1
    }

    $PptxPath = Resolve-Path $Out

    # ── 4. Optional PDF export ───────────────────────────────────────────────
    if ($Pdf) {
        $PdfPath = [System.IO.Path]::ChangeExtension($PptxPath, ".pdf")
        $Exported = $false

        # Option A: LibreOffice (soffice)
        $Soffice = Get-Command soffice -ErrorAction SilentlyContinue
        if (-not $Soffice) {
            # Common install locations on Windows
            $SofficePaths = @(
                "C:\Program Files\LibreOffice\program\soffice.exe",
                "C:\Program Files (x86)\LibreOffice\program\soffice.exe"
            )
            foreach ($p in $SofficePaths) {
                if (Test-Path $p) { $Soffice = $p; break }
            }
        }

        if ($Soffice) {
            Write-Host "Exporting PDF via LibreOffice..." -ForegroundColor Cyan
            $OutDir = Split-Path $PptxPath -Parent
            & $Soffice --headless --convert-to pdf --outdir $OutDir $PptxPath 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓  PDF → $PdfPath" -ForegroundColor Green
                $Exported = $true
            }
        }

        # Option B: Microsoft Office COM (Windows only, Office must be installed)
        if (-not $Exported) {
            try {
                Write-Host "Trying Microsoft Office COM automation..." -ForegroundColor Cyan
                $ppt = New-Object -ComObject PowerPoint.Application
                $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
                $pres = $ppt.Presentations.Open($PptxPath.Path, $true, $false, $false)
                $pres.SaveAs($PdfPath, 32)  # 32 = ppSaveAsPDF
                $pres.Close()
                $ppt.Quit()
                [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
                Write-Host "✓  PDF → $PdfPath" -ForegroundColor Green
                $Exported = $true
            } catch {
                Write-Host "Office COM not available: $_" -ForegroundColor Yellow
            }
        }

        if (-not $Exported) {
            Write-Warning @"
PDF export requires LibreOffice or Microsoft Office.

Options:
  A) Install LibreOffice (free):  winget install TheDocumentFoundation.LibreOffice
     Then re-run: .\scripts\Export-BuyerDeck.ps1 -Pdf

  B) Open $PptxPath in PowerPoint → File → Export → PDF

  C) Upload to Google Slides → File → Download → PDF
"@
        }
    }

    # ── 5. Summary ─────────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host " Done." -ForegroundColor Green
    Write-Host " PPTX: $PptxPath" -ForegroundColor White
    if ($Pdf -and (Test-Path ([System.IO.Path]::ChangeExtension($PptxPath, ".pdf")))) {
        Write-Host " PDF:  $([System.IO.Path]::ChangeExtension($PptxPath, '.pdf'))" -ForegroundColor White
    }
    Write-Host ""
    Write-Host " To open: start `"$PptxPath`"" -ForegroundColor DarkGray
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor DarkGray

} finally {
    Pop-Location
}
