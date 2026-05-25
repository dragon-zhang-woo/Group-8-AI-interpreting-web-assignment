#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
快速启动指南 - 一键启动 AI 口译练习网站
"""

import os
import webbrowser
import subprocess
import sys
import time

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("""
╔══════════════════════════════════════════════╗
║  AI 口译练习网站 - 快速启动                 ║
║  AI Interpretation Practice System           ║
╚══════════════════════════════════════════════╝

【系统检查】
    """)
    
    # 检查Python版本
    if sys.version_info < (3, 8):
        print("❌ Python 版本过低，需要 3.8+")
        return
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}")
    
    # 检查文件
    files_needed = [
        'integrated_ui.html',
        'app.py',
        'translate_engine.py',
        'scoring_engine_impl.py',
        'audio_engine.py',
        'data_manager.py'
    ]
    
    for file in files_needed:
        if os.path.exists(file):
            print(f"✅ {file}")
        else:
            print(f"❌ {file} (缺失)")
            return
    
    # 检查依赖
    try:
        import flask
        import requests
        import edge_tts
        print("✅ Python 依赖已安装")
    except ImportError:
        print("❌ 依赖缺失，运行: pip install -r requirements.txt")
        return
    
    print("""
【使用说明】

1️⃣  启动后端服务
    运行命令: python app.py
    
2️⃣  打开前端界面
    在浏览器中打开: integrated_ui.html
    或访问: file://<path>/integrated_ui.html
    
3️⃣  开始使用
    - 📖 AI 翻译机：输入文本或语音，自动翻译
    - 💪 实战演练：选择材料，录制翻译，获得评分
    - 📊 学习记录：查看练习历史和成绩

【快速命令】

启动后端:
    python app.py

运行测试:
    python run_tests.py
    python quick_test.py

【功能特性】

✨ AI 翻译
  - 支持英文 ↔ 中文双向翻译
  - 支持文本输入和语音录制
  - 自动生成翻译的语音

📊 智能评分
  - 发音标准性 (0-3分)
  - 语言流畅性 (0-3分)
  - 翻译准确性 (0-3分)
  - 自动生成改进建议

📚 学习记录
  - 保存所有练习数据
  - 查看练习统计
  - 追踪学习进度

🔧 技术特点
  - 完全离线支持
  - 跨浏览器兼容
  - 响应式设计
  - 无需额外配置

【系统要求】

✅ Python 3.8+
✅ 现代浏览器 (Chrome/Firefox/Safari/Edge)
✅ 网络连接 (可选，支持完全离线工作)
✅ 麦克风 (语音功能需要)

【遇到问题？】

1. 翻译不工作
   → 确保后端服务已启动
   → 检查浏览器控制台错误
   
2. 语音识别不工作
   → 允许浏览器麦克风权限
   → 检查麦克风设备
   → 配置 DASHSCOPE_API_KEY
   
3. 评分异常
   → 确保提供参考翻译
   → 检查翻译质量
   
4. 找不到文件
   → 确保在正确的目录
   → 检查文件是否完整

【下一步】

现在您已经准备好使用该系统了！

📝 建议步骤：
  1. 打开一个终端窗口
  2. 运行: python app.py
  3. 在浏览器打开: integrated_ui.html
  4. 开始练习口译！

祝您学习愉快！ 🎉
    """)

if __name__ == "__main__":
    main()
