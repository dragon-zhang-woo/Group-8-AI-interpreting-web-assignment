/**
 * AI Interpreting Training Platform — Main Application Bootstrap
 * Initializes all services, components, and wires up UI event handlers.
 */
import { IndexedDBManager } from './storage/IndexedDBManager.js';
import { LocalStorageManager } from './utils/LocalStorageManager.js';
import { ErrorHandler } from './utils/ErrorHandler.js';
import { LoadingIndicator } from './utils/LoadingIndicator.js';
import { Validator } from './utils/Validator.js';
import { RadarChart } from './utils/RadarChart.js';
import { createSTTProvider } from './services/STTService.js';
import { createTranslationProvider } from './services/TranslationService.js';
import { createTTSProvider } from './services/TTSService.js';
import { MaterialLibrary } from './components/MaterialLibrary.js';
import { ScoringEngine } from './components/ScoringEngine.js';
import { TabManager } from './components/TabManager.js';
import { AudioRecorder } from './components/AudioRecorder.js';
import { TranslationEngine } from './components/TranslationEngine.js';
import { RecordManager } from './components/RecordManager.js';

// ==================== APP BOOTSTRAP ====================

class App {
  constructor() {
    this.localStorage = new LocalStorageManager();
    this.apiKeys = this.localStorage.getApiKeys();
    this.languageDirection = this.localStorage.getLanguageDirection();
    this.currentMaterial = null; // current practice material
    this.lastScoreReport = null;  // last scoring result
    this.currentAudioBlobId = null;
    this.practiceRecognition = null; // live STT instance during practice recording
    this.demoRecognition = null;      // live STT instance during demo voice input
  }

  async init() {
    ErrorHandler.init();

    try {
      LoadingIndicator.show('初始化中...');

      // 1. Init IndexedDB
      this.db = new IndexedDBManager();
      await this.db.init();

      // 2. Create services
      this.stt = createSTTProvider(this.apiKeys);
      this.translation = createTranslationProvider(this.apiKeys);
      this.tts = createTTSProvider(this.apiKeys);

      // 3. Create components
      this.materials = new MaterialLibrary();
      await this.materials.load();

      this.scoring = new ScoringEngine();
      this.translationEngine = new TranslationEngine(this.translation, this.tts);
      this.translationEngine.setLanguageDirection(this.languageDirection);

      this.audioRecorder = new AudioRecorder();
      this.records = new RecordManager(this.db);

      this.tabs = new TabManager(document.getElementById('app'));
      this.tabs.init();

      // Auto-refresh records when switching to records tab
      this.tabs.onTabChange((tabName) => {
        if (tabName === 'records') this._loadRecords();
      });

      this.radarChart = new RadarChart('scoreRadar');

      // 4. Wire up UI
      this._bindDemoTab();
      this._bindPracticeTab();
      this._bindRecordsTab();
      this._bindSharedControls();

      // 5. Set initial direction
      this._updateDirectionUI(this.languageDirection);

      // 6. Load initial records
      await this._loadRecords();

      LoadingIndicator.hide();
      console.log('AI Interpreting Platform initialized successfully.');
      console.log(`STT: ${this.stt.name}, Translation: ${this.translation.getActiveProviderName()}, TTS: ${this.tts.name}`);

    } catch (e) {
      LoadingIndicator.hide();
      ErrorHandler.showError(`初始化失败: ${e.message}`, 'api');
      console.error('App init error:', e);
    }
  }

  // ==================== DEMO TAB ====================

