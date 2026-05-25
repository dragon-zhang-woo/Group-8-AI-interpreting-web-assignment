#!/usr/bin/env python
# -*- coding: utf-8 -*-

import audio_engine
import asyncio
import os

def test_all():
    print("=" * 50)
    print("audio_engine.py 功能验证测试")
    print("=" * 50)
    
    # Test 1: text_to_text
    print("\n[测试 1] 文字翻译 (TTT)")
    result = audio_engine.text_to_text('Hello World', 'zh')
    print(f"  结果长度: {len(result)}")
    print(f"  状态: {'PASS' if len(result) > 0 else 'FAIL'}")
    
    # Test 2: speech_to_text
    print("\n[测试 2] 语音识别 (STT)")
    if os.path.exists('test_1.mp3'):
        result = audio_engine.speech_to_text('test_1.mp3')
        print(f"  结果: {result[:50]}")
        print(f"  状态: {'PASS' if len(result) > 0 else 'FAIL'}")
    else:
        print("  状态: SKIP (test_1.mp3 不存在)")
    
    # Test 3: text_to_speech
    print("\n[测试 3] 文字转语音 (TTS)")
    async def test_tts():
        result = await audio_engine.text_to_speech('Test audio', 'en')
        return result
    
    try:
        result = asyncio.run(test_tts())
        print(f"  生成文件: {result is not None}")
        print(f"  状态: {'PASS' if result else 'FAIL'}")
    except Exception as e:
        print(f"  错误: {e}")
        print(f"  状态: FAIL")
    
    # Test 4: speech_to_speech
    print("\n[测试 4] 完整管道 (S2S)")
    if os.path.exists('test_1.mp3'):
        async def test_s2s():
            return await audio_engine.speech_to_speech('test_1.mp3', 'en')
        
        try:
            orig, trans, audio = asyncio.run(test_s2s())
            print(f"  原文: {orig[:30]}")
            print(f"  译文: {trans[:30]}")
            print(f"  音频: {audio is not None}")
            print(f"  状态: {'PASS' if (orig and trans and audio) else 'PARTIAL'}")
        except Exception as e:
            print(f"  错误: {e}")
            print(f"  状态: FAIL")
    else:
        print("  状态: SKIP (test_1.mp3 不存在)")
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)

if __name__ == "__main__":
    test_all()
