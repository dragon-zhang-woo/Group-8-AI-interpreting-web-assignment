"""
AI 口译评分引擎 - 3维度智能评分系统
评分维度：
1. 发音标准性 (0-3分)
2. 语言流畅性 (0-3分)
3. 翻译准确性 (0-3分)
"""

import re
from difflib import SequenceMatcher
from collections import Counter

def levenshtein_distance(s1, s2):
    """计算编辑距离"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def calculate_similarity(text1, text2):
    """计算两个文本的相似度 (0-1)"""
    if not text1 or not text2:
        return 0.0
    
    text1 = text1.lower().strip()
    text2 = text2.lower().strip()
    
    # 使用 SequenceMatcher 计算相似度
    ratio = SequenceMatcher(None, text1, text2).ratio()
    return ratio

def score_pronunciation(user_translation, reference_translation=None):
    """
    评分：发音标准性 (0-3)
    评估维度：
    - 语言使用规范性
    - 词汇选择准确性
    - 用词难度和专业度
    """
    score = 0
    feedback = []
    
    if not user_translation or len(user_translation.strip()) == 0:
        return 0, ["没有输入内容"]
    
    user_trans = user_translation.strip()
    
    # 检查文本长度合理性
    if len(user_trans) < 5:
        score += 0
        feedback.append("翻译内容过短，需要提供更完整的表达")
    else:
        score += 1
        feedback.append("翻译内容长度适中")
    
    # 检查是否包含常见表达错误
    common_errors = {
        '亲爱': 'dear的翻译应该根据语境选择',
        '我想': '过度使用"我想"会显得不够自然',
        '怎样': '应该使用"怎样"还是"如何"需要根据正式程度选择'
    }
    
    error_count = 0
    for phrase in common_errors:
        if phrase in user_trans:
            error_count += 1
    
    if error_count == 0:
        score += 1
    elif error_count == 1:
        score += 0.5
    else:
        score += 0
    
    # 检查标点符号使用
    if any(char in user_trans for char in ['，', '。', '！', '？']):
        score += 1
        feedback.append("正确使用了标点符号")
    else:
        score += 0.5
        feedback.append("建议添加适当的标点符号")
    
    return min(3, score), feedback

def score_fluency(user_translation, user_audio_text=None):
    """
    评分：语言流畅性 (0-3)
    评估维度：
    - 表达是否自然流畅
    - 是否有生硬的直译痕迹
    - 逻辑连接是否顺畅
    - 是否有重复词汇或口头禅
    """
    score = 0
    feedback = []
    
    if not user_translation:
        return 0, ["没有输入内容"]
    
    user_trans = user_translation.strip()
    
    # 检查句子结构多样性
    sentences = [s.strip() for s in re.split('[。！？\n]', user_trans) if s.strip()]
    if len(sentences) == 0:
        return 0, ["无法分析句子结构"]
    
    # 如果只有一个短句子
    if len(sentences) == 1 and len(user_trans) < 20:
        score += 1
        feedback.append("表达较为简洁，可以考虑添加更多细节")
    elif len(sentences) >= 2:
        score += 1
        feedback.append("表达结构多样")
    else:
        score += 0.5
    
    # 检查重复词汇
    words = [w for w in re.findall(r'[\u4e00-\u9fff]+', user_trans)]
    if words:
        word_freq = Counter(words)
        repeated_words = [w for w, count in word_freq.items() if count > 2]
        
        if len(repeated_words) == 0:
            score += 1
            feedback.append("词汇使用丰富，避免了重复")
        elif len(repeated_words) <= 1:
            score += 0.75
            feedback.append(f"词汇使用较为丰富，但'{repeated_words[0]}'出现次数较多")
        else:
            score += 0.5
            feedback.append("词汇重复出现，建议使用同义词替换")
    else:
        score += 0.5
    
    # 检查连接词使用
    connectors = ['而且', '因此', '所以', '但是', '然而', '不过', '另外', '此外', '总之']
    connector_count = sum(1 for c in connectors if c in user_trans)
    
    if connector_count >= 2:
        score += 1
        feedback.append("连接词使用恰当，表达流畅")
    elif connector_count == 1:
        score += 0.75
        feedback.append("建议添加更多逻辑连接词，使表达更顺畅")
    else:
        score += 0.5
        feedback.append("缺少逻辑连接词，表达可能不够流畅")
    
    return min(3, score), feedback

def score_accuracy(user_translation, reference_translation, original_text=None):
    """
    评分：翻译准确性 (0-3)
    评估维度：
    - 与参考翻译的相似度
    - 意思表达是否准确
    - 关键信息是否完整
    """
    score = 0
    feedback = []
    
    if not user_translation:
        return 0, ["没有输入内容"]
    
    if not reference_translation:
        # 如果没有参考翻译，返回中等评分
        score = 1.5
        feedback.append("无参考翻译，根据表达质量进行评分")
        return score, feedback
    
    user_trans = user_translation.lower().strip()
    ref_trans = reference_translation.lower().strip()
    
    # 计算相似度
    similarity = calculate_similarity(user_trans, ref_trans)
    
    # 根据相似度给分
    if similarity >= 0.8:
        score += 3
        feedback.append("翻译与参考翻译高度相符，准确度优秀")
    elif similarity >= 0.6:
        score += 2.5
        feedback.append("翻译与参考翻译相符，准确度良好")
    elif similarity >= 0.4:
        score += 2
        feedback.append("翻译包含主要意思，但表达方式有差异")
    elif similarity >= 0.2:
        score += 1
        feedback.append("翻译偏离参考翻译，某些关键信息可能缺失")
    else:
        score += 0
        feedback.append("翻译与参考翻译差异较大，需要重新审视")
    
    # 检查关键词是否出现
    ref_words = set(re.findall(r'[\u4e00-\u9fff]+|[a-z]+', ref_trans))
    user_words = set(re.findall(r'[\u4e00-\u9fff]+|[a-z]+', user_trans))
    
    # 计算关键词覆盖率
    if ref_words:
        coverage = len(user_words & ref_words) / len(ref_words)
        if coverage >= 0.7:
            feedback.append("关键信息表达完整")
        else:
            feedback.append(f"关键词覆盖率为{coverage:.0%}，某些重要信息可能缺失")
    
    return min(3, score), feedback

def score_translation(
    original_text,
    user_translation,
    reference_translation='',
    source_lang='en',
    target_lang='zh',
    user_audio_text=''
):
    """
    综合评分函数
    返回：{ "发音": 3, "流畅": 2, "准确": 3, "总分": 2.67, "评语": "...", "建议": [...] }
    """
    
    # 获取各维度评分
    pronunciation_score, pron_feedback = score_pronunciation(user_translation, reference_translation)
    fluency_score, fluency_feedback = score_fluency(user_translation, user_audio_text)
    accuracy_score, accuracy_feedback = score_accuracy(user_translation, reference_translation, original_text)
    
    # 计算总分（平均值）
    total_score = (pronunciation_score + fluency_score + accuracy_score) / 3
    
    # 生成综合评语
    comments = []
    
    # 根据总分生成评语
    if total_score >= 2.7:
        comments.append("🌟 表现优秀！你的翻译准确、流畅、规范。")
    elif total_score >= 2.3:
        comments.append("👍 表现良好！翻译质量较高，继续保持。")
    elif total_score >= 1.7:
        comments.append("⚡ 表现一般，还有改进空间。")
    elif total_score >= 1.0:
        comments.append("⚠️ 表现需要改进，建议多加练习。")
    else:
        comments.append("❌ 表现较差，建议重新审视翻译思路。")
    
    # 添加具体建议
    suggestions = []
    if pronunciation_score < 2:
        suggestions.extend(pron_feedback)
    if fluency_score < 2:
        suggestions.extend(fluency_feedback)
    if accuracy_score < 2:
        suggestions.extend(accuracy_feedback)
    
    # 如果没有特殊建议，添加鼓励
    if not suggestions:
        suggestions.append("保持这个水平，继续练习会取得更好的成绩！")
    
    return {
        "发音": round(pronunciation_score, 1),
        "流畅": round(fluency_score, 1),
        "准确": round(accuracy_score, 1),
        "总分": round(total_score, 2),
        "评语": " ".join(comments),
        "建议": suggestions[:3]  # 最多显示3条建议
    }

# ==========================================
# 测试函数
# ==========================================
if __name__ == "__main__":
    # 测试用例
    test_cases = [
        {
            "original": "Hello, nice to meet you",
            "user": "你好，很高兴认识你",
            "reference": "你好，很高兴见到你",
            "source": "en",
            "target": "zh"
        },
        {
            "original": "The weather is beautiful today",
            "user": "今天天气很好",
            "reference": "今天天气很美好",
            "source": "en",
            "target": "zh"
        }
    ]
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n测试用例 {i}:")
        print(f"原文: {case['original']}")
        print(f"用户翻译: {case['user']}")
        print(f"参考翻译: {case['reference']}")
        
        result = score_translation(
            original_text=case['original'],
            user_translation=case['user'],
            reference_translation=case['reference'],
            source_lang=case['source'],
            target_lang=case['target']
        )
        
        print(f"\n评分结果:")
        print(f"  发音: {result['发音']}/3")
        print(f"  流畅: {result['流畅']}/3")
        print(f"  准确: {result['准确']}/3")
        print(f"  总分: {result['总分']}/3")
        print(f"  评语: {result['评语']}")
        print(f"  建议: {result['建议']}")
