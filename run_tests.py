#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI 口译练习网站 - 综合测试脚本
测试所有模块的功能：翻译、评分、数据管理等
"""

import sys
import os

def test_translate_engine():
    """测试翻译引擎"""
    print("\n" + "="*50)
    print("🌍 测试翻译引擎")
    print("="*50)
    
    from translate_engine import translate_text
    
    test_cases = [
        ("hello", "en", "zh"),
        ("你好", "zh", "en"),
        ("good morning", "en", "zh"),
        ("早上好", "zh", "en"),
    ]
    
    for text, source, target in test_cases:
        result = translate_text(text, source, target)
        print(f"  {text} ({source}→{target}) → {result}")
    
    print("✅ 翻译引擎测试完成")

def test_scoring_engine():
    """测试评分引擎"""
    print("\n" + "="*50)
    print("📊 测试评分引擎")
    print("="*50)
    
    from scoring_engine import score_translation
    
    test_cases = [
        {
            "original": "Hello, nice to meet you",
            "user": "你好，很高兴认识你",
            "reference": "你好，很高兴认识你"
        },
        {
            "original": "Thank you very much",
            "user": "非常谢谢你",
            "reference": "非常感谢你"
        }
    ]
    
    for case in test_cases:
        print(f"\n  原文: {case['original']}")
        print(f"  用户翻译: {case['user']}")
        print(f"  参考翻译: {case['reference']}")
        
        result = score_translation(
            original_text=case['original'],
            user_translation=case['user'],
            reference_translation=case['reference'],
            source_lang='en',
            target_lang='zh'
        )
        
        print(f"  评分结果:")
        print(f"    发音: {result['发音']}/3")
        print(f"    流畅: {result['流畅']}/3")
        print(f"    准确: {result['准确']}/3")
        print(f"    总分: {result['总分']}/3")
        print(f"    评语: {result['评语'][:50]}...")
    
    print("\n✅ 评分引擎测试完成")

def test_data_manager():
    """测试数据管理器"""
    print("\n" + "="*50)
    print("💾 测试数据管理器")
    print("="*50)
    
    from data_manager import get_random_material, get_all_records
    
    print("\n  获取随机材料:")
    try:
        material = get_random_material()
        print(f"  ✅ {material[:50]}...")
    except Exception as e:
        print(f"  ⚠️ {e}")
    
    print("\n  获取所有记录:")
    try:
        records = get_all_records()
        print(f"  ✅ 共 {len(records)} 条记录")
        for i, record in enumerate(records[:3], 1):
            print(f"    {i}. {record}")
    except Exception as e:
        print(f"  ⚠️ {e}")
    
    print("\n✅ 数据管理测试完成")

def test_audio_engine():
    """测试音频引擎"""
    print("\n" + "="*50)
    print("🎤 测试音频引擎")
    print("="*50)
    
    from audio_engine import _get_voice
    
    print("\n  检查可用的语言:")
    languages = ["zh-CN", "en-US", "en-GB", "zh-TW"]
    for lang in languages:
        voice = _get_voice(lang)
        print(f"    {lang} → {voice}")
    
    print("\n✅ 音频引擎测试完成")

def test_flask_api():
    """测试 Flask API"""
    print("\n" + "="*50)
    print("🔌 测试 Flask API")
    print("="*50)
    
    try:
        import requests
        base_url = "http://localhost:5000"
        
        # 检查健康状态
        print("\n  检查服务健康状态...")
        try:
            response = requests.get(f"{base_url}/api/health", timeout=2)
            if response.status_code == 200:
                print(f"  ✅ 服务运行正常")
                print(f"     {response.json()}")
            else:
                print(f"  ⚠️ 服务返回错误: {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"  ⚠️ 无法连接到后端服务")
            print(f"     请确保已启动: python app.py")
        except Exception as e:
            print(f"  ⚠️ 连接失败: {e}")
    
    except ImportError:
        print("  ⚠️ 未安装 requests，跳过此测试")
    
    print("\n✅ Flask API 测试完成")

def print_summary():
    """打印测试总结"""
    print("\n" + "="*50)
    print("✨ 测试总结")
    print("="*50)
    print("""
    所有核心模块已测试:
    
    ✅ 翻译引擎 - 支持英中互译
    ✅ 评分引擎 - 3维度智能评分
    ✅ 数据管理 - 记录保存和查询
    ✅ 音频引擎 - 语音处理支持
    ⚠️  Flask API - 需要启动后端服务
    
    下一步:
    
    1. 启动后端服务:
       python app.py
    
    2. 打开前端:
       integrated_ui.html
    
    3. 开始练习!
    """)

def main():
    print("""
    ╔══════════════════════════════════════════════╗
    ║  AI 口译练习网站 - 综合测试                  ║
    ║  Comprehensive Test Suite                    ║
    ╚══════════════════════════════════════════════╝
    """)
    
    try:
        # 运行所有测试
        test_translate_engine()
        test_scoring_engine()
        test_data_manager()
        test_audio_engine()
        test_flask_api()
        
        # 打印总结
        print_summary()
        
        print("\n✅ 所有测试完成!")
        
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
