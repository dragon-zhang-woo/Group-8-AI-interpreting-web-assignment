# ===================================
# AI口译网站 - 一键启动脚本
# ===================================

Write-Host "`n🚀 启动 AI口译训练网站..." -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# 第1步: 激活虚拟环境
Write-Host "📦 步骤1: 激活虚拟环境..." -ForegroundColor Yellow
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & .\venv\Scripts\Activate.ps1
    Write-Host "✅ 虚拟环境已激活`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  虚拟环境不存在，正在创建..." -ForegroundColor Yellow
    python -m venv venv
    & .\venv\Scripts\Activate.ps1
    Write-Host "✅ 虚拟环境已创建并激活`n" -ForegroundColor Green
}

# 第2步: 检查依赖
Write-Host "📦 步骤2: 检查并安装依赖..." -ForegroundColor Yellow
pip install -r requirements.txt -q
Write-Host "✅ 所有依赖已就绪`n" -ForegroundColor Green

# 第3步: 启动后端
Write-Host "🌐 步骤3: 启动后端服务器..." -ForegroundColor Yellow
Write-Host "────────────────────────────────" -ForegroundColor Cyan
Write-Host "后端将在 http://127.0.0.1:5000 运行" -ForegroundColor Cyan
Write-Host "────────────────────────────────`n" -ForegroundColor Cyan

Write-Host "⏳ 按 Ctrl+C 可以停止服务器`n" -ForegroundColor Magenta

# 第4步: 打开前端
Start-Sleep -Seconds 2
Write-Host "🌐 步骤4: 在浏览器中打开前端..." -ForegroundColor Yellow

$htmlPath = (Get-Item ".\integrated_ui.html").FullName
$htmlUrl = "file:///$($htmlPath -replace '\\', '/')"

Write-Host "✅ 正在打开浏览器...`n" -ForegroundColor Green
Start-Process $htmlUrl

Write-Host "================================================`n" -ForegroundColor Cyan
Write-Host "✨ 网站已就绪！" -ForegroundColor Green
Write-Host "📝 完整指南请查看: ONLINE_TESTING_GUIDE.md" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# 启动Flask
python app.py
