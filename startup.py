#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI 口译练习网站 - 快速启动脚本
"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def main():
    print("""
    ╔══════════════════════════════════════════════╗
    ║  🎤 AI 口译练习网站 - 快速启动               ║
    ║  AI Interpretation Practice System           ║
    ╚══════════════════════════════════════════════╝
    """)
    
    # 检查依赖
    print("📋 检查依赖...")
    try:
        import flask
        import requests
        import edge_tts
        print("✅ 所有依赖已安装")
    except ImportError as e:
        print(f"❌ 缺少依赖: {e}")
        print("💡 运行: pip install -r requirements.txt")
        return
    
    # 检查前端文件
    print("\n📁 检查前端文件...")
    frontend_file = Path('integrated_ui.html')
    if frontend_file.exists():
        print(f"✅ 找到前端文件: {frontend_file}")
    else:
        print(f"⚠️ 前端文件不存在: {frontend_file}")
    
    # 启动 Flask 后端
    print("\n🚀 启动后端服务...")
    try:
        # 检查是否已在运行
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', 5000))
        sock.close()
        
        if result == 0:
            print("⚠️ 端口 5000 已被占用")
            choice = input("是否继续? (y/n): ")
            if choice.lower() != 'y':
                return
        else:
            print("💡 运行: python app.py")
            print("   或者在另一个终端启动后端")
    except Exception as e:
        print(f"⚠️ 检查端口失败: {e}")
    
    # 打开浏览器
    print("\n🌐 打开浏览器...")
    frontend_url = f"file://{Path('integrated_ui.html').absolute()}"
    print(f"📍 前端地址: {frontend_url}")
    print(f"🔗 后端地址: http://localhost:5000")
    
    try:
        webbrowser.open(frontend_url)
        print("✅ 浏览器已打开")
    except Exception as e:
        print(f"⚠️ 无法自动打开浏览器: {e}")
        print(f"   请手动打开: {frontend_url}")
    
    print("\n" + "="*50)
    print("✨ 系统启动完成!")
    print("="*50)
    print("""
    功能说明:
    
    1. 📖 AI 翻译机
       - 支持英文/中文输入
       - 自动翻译和音频输出
       - 支持语音识别
    
    2. 💪 实战演练
       - 选择练习材料
       - 用户录制翻译
       - 3维度自动评分
    
    3. 📊 学习记录
       - 查看历史记录
       - 统计学习成果
       - 追踪进度
    
    💡 提示:
       - 所有功能支持离线使用
       - 建议使用 Chrome/Edge 浏览器
       - 首次使用需要允许麦克风访问权限
    
    🆘 问题排查:
       - 翻译不工作? 检查后端服务是否启动
       - 语音识别不工作? 检查麦克风权限
       - API错误? 检查 .env 配置文件
    """)
    
    print("\n按 Ctrl+C 停止服务")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n👋 服务已停止")

if __name__ == "__main__":
    main()
