/**
 * Translation engine: orchestrates STT → Translation → TTS workflow.
 */
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class TranslationEngine {
  constructor(translationService, ttsService) {
    this.translationService = translationService;
    this.ttsService = ttsService;
    this.languageDirection = 'en-zh';
    this.cache = new Map(); // Simple in-memory cache, max 5 entries
    this.MAX_CACHE = 5;
  }

  setLanguageDirection(direction) {
    this.languageDirection = direction;
  }

  getLanguageDirection() {
    return this.languageDirection;
  }

  getSourceLanguage() {
    return this.languageDirection === 'en-zh' ? 'en' : 'zh';
  }

  getTargetLanguage() {
    return this.languageDirection === 'en-zh' ? 'zh' : 'en';
  }

  async translate(sourceText, sourceLanguage = null, targetLanguage = null) {
    const srcLang = sourceLanguage || this.getSourceLanguage();
    const tgtLang = targetLanguage || this.getTargetLanguage();

    if (!sourceText || sourceText.trim().length === 0) {
      throw new Error('请输入要翻译的文本');
    }

    const cacheKey = `${sourceText}|${srcLang}|${tgtLang}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const translatedText = await this.translationService.translate(sourceText, srcLang, tgtLang);

      const result = {
        sourceText,
        translatedText,
        sourceLanguage: srcLang,
        targetLanguage: tgtLang,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.cache.size >= this.MAX_CACHE) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, result);

      return result;
    } catch (e) {
      ErrorHandler.handleAPIError(e, '翻译引擎');
      throw e;
    }
  }

  async synthesizeSpeech(text, language = null) {
    const lang = language || this.getTargetLanguage();
    if (!text || text.trim().length === 0) {
      throw new Error('没有可播放的文本');
    }
    try {
      await this.ttsService.synthesize(text, lang);
    } catch (e) {
      ErrorHandler.handleAPIError(e, '语音合成');
      throw e;
    }
  }

  // Translate from source language to target and also synthesize audio
  async translateAndSpeak(sourceText) {
    const result = await this.translate(sourceText);
    await this.synthesizeSpeech(result.translatedText, result.targetLanguage);
    return result;
  }
}
