# 系统环境检查脚本
# 运行此脚本检查是否满足所有要求

Write-Host "`n=== 🔍 AI口译网站 - 系统环境检查 ===" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 检查 Python
Write-Host "1️⃣  检查 Python 版本..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "3\.([8-9]|\d{2})") {
        Write-Host "   ✅ $pythonVersion" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $pythonVersion (需要 3.8+)" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   ❌ Python 未安装或不在PATH中" -ForegroundColor Red
    $allGood = $false
}

# 检查 pip
Write-Host "`n2️⃣  检查 pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "   ✅ $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ pip 未找到" -ForegroundColor Red
    $allGood = $false
}

# 检查虚拟环境
Write-Host "`n3️⃣  检查虚拟环境..." -ForegroundColor Yellow
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    Write-Host "   ✅ 虚拟环境存在" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  虚拟环境不存在（将在启动时创建）" -ForegroundColor Yellow
}

# 检查依赖文件
Write-Host "`n4️⃣  检查依赖文件..." -ForegroundColor Yellow
if (Test-Path ".\requirements.txt") {
    $content = Get-Content ".\requirements.txt"
    Write-Host "   ✅ requirements.txt 存在" -ForegroundColor Green
    Write-Host "   📦 依赖列表:" -ForegroundColor Cyan
    $content | ForEach-Object { Write-Host "      - $_" }
} else {
    Write-Host "   ❌ requirements.txt 未找到" -ForegroundColor Red
    $allGood = $false
}

# 检查关键文件
Write-Host "`n5️⃣  检查关键文件..." -ForegroundColor Yellow
$files = @("app.py", "integrated_ui.html", "audio_engine.py", "translate_engine.py", "scoring_engine_impl.py")
foreach ($file in $files) {
    if (Test-Path ".\$file") {
        $size = (Get-Item ".\$file").Length / 1KB
        Write-Host "   ✅ $file (${size:F1} KB)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file 未找到" -ForegroundColor Red
        $allGood = $false
    }
}

# 检查记录文件
Write-Host "`n6️⃣  检查数据文件..." -ForegroundColor Yellow
if (Test-Path ".\records.csv") {
    $records = @(Get-Content ".\records.csv" | Measure-Object -Line).Lines
    Write-Host "   ✅ records.csv 存在 ($records 行记录)" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  records.csv 不存在（首次使用将创建）" -ForegroundColor Cyan
}

# 检查浏览器
Write-Host "`n7️⃣  检查浏览器..." -ForegroundColor Yellow
$browsers = @("chrome.exe", "firefox.exe", "msedge.exe")
$browserFound = $false
foreach ($browser in $browsers) {
    if (Get-Command $browser -ErrorAction SilentlyContinue) {
        Write-Host "   ✅ 找到浏览器: $browser" -ForegroundColor Green
        $browserFound = $true
        break
    }
}
if (-not $browserFound) {
    Write-Host "   ⚠️  未找到常用浏览器（请确保已安装Chrome/Firefox/Edge）" -ForegroundColor Yellow
}

# 最终总结
Write-Host "`n" -ForegroundColor White
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ 环境检查通过！系统已准备就绪" -ForegroundColor Green
    Write-Host "`n下一步：运行 .\START.ps1 启动服务器" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  环境检查有问题，请解决上述错误后重试" -ForegroundColor Yellow
}
Write-Host "═══════════════════════════════════════════`n" -ForegroundColor Cyan
