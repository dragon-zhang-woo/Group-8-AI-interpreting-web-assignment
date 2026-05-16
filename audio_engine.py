"""
音频引擎 - 支持语音转文字和文字转语音
"""

import os
import asyncio
import tempfile
import requests
import base64
import edge_tts
from dotenv import load_dotenv
import sys
import io

# 设置UTF-8编码支持
if sys.platform == 'win32':
    import codecs
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 加载 .env 文件中的环境变量
load_dotenv()

def speech_to_text(audio_path: str, language: str = 'en') -> str:
    """
    功能 1: 语音转文字 (STT) - 同步调用
    使用阿里最新 SenseVoice 大模型 (原生支持多语言，比 Paraformer 更强)
    直接使用 HTTP RESTful 接口，彻底绕过老旧 SDK 的 Callback Bug
    """
    if not audio_path or not os.path.exists(audio_path):
        return "未检测到有效音频文件。"

    print(f"🎤 [STT] 正在识别音频: {audio_path}, 语言: {language}")
    
    # 阿里灵积平台最新的 OpenAI 兼容音频接口
    url = "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions"
    api_key = os.getenv("DASHSCOPE_API_KEY")
    
    if not api_key:
        print("❌ [STT] 错误: 未在 .env 文件中找到 DASHSCOPE_API_KEY")
        print("⚠️ [STT] 已启用离线模式，返回演示文本")
        return "这是一个演示文本。在实际应用中，系统会使用真实的语音识别API来处理您上传的音频文件。"
    
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    
    try:
        # 使用 requests 直接发起 multipart/form-data 请求
        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f)}
            data = {
                "model": "sensevoice-v1",  # 使用更先进的多语言大模型
                "language": language,  # 指定语言
            }
            
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                text = result.get("text", "")
                print(f"✅ [STT] 识别成功: {text[:100]}")
                return text if text else "未识别到文本内容"
            else:
                print(f"❌ [STT] API 返回错误: {response.status_code} - {response.text}")
                if response.status_code == 401 or response.status_code == 403:
                    return "API 密钥无效或已过期，请在 .env 文件中更新 DASHSCOPE_API_KEY。当前已启用离线演示模式。"
                elif response.status_code == 404:
                    return "语音识别服务暂时不可用（API端点不存在），已启用离线演示模式，您可以手动输入翻译文本。"
                else:
                    return "语音识别服务暂时不可用，已启用离线演示模式，您可以手动输入翻译文本。"
    
    except requests.exceptions.Timeout:
        print("❌ [STT] 请求超时，请检查网络连接")
        return "请求超时，请检查网络连接"
    except requests.exceptions.ConnectionError:
        print("❌ [STT] 网络连接失败，已启用离线模式")
        return "这是一个演示文本。网络连接失败，请检查互联网连接。"
    except Exception as e:
        print(f"❌ [STT] 发生错误: {str(e)}")
        return f"发生错误: {str(e)}"

def text_to_speech(text: str, language: str = "zh-CN") -> str:
    """
    功能 2: 文字转语音 (TTS)
    使用 Microsoft Edge TTS 引擎 (无需API密钥，完全免费)
    支持多种语言
    返回: 生成的音频文件路径
    """
    if not text:
        print("❌ [TTS] 错误: 输入文本为空")
        return ""
    
    print(f"🔊 [TTS] 生成语音: {text[:50]}... (语言: {language})")
    
    try:
        # 创建临时文件
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        output_path = temp_file.name
        temp_file.close()
        
        # 运行异步函数来生成语音
        asyncio.run(_async_text_to_speech(text, language, output_path))
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"✅ [TTS] 语音生成成功: {output_path}")
            return output_path
        else:
            print("❌ [TTS] 生成的文件无效")
            return ""
    
    except Exception as e:
        print(f"❌ [TTS] 发生错误: {str(e)}")
        return ""

async def _async_text_to_speech(text: str, language: str, output_path: str):
    """异步执行文字转语音"""
    try:
        communicate = edge_tts.Communicate(text=text, voice=_get_voice(language), rate="+0%")
        await communicate.save(output_path)
        print(f"✅ [TTS] 文件已保存: {output_path}")
    except Exception as e:
        print(f"❌ [TTS] 异步错误: {str(e)}")

def _get_voice(language: str) -> str:
    """获取对应语言的语音"""
    voice_map = {
        "zh-CN": "zh-CN-XiaoxiaoNeural",      # 中文（女性）
        "zh-TW": "zh-TW-HsiaoChenNeural",     # 繁体中文
        "en-US": "en-US-AriaNeural",           # 英文（美国）
        "en-GB": "en-GB-SoniaNeural",          # 英文（英国）
        "zh": "zh-CN-XiaoxiaoNeural",
        "en": "en-US-AriaNeural",
    }
    return voice_map.get(language, "zh-CN-XiaoxiaoNeural")

# ==========================================
# 测试函数
# ==========================================
if __name__ == "__main__":
    print("🎤 音频引擎测试\n")
    
    # 测试文字转语音
    print("📝 测试文字转语音:")
    test_texts = [
        ("你好，欢迎使用AI口译练习系统", "zh-CN"),
        ("Hello, welcome to the AI interpretation practice system", "en-US"),
    ]
    
    for text, lang in test_texts:
        print(f"  生成语音: {text[:30]}... (语言: {lang})")
        output = text_to_speech(text, lang)
        if output:
            print(f"  ✅ 输出文件: {output}")
        else:
            print(f"  ❌ 生成失败")
