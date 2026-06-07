export class SpeechRecognitionService {
  constructor() {
    this.Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    this.recognition = null;
  }

  get supported() {
    return Boolean(this.Recognition);
  }

  start({ direction, onInterim, onFinal, onError, continuous = true }) {
    if (!this.supported) {
      throw new Error("当前浏览器不支持语音识别，请使用 Chrome 或 Edge。");
    }

    this.stop();
    const recognition = new this.Recognition();
    recognition.lang = direction === "zh-en" ? "zh-CN" : "en-US";
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = "";
    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) onInterim?.(interimText.trim());
      if (finalText) onFinal?.(finalText.trim());
    };
    recognition.onerror = (event) => {
      onError?.(new Error(`语音识别错误: ${event.error}`));
    };

    this.recognition = recognition;
    recognition.start();
  }

  stop() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      // Browser implementations may throw when already stopped.
    }
    this.recognition = null;
  }
}

export class SpeechSynthesisService {
  async speak(text, language) {
    if (!globalThis.speechSynthesis) {
      throw new Error("当前浏览器不支持语音合成。");
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "zh" ? "zh-CN" : "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;

    const assignVoice = () => {
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find((voice) => voice.lang.startsWith(language === "zh" ? "zh" : "en"));
      if (preferred) utterance.voice = preferred;
    };
    assignVoice();
    if (speechSynthesis.getVoices().length === 0) speechSynthesis.onvoiceschanged = assignVoice;

    return new Promise((resolve, reject) => {
      utterance.onend = resolve;
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") resolve();
        else reject(new Error(`语音合成错误: ${event.error}`));
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }
}

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  get supported() {
    return Boolean(globalThis.MediaRecorder && navigator.mediaDevices?.getUserMedia);
  }

  async start() {
    if (!this.supported) throw new Error("当前浏览器不支持录音。");
    this.stopTracks();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.startedAt = Date.now();
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data?.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start();
  }

  async stop() {
    if (!this.mediaRecorder) return { blob: null, durationSeconds: 0 };
    const recorder = this.mediaRecorder;
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      if (recorder.state !== "inactive") recorder.stop();
      else resolve();
    });
    const durationSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }) : null;
    this.mediaRecorder = null;
    this.stopTracks();
    return { blob, durationSeconds };
  }

  stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
