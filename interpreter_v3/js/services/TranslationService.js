/**
 * Translation service with provider pattern.
 * Default: MyMemory API + LibreTranslate fallback (free, no auth).
 * Advanced: DeepL API (needs API key, future).
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';

class TranslationProvider {
  async translate(text, sourceLang, targetLang) { throw new Error('not implemented'); }
  get name() { return 'abstract'; }
}

class MyMemoryProvider extends TranslationProvider {
  get name() { return 'mymemory'; }

  async translate(text, sourceLang, targetLang) {
    const langPair = this._buildLangPair(sourceLang, targetLang);
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`MyMemory API 错误 (${response.status})`);

    const data = await response.json();
    if (data.responseStatus !== 200 && data.responseStatus !== 403) {
      throw new Error(`翻译失败: ${data.responseDetails || '未知错误'}`);
    }
    return data.responseData.translatedText || text;
  }

  _buildLangPair(sourceLang, targetLang) {
    const src = sourceLang === 'zh' ? 'zh-CN' : 'en';
    const tgt = targetLang === 'zh' ? 'zh-CN' : 'en';
    return `${src}|${tgt}`;
  }
}

class LibreTranslateProvider extends TranslationProvider {
  get name() { return 'libretranslate'; }

  async translate(text, sourceLang, targetLang) {
    const src = sourceLang === 'zh' ? 'zh' : 'en';
    const tgt = targetLang === 'zh' ? 'zh' : 'en';

    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: src, target: tgt, format: 'text' })
    });

    if (!response.ok) throw new Error(`LibreTranslate API 错误 (${response.status})`);
    const data = await response.json();
    return data.translatedText || text;
  }
}

// Future: DeepL provider
class DeepLProvider extends TranslationProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  get name() { return 'deepl'; }

  async translate(text, sourceLang, targetLang) {
    const src = sourceLang === 'zh' ? 'ZH' : 'EN';
    const tgt = targetLang === 'zh' ? 'ZH' : 'EN-US';

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: [text], source_lang: src, target_lang: tgt })
    });

    if (!response.ok) throw new Error(`DeepL API 错误 (${response.status})`);
    const data = await response.json();
    return data.translations?.[0]?.text || text;
  }
}

export function createTranslationProvider(apiKeys = {}) {
  const providers = [new MyMemoryProvider()];

  // Add LibreTranslate as fallback
  providers.push(new LibreTranslateProvider());

  // Add DeepL if API key is available
  if (apiKeys.deepl) {
    providers.unshift(new DeepLProvider(apiKeys.deepl));
  }

  return {
    providers,
    async translate(text, sourceLang, targetLang) {
      let lastError = null;
      for (const provider of providers) {
        try {
          return await provider.translate(text, sourceLang, targetLang);
        } catch (e) {
          lastError = e;
          console.warn(`${provider.name} translation failed, trying next...`, e);
        }
      }
      ErrorHandler.handleAPIError(lastError || new Error('All translation providers failed'), '翻译');
      throw lastError || new Error('翻译服务暂时不可用，请稍后重试');
    },
    getActiveProviderName() {
      return providers[0].name;
    }
  };
}
