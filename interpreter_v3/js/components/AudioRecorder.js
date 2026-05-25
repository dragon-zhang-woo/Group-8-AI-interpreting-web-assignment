/**
 * Audio recorder using MediaRecorder API.
 * Handles microphone access, recording lifecycle, and playback.
 */
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.startTime = null;
    this._isRecording = false;
    this.durationSeconds = 0;
    this.lastBlob = null;
    this.stateChangeListeners = [];
    this.timerInterval = null;
    this.MAX_DURATION = 120; // seconds
  }

  async requestPermission() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      return true;
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        ErrorHandler.showError('需要麦克风权限才能录音，请在浏览器设置中允许麦克风访问', 'permission');
      } else if (e.name === 'NotFoundError') {
        ErrorHandler.showError('未检测到麦克风设备，请连接麦克风后重试', 'permission');
      } else {
        ErrorHandler.showError(`麦克风访问失败: ${e.message}`, 'permission');
      }
      return false;
    }
  }

  async startRecording() {
    if (!this.stream) {
      const granted = await this.requestPermission();
      if (!granted) throw new Error('麦克风权限未授予');
    }

    this.chunks = [];
    this.startTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType });
      this.lastBlob = blob;
      this.durationSeconds = (Date.now() - this.startTime) / 1000;
    };

    this.mediaRecorder.onerror = (e) => {
      ErrorHandler.showError('录音过程中出现错误', 'api');
    };

    this.mediaRecorder.start();
    this._isRecording = true;
    this._notifyListeners();

    // Start timer
    this.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (elapsed >= this.MAX_DURATION) {
        this.stopRecording();
      }
      this.durationSeconds = elapsed;
    }, 100);
  }

  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this._isRecording = false;
        this._notifyListeners();
        resolve(this.lastBlob);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        this.lastBlob = blob;
        this.durationSeconds = (Date.now() - this.startTime) / 1000;
        this._isRecording = false;
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this._notifyListeners();

        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
          this.stream = null;
        }

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  getDuration() {
    return this.durationSeconds;
  }

  getFormattedDuration() {
    const s = Math.floor(this.durationSeconds);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  isRecording() {
    return this._isRecording;
  }

  getLastBlob() {
    return this.lastBlob;
  }

  createAudioPlayer(audioBlob) {
    if (!audioBlob) return null;
    const url = URL.createObjectURL(audioBlob);
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.className = 'w-full mt-2';
    audio.src = url;
    audio.onended = () => {
      // Keep URL alive until audio element is removed
    };
    return audio;
  }

  playAudio(audioBlob) {
    const audio = this.createAudioPlayer(audioBlob);
    if (audio) {
      audio.play().catch(e => console.warn('Audio play failed:', e));
    }
  }

  onRecordingStateChange(callback) {
    this.stateChangeListeners.push(callback);
  }

  _notifyListeners() {
    this.stateChangeListeners.forEach(cb => cb(this._isRecording));
  }

  reset() {
    this.lastBlob = null;
    this.chunks = [];
    this.durationSeconds = 0;
    this.startTime = null;
  }
}
