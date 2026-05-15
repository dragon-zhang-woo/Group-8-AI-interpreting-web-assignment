"""
AI 口译练习网站 - Flask 后端主文件
集成翻译、语音识别、评分和数据持久化功能
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import io
import json
import sys
from datetime import datetime
from dotenv import load_dotenv

# 导入各个模块
from audio_engine import speech_to_text, text_to_speech
from translate_engine import translate_text, get_language
from scoring_engine import score_translation
from data_manager import get_random_material, save_record, get_all_records

# 加载环境变量
load_dotenv()

# 设置UTF-8编码支持
if sys.platform == 'win32':
    import codecs
    # 不要在 Windows 上重新包装 stdout，会导致 I/O 错误
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# 创建 Flask 应用
app = Flask(__name__)
CORS(app)

# 配置
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB 最大文件大小
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ==========================================
# API 端点 1：翻译接口
# ==========================================
@app.route('/api/translate', methods=['POST'])
def api_translate():
    """
    翻译文本
    请求体: { "text": "...", "source_lang": "en" 或 "zh", "target_lang": "zh" 或 "en" }
    """
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        source_lang = data.get('source_lang', 'auto')
        target_lang = data.get('target_lang', 'auto')
        
        if not text:
            return jsonify({'error': '文本不能为空'}), 400
        
        print(f"📝 [翻译] {source_lang} → {target_lang}: {text[:50]}...")
        
        # 调用翻译引擎
        translated_text = translate_text(text, source_lang, target_lang)
        
        return jsonify({
            'success': True,
            'source_text': text,
            'translated_text': translated_text,
            'source_lang': source_lang,
            'target_lang': target_lang
        }), 200
    
    except Exception as e:
        print(f"❌ [翻译错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 2：语音转文字
# ==========================================
@app.route('/api/speech-to-text', methods=['POST'])
def api_speech_to_text():
    """
    将音频转为文字
    请求: 上传音频文件，参数 language=en 或 zh
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '未找到音频文件'}), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'auto')
        
        if audio_file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        # 保存临时文件
        audio_path = os.path.join(UPLOAD_FOLDER, f"{datetime.now().timestamp()}.wav")
        audio_file.save(audio_path)
        
        print(f"🎤 [STT] 处理音频: {audio_path}, 语言: {language}")
        
        # 调用语音识别引擎
        text = speech_to_text(audio_path)
        
        # 清理临时文件
        try:
            os.remove(audio_path)
        except:
            pass
        
        return jsonify({
            'success': True,
            'text': text,
            'language': language
        }), 200
    
    except Exception as e:
        print(f"❌ [STT错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 3：文字转语音
# ==========================================
@app.route('/api/text-to-speech', methods=['POST'])
def api_text_to_speech():
    """
    将文字转为语音音频
    请求体: { "text": "...", "language": "en-US" 或 "zh-CN" }
    返回: 音频文件
    """
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        language = data.get('language', 'en-US')
        
        if not text:
            return jsonify({'error': '文本不能为空'}), 400
        
        print(f"🔊 [TTS] {language}: {text[:50]}...")
        
        # 调用文字转语音引擎
        audio_path = text_to_speech(text, language)
        
        if audio_path and os.path.exists(audio_path):
            return send_file(audio_path, mimetype='audio/wav', as_attachment=True, 
                           download_name=f"translation_{datetime.now().timestamp()}.wav")
        else:
            return jsonify({'error': '无法生成语音'}), 500
    
    except Exception as e:
        print(f"❌ [TTS错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 4：评分接口 (3维度)
# ==========================================
@app.route('/api/score', methods=['POST'])
def api_score():
    """
    对用户的翻译进行评分
    请求体: {
        "original_text": "...",
        "user_translation": "...",
        "reference_translation": "...",
        "source_lang": "en" 或 "zh",
        "target_lang": "zh" 或 "en"
    }
    返回: { "pronunciation": 3, "fluency": 2, "accuracy": 3, "total": 2.67, "feedback": "..." }
    """
    try:
        data = request.get_json()
        original_text = data.get('original_text', '')
        user_translation = data.get('user_translation', '')
        reference_translation = data.get('reference_translation', '')
        source_lang = data.get('source_lang', 'en')
        target_lang = data.get('target_lang', 'zh')
        user_audio_text = data.get('user_audio_text', '')  # 用户录音识别结果
        
        if not original_text or not user_translation:
            return jsonify({'error': '必需字段缺失'}), 400
        
        print(f"📊 [评分] 原文: {original_text[:30]}... 用户翻译: {user_translation[:30]}...")
        
        # 调用评分引擎
        scores = score_translation(
            original_text=original_text,
            user_translation=user_translation,
            reference_translation=reference_translation,
            source_lang=source_lang,
            target_lang=target_lang,
            user_audio_text=user_audio_text
        )
        
        return jsonify({
            'success': True,
            'pronunciation_score': scores.get('发音', 0),
            'fluency_score': scores.get('流畅', 0),
            'accuracy_score': scores.get('准确', 0),
            'total_score': scores.get('总分', 0),
            'feedback': scores.get('评语', ''),
            'suggestions': scores.get('建议', [])
        }), 200
    
    except Exception as e:
        print(f"❌ [评分错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 5：保存学习记录
# ==========================================
@app.route('/api/save-record', methods=['POST'])
def api_save_record():
    """
    保存用户的学习记录
    请求体: {
        "original_text": "...",
        "user_translation": "...",
        "scores": { "发音": 3, "流畅": 2, "准确": 3 },
        "feedback": "..."
    }
    """
    try:
        data = request.get_json()
        original_text = data.get('original_text', '')
        user_translation = data.get('user_translation', '')
        scores_dict = data.get('scores', {})
        
        if not original_text or not user_translation:
            return jsonify({'error': '数据不完整'}), 400
        
        print(f"💾 [记录] 保存练习记录: {original_text[:30]}...")
        
        # 调用数据管理器
        result = save_record(original_text, user_translation, scores_dict)
        
        return jsonify({
            'success': True,
            'message': result,
            'timestamp': datetime.now().isoformat()
        }), 200
    
    except Exception as e:
        print(f"❌ [保存错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 6：获取学习记录
# ==========================================
@app.route('/api/records', methods=['GET'])
def api_get_records():
    """
    获取所有学习记录
    """
    try:
        print("📋 [记录] 获取所有学习记录...")
        
        # 调用数据管理器
        records = get_all_records()
        
        return jsonify({
            'success': True,
            'records': records,
            'count': len(records)
        }), 200
    
    except Exception as e:
        print(f"❌ [记录读取错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 7：获取随机练习材料
# ==========================================
@app.route('/api/material', methods=['GET'])
def api_get_material():
    """
    获取一个随机的练习材料
    """
    try:
        print("📚 [材料] 获取随机练习材料...")
        
        material_text = get_random_material()
        
        return jsonify({
            'success': True,
            'material': material_text
        }), 200
    
    except Exception as e:
        print(f"❌ [材料错误] {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

# ==========================================
# API 端点 8：健康检查
# ==========================================
@app.route('/api/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    """
    return jsonify({
        'status': 'healthy',
        'version': '1.0',
        'timestamp': datetime.now().isoformat()
    }), 200

# ==========================================
# 错误处理
# ==========================================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '端点不存在', 'status': 404}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': '服务器内部错误', 'status': 500}), 500

# ==========================================
# 启动应用
# ==========================================
if __name__ == '__main__':
    print("[*] Starting AI Interpretation Practice Backend Service...")
    print("[*] Service: http://localhost:5000")
    print("[*] API Doc: http://localhost:5000/api/health")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=True
    )
