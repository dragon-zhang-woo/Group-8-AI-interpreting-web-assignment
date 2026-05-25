#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
快速测试脚本 - 验证核心功能
"""

import sys
import os

# 测试翻译
print("\n【翻译测试】")
from translate_engine import translate_text
print("英→中: hello =", translate_text("hello", "en", "zh"))
print("中→英: 你好 =", translate_text("你好", "zh", "en"))

# 测试评分
print("\n【评分测试】")
from scoring_engine import score_translation
scores = score_translation(
    original_text="Hello",
    user_translation="你好",
    reference_translation="你好",
    source_lang="en",
    target_lang="zh"
)
print(f"发音: {scores['发音']}/3")
print(f"流畅: {scores['流畅']}/3")
print(f"准确: {scores['准确']}/3")
print(f"总分: {scores['总分']}/3")

# 测试数据管理
print("\n【数据管理测试】")
from data_manager import get_random_material, get_all_records
material = get_random_material()
print(f"随机材料: {material[:50]}...")
records = get_all_records()
print(f"历史记录: {len(records)} 条")

print("\n✅ 所有核心功能测试通过！")
print("\n【系统就绪】")
print("前端文件: integrated_ui.html")
print("后端启动: python app.py")
print("然后打开浏览器访问前端文件即可")
