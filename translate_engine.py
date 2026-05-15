
"""
翻译引擎 - 支持中英互译
使用离线翻译库或在线API
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

# 简单的离线翻译字典 (生产环境应使用更完整的方案)
TRANSLATION_DICT = {
    # 英文 -> 中文
    'hello': '你好',
    'good morning': '早上好',
    'thank you': '谢谢你',
    'nice to meet you': '很高兴认识你',
    'how are you': '你好吗',
    'im fine': '我很好',
    'welcome': '欢迎',
    'see you': '再见',
    'good bye': '再见',
    'please': '请',
    'yes': '是的',
    'no': '不是',
    'i am': '我是',
    'you are': '你是',
    'what is your name': '你叫什么名字',
    'my name is': '我叫',
    'where are you from': '你来自哪里',
    'i am from': '我来自',
    'nice weather': '天气很好',
    'beautiful': '漂亮的',
    'good': '好的',
    'bad': '坏的',
    'thank you very much': '非常感谢你',
    'you are welcome': '不客气',
    'excuse me': '请问',
    'sorry': '对不起',
    'no problem': '没问题',
    'can you help me': '你能帮我吗',
    'sure': '当然可以',
}

# 反向字典 (中文 -> 英文)
REVERSE_DICT = {v: k for k, v in TRANSLATION_DICT.items()}

def get_language(text):
    """检测文本语言"""
    if not text:
        return 'unknown'
    
    # 简单的语言检测
    has_chinese = any('\u4e00' <= char <= '\u9fff' for char in text)
    has_english = any('a' <= char.lower() <= 'z' for char in text)
    
    if has_chinese and not has_english:
        return 'zh'
    elif has_english and not has_chinese:
        return 'en'
    elif has_chinese and has_english:
        return 'mixed'
    else:
        return 'unknown'

def translate_text(text, source_lang='auto', target_lang='auto'):
    """
    翻译文本
    参数：
        text: 要翻译的文本
        source_lang: 源语言 ('en', 'zh', 'auto')
        target_lang: 目标语言 ('en', 'zh', 'auto')
    返回：翻译后的文本
    """
    
    if not text or not isinstance(text, str):
        return "翻译错误：输入文本无效"
    
    text = text.strip()
    
    # 自动检测语言
    if source_lang == 'auto':
        detected_lang = get_language(text)
        source_lang = detected_lang if detected_lang in ['en', 'zh'] else 'en'
    
    # 确定翻译方向
    if source_lang == 'en' and target_lang != 'zh':
        target_lang = 'zh'
    elif source_lang == 'zh' and target_lang != 'en':
        target_lang = 'en'
    elif source_lang == target_lang:
        return text  # 相同语言不需要翻译
    
    print(f"🌍 [翻译] {source_lang} → {target_lang}: {text[:50]}...")
    
    try:
        if source_lang == 'en' and target_lang == 'zh':
            return translate_en2zh(text)
        elif source_lang == 'zh' and target_lang == 'en':
            return translate_zh2en(text)
        else:
            return f"不支持的语言对: {source_lang} → {target_lang}"
    
    except Exception as e:
        print(f"❌ [翻译错误] {str(e)}")
        return f"翻译失败: {str(e)}"

def translate_en2zh(english_text):
    """英文翻译为中文"""
    
    # 转换为小写进行查询
    text_lower = english_text.lower().strip()
    
    # 尝试直接匹配
    if text_lower in TRANSLATION_DICT:
        return TRANSLATION_DICT[text_lower]
    
    # 尝试逐词翻译 (简单分词)
    words = text_lower.split()
    translated_words = []
    
    for word in words:
        # 清除标点符号
        clean_word = ''.join(c for c in word if c.isalpha() or c == ' ')
        
        if clean_word in TRANSLATION_DICT:
            translated_words.append(TRANSLATION_DICT[clean_word])
        else:
            translated_words.append(word)  # 保留原词
    
    result = ''.join(translated_words)
    
    # 如果翻译结果与原文相同或很短，尝试使用翻译API
    if result == text_lower or len(result) < 3:
        return try_online_translation(english_text, 'en', 'zh')
    
    return result

def translate_zh2en(chinese_text):
    """中文翻译为英文"""
    
    # 从反向字典查询
    if chinese_text in REVERSE_DICT:
        return REVERSE_DICT[chinese_text]
    
    # 逐词尝试翻译
    translated_words = []
    i = 0
    while i < len(chinese_text):
        # 尝试匹配两字词
        if i + 1 < len(chinese_text):
            two_char = chinese_text[i:i+2]
            if two_char in REVERSE_DICT:
                translated_words.append(REVERSE_DICT[two_char])
                i += 2
                continue
        
        # 尝试匹配单字
        one_char = chinese_text[i]
        if one_char in REVERSE_DICT:
            translated_words.append(REVERSE_DICT[one_char])
        else:
            translated_words.append(one_char)  # 保留原字
        i += 1
    
    result = ' '.join(translated_words)
    
    # 如果翻译结果很短，尝试使用翻译API
    if len(result) < 3:
        return try_online_translation(chinese_text, 'zh', 'en')
    
    return result

def try_online_translation(text, source_lang, target_lang):
    """
    尝试使用在线翻译API
    支持的API: Google Translate, Baidu Translate 等
    """
    
    try:
        # 尝试使用 Google Translate API (需要 google-cloud-translate)
        api_key = os.getenv("GOOGLE_TRANSLATE_API_KEY")
        if api_key:
            try:
                from google.cloud import translate_v2
                client = translate_v2.Client()
                result = client.translate_text(text, target_language=target_lang)
                return result['translatedText']
            except Exception as e:
                print(f"⚠️ Google Translate API 失败: {str(e)}")
        
        # 尝试使用 Baidu Translate API
        baidu_app_id = os.getenv("BAIDU_APPID")
        baidu_secret_key = os.getenv("BAIDU_SECRET_KEY")
        if baidu_app_id and baidu_secret_key:
            try:
                import requests
                import hashlib
                import time
                import random
                
                url = "https://fanyi-api.baidu.com/api/trans/vip/translate"
                
                from_lang = 'en' if source_lang == 'en' else 'zh'
                to_lang = 'zh' if target_lang == 'zh' else 'en'
                
                salt = random.randint(32768, 65536)
                sign_str = baidu_app_id + text + str(salt) + baidu_secret_key
                sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()
                
                payload = {
                    'q': text,
                    'from': from_lang,
                    'to': to_lang,
                    'appid': baidu_app_id,
                    'salt': salt,
                    'sign': sign
                }
                
                response = requests.post(url, params=payload, timeout=5)
                if response.status_code == 200:
                    result = response.json()
                    if 'trans_result' in result and len(result['trans_result']) > 0:
                        return result['trans_result'][0]['dst']
            except Exception as e:
                print(f"⚠️ Baidu Translate API 失败: {str(e)}")
        
        # 如果所有在线API都失败，返回原文加提示
        return f"[离线翻译不完整] {text}"
    
    except Exception as e:
        print(f"❌ 翻译API调用失败: {str(e)}")
        return f"[翻译错误] {text}"

# ==========================================
# 测试函数
# ==========================================
if __name__ == "__main__":
    # 测试用例
    test_cases_en = [
        "Hello",
        "Good morning",
        "Thank you",
        "Nice to meet you",
        "How are you?",
    ]
    
    test_cases_zh = [
        "你好",
        "早上好",
        "谢谢你",
        "很高兴认识你",
        "你好吗",
    ]
    
    print("🌍 翻译引擎测试\n")
    
    print("📝 英文 → 中文:")
    for text in test_cases_en:
        result = translate_text(text, 'en', 'zh')
        print(f"  {text} → {result}")
    
    print("\n📝 中文 → 英文:")
    for text in test_cases_zh:
        result = translate_text(text, 'zh', 'en')
        print(f"  {text} → {result}")
