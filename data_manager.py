import json
import csv
import random
import os
from datetime import datetime

# 定义文件路径
MATERIALS_FILE = "materials.json"
RECORDS_FILE = "records.csv"

# ==========================================
# 功能 1：随机抽取训练素材 (供实战演练 Tab 使用)
# ==========================================
def get_random_material():
    """读取 json 文件，随机返回一条英文素材"""
    try:
        with open(MATERIALS_FILE, "r", encoding="utf-8") as f:
            materials = json.load(f)
            # 随机挑选一个
            item = random.choice(materials)
            return item["english"]
    except FileNotFoundError:
        return "Error: 未找到素材库文件 materials.json"

# ==========================================
# 功能 2：保存用户的练习记录 (供 AI 裁判打分后调用)
# ==========================================
def save_record(original_text, user_translation, scores_dict):
    """
    将用户的练习结果追加保存到 CSV 文件中。
    scores_dict 的预期格式: {"发音": 3, "流畅": 2, "准确": 3, "评语": "不错..."}
    """
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 按照表头顺序组装数据
    row = [
        current_time,
        original_text,
        user_translation,
        scores_dict.get("发音", 0),
        scores_dict.get("流畅", 0),
        scores_dict.get("准确", 0),
        scores_dict.get("评语", "无")
    ]
    
    # a 模式代表 append (追加写入)
    with open(RECORDS_FILE, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(row)
    
    return "记录保存成功！"

# ==========================================
# 功能 3：读取所有历史记录 (供 学习记录 Tab 展示)
# ==========================================
def get_all_records():
    """读取 CSV 返回一个二维列表，Gradio 会直接把它渲染成漂亮的表格"""
    records = []
    try:
        with open(RECORDS_FILE, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                records.append(row)
        return records
    except FileNotFoundError:
        return [["暂无记录", "", "", "", "", "", ""]]
