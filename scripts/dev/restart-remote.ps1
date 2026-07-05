# 通过 SSH 触发远端托管机预览服务重启：只在发起同步的一端用（通常是 Windows）。
# 远端 preview.sh 本身已经封装了 fetch + checkout --detach + 重启的全部逻辑，
# 这里只是把"从这一端喊它跑一次"这一步补上，不重复实现远端逻辑。
# 配置读取顺序：命令行参数 > scripts/dev/dev-workflow.env（跑 scripts/init.mjs 时自动生成）。
param(
    [string]$Branch,
    [string]$PreviewHost,
    [string]$RemoteRepoPath
)
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "dev-workflow.env"
$envValues = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $envValues[$matches[1]] = $matches[2]
        }
    }
}

if (-not $PreviewHost) { $PreviewHost = $envValues["PREVIEW_HOST"] }
if (-not $RemoteRepoPath) { $RemoteRepoPath = $envValues["REMOTE_REPO_PATH"] }

if (-not $PreviewHost -or -not $RemoteRepoPath) {
    Write-Error "缺少 PreviewHost/RemoteRepoPath：复制 scripts/dev/dev-workflow.env.example 为 dev-workflow.env 并填写，或用 -PreviewHost/-RemoteRepoPath 参数传入，或跑一次 scripts/init.mjs"
    exit 1
}

if (-not $Branch) {
    $Branch = (git symbolic-ref --quiet --short HEAD)
    if ($LASTEXITCODE -ne 0 -or -not $Branch) {
        Write-Error "未指定 -Branch 且当前处于分离头指针状态，无法推断分支"
        exit 1
    }
}

Write-Host "== [restart-remote] 通过 SSH 在 $PreviewHost 上重启预览（分支 $Branch）=="
ssh $PreviewHost "cd '$RemoteRepoPath' && ./scripts/dev/preview.sh restart '$Branch'"
if ($LASTEXITCODE -ne 0) {
    Write-Error "远端 preview.sh restart 失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "== [restart-remote] 完成 =="