  _bindDemoTab() {
    const self = this;

    // Language direction buttons
    document.querySelectorAll('#demoDirection .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        self._setDemoDirection(btn.dataset.direction);
      });
    });

    // Input mode toggle
    document.querySelectorAll('#inputModeToggle .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        self._switchInputMode(btn.dataset.mode);
      });
    });

    // Text translation
    document.getElementById('demoTranslateBtn').addEventListener('click', async () => {
      const textEl = document.getElementById('demoSourceText');
      const text = textEl.value.trim();
      const validation = Validator.validateText(text, 1, 500);
      if (!validation.valid) {
        ErrorHandler.showError(validation.error, 'validation');
        return;
      }

      const btn = document.getElementById('demoTranslateBtn');
      LoadingIndicator.showForElement(btn);
      try {
        const result = await self.translationEngine.translate(text);
        self._showDemoResult(result);
      } catch (e) {
        ErrorHandler.handleAPIError(e, '翻译');
      } finally {
        LoadingIndicator.hideForElement(btn);
      }
    });

    // Voice recording — starts BOTH MediaRecorder and live STT concurrently
    document.getElementById('demoRecordBtn').addEventListener('click', async () => {
      try {
        self._showDemoStatus('');
        await self.audioRecorder.startRecording();
        self._updateDemoRecordingUI(true);

        // Start live STT concurrently
        self._stopDemoRecognition();
        const srcLang = self.languageDirection === 'en-zh' ? 'en' : 'zh';
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.lang = srcLang === 'zh' ? 'zh-CN' : 'en-US';
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onresult = (event) => {
            let finalText = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) { finalText += transcript; }
              else { interimText += transcript; }
            }
            if (finalText) {
              document.getElementById('demoRecognitionBox').classList.remove('hidden');
              document.getElementById('demoRecognitionText').textContent = finalText;
              document.getElementById('demoLiveInterimBox').classList.add('hidden');
              self._showDemoStatus('识别完成', 'success');
            } else if (interimText) {
              document.getElementById('demoLiveInterimBox').classList.remove('hidden');
              document.getElementById('demoLiveInterim').textContent = interimText;
            }
          };

          recognition.onerror = (e) => {
            if (e.error === 'no-speech') { self._showDemoStatus('未检测到语音'); }
            else if (e.error === 'not-allowed') { ErrorHandler.showError('需要麦克风权限', 'permission'); }
            else if (e.error !== 'aborted') { console.warn('Demo STT error:', e.error); }
          };

          recognition.onend = () => {
            self.demoRecognition = null;
            document.getElementById('demoLiveInterimBox').classList.add('hidden');
          };

          self.demoRecognition = recognition;
          recognition.start();
        }
      } catch (e) {
        ErrorHandler.showError(e.message, 'permission');
      }
    });

    document.getElementById('demoStopBtn').addEventListener('click', async () => {
      try {
        self._updateDemoRecordingUI('processing');
        self._stopDemoRecognition();
        await self.audioRecorder.stopRecording();
        self._updateDemoRecordingUI(false);
        if (!document.getElementById('demoRecognitionText').textContent) {
          self._showDemoStatus('录音完成，但未识别到有效语音');
        }
      } catch (e) {
        ErrorHandler.handleAPIError(e, '录音');
        self._updateDemoRecordingUI(false);
      }
    });

    document.getElementById('demoClearVoiceBtn').addEventListener('click', () => {
      self.audioRecorder.reset();
      self._updateDemoRecordingUI(false);
      document.getElementById('demoRecognitionBox').classList.add('hidden');
      document.getElementById('demoRecognitionText').textContent = '';
      document.getElementById('demoResultBox').classList.add('hidden');
      document.getElementById('demoResultText').textContent = '';
      self._showDemoStatus('');
      self._stopDemoRecognition();
    });

    // Use recognized text for translation
    document.getElementById('demoUseRecognizedBtn').addEventListener('click', async () => {
      const text = document.getElementById('demoRecognitionText').textContent;
      if (!text) return;

      const btn = document.getElementById('demoUseRecognizedBtn');
      LoadingIndicator.showForElement(btn);
      try {
        const result = await self.translationEngine.translate(text);
        self._showDemoResult(result);
      } catch (e) {
        ErrorHandler.handleAPIError(e, '翻译');
      } finally {
        LoadingIndicator.hideForElement(btn);
      }
    });

    // Play TTS
    document.getElementById('demoPlayBtn').addEventListener('click', () => {
      const text = document.getElementById('demoResultText').textContent;
      if (text) {
        const tgtLang = self.languageDirection === 'en-zh' ? 'zh' : 'en';
        self.translationEngine.synthesizeSpeech(text, tgtLang).catch(e => {
          ErrorHandler.handleAPIError(e, '语音合成');
        });
      }
    });

    // Copy result
    document.getElementById('demoCopyBtn').addEventListener('click', () => {
      const text = document.getElementById('demoResultText').textContent;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          self._showDemoStatus('已复制到剪贴板 ✓', 'success');
        }).catch(() => {
          ErrorHandler.showError('复制失败', 'api');
        });
      }
    });

    // AudioRecorder state changes
    this.audioRecorder.onRecordingStateChange((isRecording) => {
      if (!isRecording && document.getElementById('demoStopBtn').style.display !== 'none') {
        // Auto-stopped (max duration reached)
        document.getElementById('demoStopBtn').click();
      }
    });
  }

  _setDemoDirection(direction) {
    this.languageDirection = direction;
    this.localStorage.saveLanguageDirection(direction);
    this.translationEngine.setLanguageDirection(direction);
    this._updateDirectionUI(direction);

    // Update placeholder
    const textEl = document.getElementById('demoSourceText');
    textEl.placeholder = direction === 'en-zh' ? '请输入要翻译的英文文本...' : '请输入要翻译的中文文本...';
  }

  _switchInputMode(mode) {
    document.querySelectorAll('#inputModeToggle .pill').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.getElementById('demoTextPanel').classList.toggle('hidden', mode !== 'text');
    document.getElementById('demoVoicePanel').classList.toggle('hidden', mode !== 'voice');
  }

  _updateDemoRecordingUI(isRecording) {
    const recordBtn = document.getElementById('demoRecordBtn');
    const stopBtn = document.getElementById('demoStopBtn');
    const timerEl = document.getElementById('demoTimer');
    const statusEl = document.getElementById('demoRecordStatus');

    if (isRecording === 'processing') {
      recordBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
      timerEl.classList.add('hidden');
      statusEl.textContent = '处理音频中...';
      return;
    }

    if (isRecording) {
      recordBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      timerEl.classList.remove('hidden');
      timerEl.classList.add('recording-active');
      statusEl.textContent = '正在录音...';
      this._startTimer('demoTimer');
    } else {
      recordBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      timerEl.classList.add('hidden');
      timerEl.classList.remove('recording-active');
      this._stopTimer('demoTimer');
      document.getElementById('demoTimer').textContent = '00:00';
      statusEl.textContent = '';
    }
  }

  _showDemoResult(result) {
    document.getElementById('demoResultBox').classList.remove('hidden');
    document.getElementById('demoResultText').textContent = result.translatedText;
  }

  _stopDemoRecognition() {
    if (this.demoRecognition) {
      try { this.demoRecognition.stop(); } catch (e) {}
      this.demoRecognition = null;
    }
    document.getElementById('demoLiveInterimBox').classList.add('hidden');
    document.getElementById('demoLiveInterim').textContent = '';
  }

  _showDemoStatus(msg, type = '') {
    const el = document.getElementById('demoStatusMsg');
    if (!msg) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.classList.remove('hidden');
    el.textContent = msg;
    if (type === 'success') {
      setTimeout(() => el.classList.add('hidden'), 3000);
    }
  }

  // ==================== PRACTICE TAB ====================

  _bindPracticeTab() {
    const self = this;

    // Direction toggle
    document.querySelectorAll('#practiceDirection .pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#practiceDirection .pill').forEach(b => {
          const isActive = b.dataset.direction === btn.dataset.direction;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        self.languageDirection = btn.dataset.direction;
        self.localStorage.saveLanguageDirection(btn.dataset.direction);
        self.translationEngine.setLanguageDirection(btn.dataset.direction);
        self._updateDirectionUI(btn.dataset.direction);
      });
    });

    // Get material
    document.getElementById('practiceGetMaterialBtn').addEventListener('click', () => {
      const difficulty = document.getElementById('practiceDifficulty').value;
      const material = self.materials.getRandomMaterial(
        difficulty === 'all' ? null : difficulty,
        self.languageDirection
      );

      if (!material) {
        ErrorHandler.showError('暂无符合条件的练习素材', 'api');
        return;
      }

      self.currentMaterial = material;

      document.getElementById('practiceSourceBox').classList.remove('hidden');
      document.getElementById('practiceSourceText').textContent = material.sourceText;

      // Hide reference and scoring until submitted
      document.getElementById('practiceRefBox').classList.add('hidden');
      document.getElementById('practiceScoreBox').classList.add('hidden');
      document.getElementById('practiceSaveBtn').classList.add('hidden');
      self.lastScoreReport = null;
      self.currentAudioBlobId = null;

      // Clear previous recording
      self.audioRecorder.reset();
      document.getElementById('practiceRecognitionBox').classList.add('hidden');
      document.getElementById('practiceUserTranslation').value = '';
      document.getElementById('practiceLiveBox').classList.add('hidden');
      document.getElementById('practiceLiveInterim').textContent = '';

      self._showPracticeStatus(`已加载「${material.topicCategory}」素材 (${material.difficultyLevel})`);
    });

    // Recording — starts BOTH MediaRecorder and live SpeechRecognition concurrently
    document.getElementById('practiceRecordBtn').addEventListener('click', async () => {
      if (!self.currentMaterial) {
        ErrorHandler.showError('请先获取练习素材', 'validation');
        return;
      }
      try {
        // Start MediaRecorder
        await self.audioRecorder.startRecording();
        self._updatePracticeRecordingUI(true);

        // Start live STT concurrently
        const tgtLang = self.languageDirection === 'en-zh' ? 'zh' : 'en';
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.lang = tgtLang === 'zh' ? 'zh-CN' : 'en-US';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let interim = '';
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalText += transcript;
              } else {
                interim += transcript;
              }
            }
            if (finalText) {
              const existing = document.getElementById('practiceUserTranslation').value;
              document.getElementById('practiceUserTranslation').value = (existing + ' ' + finalText).trim();
            }
            document.getElementById('practiceLiveInterim').textContent = interim;
          };
          recognition.onerror = (e) => {
            if (e.error !== 'no-speech') {
              console.warn('Practice STT error:', e.error);
            }
          };
          recognition.start();
          self.practiceRecognition = recognition;
          document.getElementById('practiceLiveBox').classList.remove('hidden');
          document.getElementById('practiceLiveInterim').textContent = '';
        } else {
          document.getElementById('practiceLiveBox').classList.add('hidden');
        }
      } catch (e) {
        ErrorHandler.showError(e.message, 'permission');
      }
    });

    document.getElementById('practiceStopBtn').addEventListener('click', async () => {
      try {
        self._updatePracticeRecordingUI('processing');

        // Stop live STT first
        if (self.practiceRecognition) {
          self.practiceRecognition.stop();
          self.practiceRecognition = null;
        }

        // Stop MediaRecorder and save blob
        const blob = await self.audioRecorder.stopRecording();
        self._updatePracticeRecordingUI(false);
        document.getElementById('practiceLiveBox').classList.add('hidden');

        // Save audio to IndexedDB
        self.currentAudioBlobId = await self.db.saveAudioBlob(blob, self.audioRecorder.getDuration());

        // Show the recognition text area for manual editing
        document.getElementById('practiceRecognitionBox').classList.remove('hidden');
        self._showPracticeStatus('录音完成！识别结果已填充，可手动修改后提交评分');
      } catch (e) {
        ErrorHandler.handleAPIError(e, '录音');
        self._updatePracticeRecordingUI(false);
        document.getElementById('practiceLiveBox').classList.add('hidden');
        if (self.practiceRecognition) {
          self.practiceRecognition.stop();
          self.practiceRecognition = null;
        }
      }
    });

    document.getElementById('practiceClearBtn').addEventListener('click', () => {
      self.audioRecorder.reset();
      self._updatePracticeRecordingUI(false);
      document.getElementById('practiceRecognitionBox').classList.add('hidden');
      document.getElementById('practiceUserTranslation').value = '';
      document.getElementById('practiceLiveBox').classList.add('hidden');
      document.getElementById('practiceLiveInterim').textContent = '';
      self._showPracticeStatus('');
    });

    // Submit scoring
    document.getElementById('practiceSubmitBtn').addEventListener('click', () => {
      if (!self.currentMaterial) {
        ErrorHandler.showError('请先获取练习素材', 'validation');
        return;
      }

      const userTranslation = document.getElementById('practiceUserTranslation').value.trim();
      const validation = Validator.validateText(userTranslation, 1, 500);
      if (!validation.valid) {
        ErrorHandler.showError(validation.error + '。请先录制并识别您的翻译', 'validation');
        return;
      }

      const btn = document.getElementById('practiceSubmitBtn');
      LoadingIndicator.showForElement(btn);
      try {
        self.lastScoreReport = self.scoring.evaluateTranslation(
          self.currentMaterial.sourceText,
          userTranslation,
          self.currentMaterial.referenceTranslation
        );

        // Show reference
        document.getElementById('practiceRefBox').classList.remove('hidden');
        document.getElementById('practiceRefText').textContent = self.currentMaterial.referenceTranslation;

        // Show scores
        self._displayScoreReport(self.lastScoreReport);

        // Show save button
        document.getElementById('practiceSaveBtn').classList.remove('hidden');

        self._showPracticeStatus('评分完成！');
      } catch (e) {
        ErrorHandler.showError(`评分失败: ${e.message}`, 'api');
      } finally {
        LoadingIndicator.hideForElement(btn);
      }
    });

    // Save record
    document.getElementById('practiceSaveBtn').addEventListener('click', async () => {
      if (!self.lastScoreReport || !self.currentMaterial) return;

      const userTranslation = document.getElementById('practiceUserTranslation').value.trim();
      const btn = document.getElementById('practiceSaveBtn');

      try {
        LoadingIndicator.showForElement(btn);
        const audioBlobId = self.currentAudioBlobId || '';
        await self.records.saveRecord(
          self.lastScoreReport,
          self.currentMaterial.sourceText,
          userTranslation,
          audioBlobId,
          self.languageDirection
        );

        self._showPracticeStatus('学习记录已保存 ✓', 'success');
        document.getElementById('practiceSaveBtn').classList.add('hidden');

        // Refresh records tab
        await self._loadRecords();
      } catch (e) {
        ErrorHandler.showError(`保存失败: ${e.message}`, 'api');
      } finally {
        LoadingIndicator.hideForElement(btn);
      }
    });

    // AudioRecorder state changes
    this.audioRecorder.onRecordingStateChange((isRecording) => {
      if (!isRecording && document.getElementById('practiceStopBtn').style.display !== 'none') {
        // Auto-stopped
        document.getElementById('practiceStopBtn').click();
      }
    });
  }

  _displayScoreReport(report) {
    document.getElementById('practiceScoreBox').classList.remove('hidden');

    // Score cards
    document.getElementById('scoreTotal').textContent = report.totalScore.toFixed(1);
    document.getElementById('scorePron').textContent = report.pronunciationScore;
    document.getElementById('scoreFlu').textContent = report.fluencyScore;
    document.getElementById('scoreAcc').textContent = report.accuracyScore;

    // Radar chart
    this.radarChart.render({
      pronunciation: report.pronunciationScore,
      fluency: report.fluencyScore,
      accuracy: report.accuracyScore
    });

    // Detailed feedback
    document.getElementById('feedbackPron').innerHTML = `<strong>发音标准性（${report.pronunciationScore}/3）：</strong>${report.pronunciationFeedback}`;
    document.getElementById('feedbackFlu').innerHTML = `<strong>语言流畅性（${report.fluencyScore}/3）：</strong>${report.fluencyFeedback}`;
    document.getElementById('feedbackAcc').innerHTML = `<strong>翻译准确性（${report.accuracyScore}/3）：</strong>${report.accuracyFeedback}`;

    // Suggestions
    if (report.suggestions && report.suggestions.length > 0) {
      document.getElementById('practiceSuggestions').classList.remove('hidden');
      document.getElementById('suggestionsList').innerHTML = report.suggestions
        .map(s => `<li>${s}</li>`).join('');
    } else {
      document.getElementById('practiceSuggestions').classList.add('hidden');
    }

    // Scroll to scores
    document.getElementById('practiceScoreBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  _updatePracticeRecordingUI(isRecording) {
    const recordBtn = document.getElementById('practiceRecordBtn');
    const stopBtn = document.getElementById('practiceStopBtn');
    const timerEl = document.getElementById('practiceTimer');
    const statusEl = document.getElementById('practiceRecordStatus');

    if (isRecording === 'processing') {
      recordBtn.classList.add('hidden');
      stopBtn.classList.add('hidden');
      timerEl.classList.add('hidden');
      statusEl.textContent = '处理音频中...';
      return;
    }

    if (isRecording) {
      recordBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      timerEl.classList.remove('hidden');
      timerEl.classList.add('recording-active');
      statusEl.textContent = '正在录音...说出你的翻译';
      this._startTimer('practiceTimer');
    } else {
      recordBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      timerEl.classList.add('hidden');
      timerEl.classList.remove('recording-active');
      this._stopTimer('practiceTimer');
      document.getElementById('practiceTimer').textContent = '00:00';
      statusEl.textContent = '';
    }
  }

  _showPracticeStatus(msg) {
    const el = document.getElementById('practiceRecordStatus');
    if (el) el.textContent = msg;
  }

  // ==================== RECORDS TAB ====================

  _bindRecordsTab() {
    const self = this;

    document.getElementById('recordsRefreshBtn').addEventListener('click', () => self._loadRecords());
    document.getElementById('recordsExportBtn').addEventListener('click', () => self.records.downloadCSV());
    document.getElementById('recordsClearBtn').addEventListener('click', () => {
      if (confirm('确定要清除所有学习记录吗？此操作不可撤销。')) {
        self.records.clearAll().then(() => {
          self._loadRecords();
          ErrorHandler.showError('学习记录已清除', 'validation');
        });
      }
    });

    // Detail modal
    document.getElementById('detailModalClose').addEventListener('click', () => {
      document.getElementById('detailModal').classList.add('hidden');
    });
    document.getElementById('detailModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('detailModal').classList.add('hidden');
      }
    });
  }

  async _loadRecords() {
    try {
      const stats = await this.records.getStatistics();
      const records = await this.records.getAllRecords();

      // Update stats
      document.getElementById('statsTotal').textContent = stats.totalSessions;
      document.getElementById('statsAvg').textContent = stats.averageScore.toFixed(1);

      let bestScore = 0;
      if (records.length > 0) {
        bestScore = Math.max(...records.map(r => r.totalScore || 0));
      }
      document.getElementById('statsBest').textContent = bestScore.toFixed(1);

      // Update table
      const tbody = document.getElementById('recordsBody');
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-row">暂无学习记录，开始您的第一次练习吧！</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(r => {
        const time = new Date(r.timestamp).toLocaleString('zh-CN');
        const srcPreview = (r.sourceText || '').slice(0, 25) + ((r.sourceText || '').length > 25 ? '...' : '');
        const trPreview = (r.userTranslation || '').slice(0, 25) + ((r.userTranslation || '').length > 25 ? '...' : '');

        return `<tr>
          <td class="whitespace-nowrap" style="font-size:0.75rem;color:#94a3b8;">${time}</td>
          <td>${Validator.sanitizeInput(srcPreview)}</td>
          <td>${Validator.sanitizeInput(trPreview)}</td>
          <td class="text-center"><span style="color:#60a5fa;font-weight:600;">${r.pronunciationScore}</span></td>
          <td class="text-center"><span style="color:#34d399;font-weight:600;">${r.fluencyScore}</span></td>
          <td class="text-center"><span style="color:#fbbf24;font-weight:600;">${r.accuracyScore}</span></td>
          <td class="text-center"><span style="color:#a5b4fc;font-weight:700;">${(r.totalScore || 0).toFixed(1)}</span></td>
          <td class="text-center">
            <button class="detail-btn" data-id="${r.id}" style="color:#818cf8;background:none;border:none;cursor:pointer;font-size:0.75rem;font-weight:500;">查看</button>
            <button class="delete-btn" data-id="${r.id}" style="color:#f87171;background:none;border:none;cursor:pointer;font-size:0.75rem;font-weight:500;">删除</button>
          </td>
        </tr>`;
      }).join('');

      // Bind detail/delete buttons
      const self = this;
      tbody.querySelectorAll('.detail-btn').forEach(btn => {
        btn.addEventListener('click', () => self._showRecordDetail(btn.dataset.id));
      });
      tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm('确定要删除这条记录吗？')) {
            await self.records.deleteRecord(btn.dataset.id);
            await self._loadRecords();
          }
        });
      });
    } catch (e) {
      ErrorHandler.showError(`加载学习记录失败: ${e.message}`, 'api');
    }
  }

  async _showRecordDetail(id) {
    try {
      const record = await this.records.getRecordById(id);
      if (!record) {
        ErrorHandler.showError('未找到记录', 'validation');
        return;
      }

      const time = new Date(record.timestamp).toLocaleString('zh-CN');
      const s = (t) => Validator.sanitizeInput(t || '');
      document.getElementById('detailContent').innerHTML = `
        <div><strong>时间：</strong>${time}</div>
        <div><strong>语言方向：</strong>${record.languageDirection === 'en-zh' ? '英→中' : '中→英'}</div>
        <div><strong>原文：</strong><p style="margin-top:0.25rem;padding:0.5rem;border-radius:8px;background:rgba(148,163,184,0.1);color:#e2e8f0;">${s(record.sourceText)}</p></div>
        <div><strong>你的翻译：</strong><p style="margin-top:0.25rem;padding:0.5rem;border-radius:8px;background:rgba(148,163,184,0.1);color:#e2e8f0;">${s(record.userTranslation)}</p></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
          <div style="text-align:center;padding:0.5rem;border-radius:8px;background:rgba(59,130,246,0.12);"><p style="font-weight:700;color:#60a5fa;">${record.pronunciationScore}/3</p><p style="font-size:0.7rem;color:#94a3b8;">发音</p></div>
          <div style="text-align:center;padding:0.5rem;border-radius:8px;background:rgba(16,185,129,0.12);"><p style="font-weight:700;color:#34d399;">${record.fluencyScore}/3</p><p style="font-size:0.7rem;color:#94a3b8;">流畅</p></div>
          <div style="text-align:center;padding:0.5rem;border-radius:8px;background:rgba(245,158,11,0.12);"><p style="font-weight:700;color:#fbbf24;">${record.accuracyScore}/3</p><p style="font-size:0.7rem;color:#94a3b8;">准确</p></div>
        </div>
        <div><strong>总分：</strong><span style="font-weight:700;color:#a5b4fc;">${(record.totalScore || 0).toFixed(1)} / 3</span></div>
        <div style="display:flex;flex-direction:column;gap:0.25rem;margin-top:0.5rem;">
          <p style="font-size:0.875rem;"><strong>发音反馈：</strong>${record.pronunciationFeedback || '无'}</p>
          <p style="font-size:0.875rem;"><strong>流畅性反馈：</strong>${record.fluencyFeedback || '无'}</p>
          <p style="font-size:0.875rem;"><strong>准确性反馈：</strong>${record.accuracyFeedback || '无'}</p>
        </div>
        ${record.suggestions && record.suggestions.length > 0 ? `
        <div style="margin-top:0.5rem;">
          <strong>改进建议：</strong>
          <ul style="list-style:disc;padding-left:1.25rem;font-size:0.875rem;color:#cbd5e1;margin-top:0.25rem;">
            ${record.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>` : ''}
      `;

      document.getElementById('detailModal').classList.remove('hidden');
    } catch (e) {
      ErrorHandler.showError(`查看详情失败: ${e.message}`, 'api');
    }
  }

  // ==================== SHARED CONTROLS ====================

  _bindSharedControls() {
    const self = this;

    // API settings
    document.getElementById('apiSettingsToggle').addEventListener('click', () => {
      document.getElementById('apiKeyOpenAI').value = self.apiKeys.openai || '';
      document.getElementById('apiKeyDeepL').value = self.apiKeys.deepl || '';
      document.getElementById('apiSettingsModal').classList.remove('hidden');
    });

    document.getElementById('apiModalClose').addEventListener('click', () => {
      document.getElementById('apiSettingsModal').classList.add('hidden');
    });
    document.getElementById('apiSettingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('apiSettingsModal').classList.add('hidden');
      }
    });

    document.getElementById('apiSaveBtn').addEventListener('click', () => {
      const keys = {
        openai: document.getElementById('apiKeyOpenAI').value.trim() || null,
        deepl: document.getElementById('apiKeyDeepL').value.trim() || null
      };
      self.localStorage.saveApiKeys(keys);
      self.apiKeys = keys;

      // Re-initialize services with new keys
      self.stt = createSTTProvider(keys);
      self.translation = createTranslationProvider(keys);
      self.tts = createTTSProvider(keys);
      self.translationEngine = new TranslationEngine(self.translation, self.tts);
      self.translationEngine.setLanguageDirection(self.languageDirection);

      document.getElementById('apiSettingsModal').classList.add('hidden');
      const parts = [];
      if (keys.openai) parts.push('OpenAI');
      if (keys.deepl) parts.push('DeepL');
      const msg = parts.length > 0 ? `API 设置已保存，已启用: ${parts.join('、')}` : 'API 设置已保存（使用免费默认服务）';
      ErrorHandler.showError(msg, 'validation');
    });
  }

  // ==================== HELPERS ====================

  _updateDirectionUI(direction) {
    // Update both demo and practice direction buttons
    ['demoDirection', 'practiceDirection'].forEach(parentId => {
      const parent = document.getElementById(parentId);
      if (!parent) return;
      parent.querySelectorAll('.pill').forEach(btn => {
        const isActive = btn.dataset.direction === direction;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });

    // Update demo placeholder
    const textEl = document.getElementById('demoSourceText');
    if (textEl) {
      textEl.placeholder = direction === 'en-zh' ? '请输入要翻译的英文文本...' : '请输入要翻译的中文文本...';
    }
  }

  _startTimer(timerId) {
    const el = document.getElementById(timerId);
    if (!el) return;
    const startTime = Date.now();
    this[`_${timerId}Interval`] = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      el.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }, 200);
  }

  _stopTimer(timerId) {
    const key = `_${timerId}Interval`;
    if (this[key]) {
      clearInterval(this[key]);
      this[key] = null;
    }
  }
}

// ==================== STARTUP ====================

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(e => {
    console.error('Fatal initialization error:', e);
    document.body.innerHTML = `<div class="flex items-center justify-center min-h-screen">
      <div style="background:linear-gradient(180deg,rgba(30,41,59,0.85) 0%,rgba(30,41,59,0.7) 100%);backdrop-filter:blur(24px);border:1px solid rgba(148,163,184,0.35);border-radius:16px;padding:2rem;text-align:center;max-width:28rem;color:#e2e8f0;box-shadow:0 16px 48px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05);">
        <p style="font-size:3rem;margin-bottom:1rem;">⚠️</p>
        <h2 style="font-size:1.25rem;font-weight:700;color:#f87171;margin-bottom:0.5rem;">初始化失败</h2>
        <p style="color:#cbd5e1;">请确保通过 HTTP 服务器访问此页面（不能使用 file:// 协议）</p>
        <p style="font-size:0.875rem;color:#94a3b8;margin-top:0.5rem;">使用命令: python -m http.server 8000</p>
      </div>
    </div>`;
  });
});
