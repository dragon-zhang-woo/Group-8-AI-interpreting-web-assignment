/**
 * Speech-to-Text service with provider pattern.
 * Supports WebSpeechProvider (browser built-in) and WhisperProvider (OpenAI API, future).
 */

class STTProvider {
  async transcribe(audioBlob, language) { throw new Error('not implemented'); }
  get name() { return 'abstract'; }
}

class WebSpeechProvider extends STTProvider {
  constructor() {
    super();
    this.supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  get name() { return 'web-speech'; }

  async transcribe(audioBlob, language = 'auto') {
    if (!this.supported) {
      throw new Error('您的浏览器不支持语音识别，请使用 Chrome 或 Edge');
    }

    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let finalResult = '';
      recognition.onresult = (event) => {
        finalResult = event.results[0][0].transcript;
      };
      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          reject(new Error('未检测到语音，请重新录制'));
        } else if (event.error === 'not-allowed') {
          reject(new Error('需要麦克风权限才能进行语音识别'));
        } else {
          reject(new Error(`语音识别错误: ${event.error}`));
        }
      };
      recognition.onend = () => {
        if (finalResult) {
          resolve({ text: finalResult, confidence: 1.0, language });
        } else {
          reject(new Error('未识别到有效语音，请重新录制'));
        }
      };

      recognition.start();
    });
  }
}

// Future: OpenAI Whisper provider
class WhisperProvider extends STTProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  get name() { return 'openai-whisper'; }

  async transcribe(audioBlob, language = 'auto') {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    if (language !== 'auto') formData.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Whisper API 错误 (${response.status})`);
    }
    const data = await response.json();
    return { text: data.text, confidence: 1.0, language };
  }
}

export function createSTTProvider(apiKeys = {}) {
  if (apiKeys.openai) {
    return new WhisperProvider(apiKeys.openai);
  }
  return new WebSpeechProvider();
}
