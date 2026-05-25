/**
 * Text-to-Speech service with provider pattern.
 * Default: SpeechSynthesisProvider (browser built-in).
 * Advanced: OpenAITTSProvider (OpenAI API, future).
 */

class TTSProvider {
  async synthesize(text, language) { throw new Error('not implemented'); }
  get name() { return 'abstract'; }
}

class SpeechSynthesisProvider extends TTSProvider {
  get name() { return 'speech-synthesis'; }

  async synthesize(text, language = 'en') {
    if (!window.speechSynthesis) {
      throw new Error('您的浏览器不支持语音合成');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      // Try to pick a suitable voice (handle Chrome async getVoices)
      const setVoice = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          const preferred = voices.find(v =>
            v.lang.startsWith(language === 'zh' ? 'zh' : 'en') && !v.localService
          ) || voices.find(v => v.lang.startsWith(language === 'zh' ? 'zh' : 'en'));
          if (preferred) utterance.voice = preferred;
        }
      };
      setVoice();
      // If voices not loaded yet, listen for them
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = setVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve(); // User initiated stop, not an error
        } else {
          reject(new Error(`语音合成错误: ${e.error}`));
        }
      };

      speechSynthesis.speak(utterance);
    });
  }
}

// Future: OpenAI TTS provider
class OpenAITTSProvider extends TTSProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  get name() { return 'openai-tts'; }

  async synthesize(text, language = 'en') {
    const voice = language === 'zh' ? 'nova' : 'alloy';
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API 错误 (${response.status})`);
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    return new Promise((resolve, reject) => {
      audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
      audio.onerror = () => reject(new Error('音频播放失败'));
      audio.play();
    });
  }
}

export function createTTSProvider(apiKeys = {}) {
  if (apiKeys.openai) {
    return new OpenAITTSProvider(apiKeys.openai);
  }
  return new SpeechSynthesisProvider();
}
