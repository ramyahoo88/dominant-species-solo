# GPU training job runner for the player-bot work. Separate from tools\job-runner.ps1 (which it doesn't touch),
# so training on the graphics card can run while the shared queue keeps simulating.
# Start it from the repo folder, in its own PowerShell window, and leave it running:
#   powershell -ExecutionPolicy Bypass -File source\benchmark\nn\gpu-runner.ps1
#
# Jobs: jobs\gpu\pb_<name>.job (the main runner only reads jobs\*.job, so it never sees these). One line:
#   train <args...>      runs: <python> source/benchmark/nn/train.py <args...>
# Every argument must be letters, digits, or . , _ = : / -   Output goes to results\<name>.json, .err and .status.
# On start it looks for a conda Python whose PyTorch can use the GPU and records what it found in results\pb_gpu_env.txt.

$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $repo
$jobs = Join-Path $repo 'jobs\gpu'; $results = Join-Path $repo 'results'; $doneDir = Join-Path $jobs 'done'
New-Item -ItemType Directory -Force $jobs, $results, $doneDir | Out-Null
$safe = '^[A-Za-z0-9_.,=:/-]+$'

function Write-Status($name, $text) {
  Set-Content -Encoding utf8 (Join-Path $results "$name.status") "$text  $(Get-Date -Format s)"
}

# Find a Python with PyTorch that sees the GPU (base installs and every conda environment).
$roots = @("$env:USERPROFILE\miniconda3", "$env:USERPROFILE\.conda", "$env:USERPROFILE\anaconda3", 'C:\ProgramData\miniconda3', 'C:\ProgramData\anaconda3')
$candidates = foreach ($r in $roots) {
  Join-Path $r 'python.exe'
  Get-ChildItem (Join-Path $r 'envs') -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'python.exe' }
}
$probe = "import torch; ok = torch.cuda.is_available(); print('torch', torch.__version__, 'cuda', torch.version.cuda, 'gpu', ok, torch.cuda.get_device_name(0) if ok else '')"
$found = @(); $python = $null
foreach ($py in $candidates) {
  if (-not (Test-Path $py)) { continue }
  $out = "$(& $py -c $probe 2>&1 | Select-Object -Last 1)"
  $found += "$py -> $out"
  if (-not $python -and $out -match 'gpu True') { $python = $py }
}
$summary = @("checked $(Get-Date -Format s)") + $found + @("using: $(if ($python) { $python } else { 'none (no Python with PyTorch that sees the GPU)' })")
Set-Content -Encoding utf8 (Join-Path $results 'pb_gpu_env.txt') $summary
$summary | ForEach-Object { Write-Host $_ }

Write-Host "GPU runner watching $jobs (Ctrl+C to stop)"
while ($true) {
  Set-Content -Encoding utf8 (Join-Path $results 'pb_gpu_runner.heartbeat') (Get-Date -Format s)
  $next = Get-ChildItem $jobs -Filter 'pb_*.job' -File | Sort-Object Name | Select-Object -First 1
  if (-not $next) { Start-Sleep -Seconds 10; continue }
  $name = $next.BaseName
  $words = @(((Get-Content -Raw $next.FullName) -split '\s+') | Where-Object { $_ })
  Move-Item -Force $next.FullName (Join-Path $doneDir $next.Name)
  $bad = $words | Where-Object { $_ -notmatch $safe }
  if (-not $words.Count -or $bad -or $words[0] -ne 'train') { Write-Status $name 'rejected: not a safe train job'; continue }
  if (-not $python) { Write-Status $name 'rejected: no Python with PyTorch that sees the GPU (see pb_gpu_env.txt)'; continue }
  $out = Join-Path $results "$name.json"; $err = Join-Path $results "$name.err"
  $args2 = @('source/benchmark/nn/train.py')
  if ($words.Count -gt 1) { $args2 += $words[1..($words.Count - 1)] }
  Write-Host "$(Get-Date -Format T) running $name"
  Write-Status $name 'running'
  & $python @args2 2> $err | Out-File -Encoding utf8 $out
  Write-Status $name "done exit $LASTEXITCODE"
  Write-Host "$(Get-Date -Format T) finished $name (exit $LASTEXITCODE)"
}
