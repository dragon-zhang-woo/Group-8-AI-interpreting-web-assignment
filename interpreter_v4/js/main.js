import { LocalStorageManager } from "./storage/LocalStorageManager.js";
import { IndexedDBManager } from "./storage/IndexedDBManager.js";
import { TranslationService } from "./services/TranslationService.js";
import { AIFeedbackService } from "./services/AIFeedbackService.js";
import { AudioRecorder, SpeechRecognitionService, SpeechSynthesisService } from "./services/SpeechService.js";
import { TranscodingFeedbackEngine, ERROR_DEFINITIONS } from "./components/TranscodingFeedbackEngine.js";
import { MaterialLibrary } from "./components/MaterialLibrary.js";
import { RecordManager } from "./components/RecordManager.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const directionLabel = {
  "zh-en": "中 → 英",
  "en-zh": "英 → 中"
};

const difficultyLabel = {
  easy: "基础",
  medium: "进阶",
  hard: "综合",
  all: "全部",
  custom: "自定义"
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(value = "", length = 120) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

class InterpreterV4App {
  constructor() {
    this.storage = new LocalStorageManager();
    this.settings = this.storage.getSettings();
    this.db = new IndexedDBManager();
    this.records = null;
    this.materials = new MaterialLibrary(this.storage);
    this.feedbackEngine = new TranscodingFeedbackEngine();
    this.translation = new TranslationService(this.settings);
    this.aiFeedback = new AIFeedbackService(this.settings);
    this.speechRecognition = new SpeechRecognitionService();
    this.speechSynthesis = new SpeechSynthesisService();
    this.audioRecorder = new AudioRecorder();
    this.rules = { modules: [], errorTypes: [] };
    this.currentMaterial = null;
    this.currentReport = null;
    this.currentAudioBlobId = "";
    this.recordsCache = [];
    this.deskView = "grid";
  }

  async init() {
    this.applyTheme();
    this.bindGlobalEvents();

    try {
      await Promise.all([this.loadRules(), this.materials.load(), this.db.init()]);
      this.records = new RecordManager(this.db);
      this.populateControls();
      this.bindWorkspaceEvents();
      this.renderRuleTree();
      this.renderRuleMap();
      await this.refreshRecords();
      this.renderDesk();
      this.restoreDraft();
      this.toast("Interpreter V4 已就绪。", "success");
    } catch (error) {
      console.error(error);
      this.toast(error.message || "初始化失败。", "error");
    }
  }

  async loadRules() {
    const response = await fetch("data/transcoding-rules.json");
    if (!response.ok) throw new Error("规则库加载失败。");
    this.rules = await response.json();
  }

  bindGlobalEvents() {
    $$(".surface-tab").forEach((button) => {
      button.addEventListener("click", () => this.showSurface(button.dataset.surface));
    });

    $("#settingsBtn").addEventListener("click", () => this.openSettings());
    $("#closeSettingsBtn").addEventListener("click", () => this.closeSettings());
    $("#settingsModal").addEventListener("click", (event) => {
      if (event.target.id === "settingsModal") this.closeSettings();
    });
    $("#saveSettingsBtn").addEventListener("click", () => this.saveSettings());

    $("#closeRecordBtn").addEventListener("click", () => this.closeRecordModal());
    $("#recordModal").addEventListener("click", (event) => {
      if (event.target.id === "recordModal") this.closeRecordModal();
    });

    $("#deskSearch").addEventListener("input", () => this.renderDesk());
    $("#deskSort").addEventListener("change", () => this.renderDesk());
    $$(".segment[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        this.deskView = button.dataset.view;
        $$(".segment[data-view]").forEach((item) => item.classList.toggle("active", item === button));
        $("#deskCards").classList.toggle("list", this.deskView === "list");
      });
    });
    $("#quickStartBtn").addEventListener("click", () => {
      this.showSurface("workspace");
      this.pickMaterial();
    });
    $("#backToDeskBtn").addEventListener("click", () => this.showSurface("desk"));
  }

  bindWorkspaceEvents() {
    $$(".segment[data-workspace-view]").forEach((button) => {
      button.addEventListener("click", () => this.showWorkspaceView(button.dataset.workspaceView));
    });

    $("#newMaterialBtn").addEventListener("click", () => this.pickMaterial());
    $("#translateSourceBtn").addEventListener("click", () => this.translateSource());
    $("#analyzeBtn").addEventListener("click", () => this.analyzeCurrentPractice());
    $("#saveRecordBtn").addEventListener("click", () => this.saveCurrentRecord());
    $("#recordBtn").addEventListener("click", () => this.startRecording());
    $("#stopRecordBtn").addEventListener("click", () => this.stopRecording());
    $("#speakReferenceBtn").addEventListener("click", () => this.speakReference());
    $("#exportCsvBtn").addEventListener("click", () => this.exportRecords());
    $("#clearRecordsBtn").addEventListener("click", () => this.clearRecords());

    ["directionSelect", "difficultySelect", "moduleSelect", "ruleSelect", "sourceText", "referenceText", "userTranslation"].forEach((id) => {
      $(`#${id}`).addEventListener("input", () => this.saveDraft());
      $(`#${id}`).addEventListener("change", () => {
        this.saveDraft();
        if (id === "moduleSelect" || id === "ruleSelect") {
          this.renderRuleTree();
          this.renderRuleMap();
        }
      });
    });
  }

  showSurface(surface) {
    $$(".surface-tab").forEach((button) => button.classList.toggle("active", button.dataset.surface === surface));
    $$(".surface").forEach((panel) => panel.classList.toggle("active", panel.id === `surface-${surface}`));
    this.settings.activeSurface = surface;
    this.storage.saveSettings(this.settings);
    if (surface === "records") this.refreshRecords();
  }

  showWorkspaceView(view) {
    $$(".segment[data-workspace-view]").forEach((button) => button.classList.toggle("active", button.dataset.workspaceView === view));
    $("#practiceView").classList.toggle("active", view === "practice");
    $("#mapView").classList.toggle("active", view === "map");
  }

  populateControls() {
    const moduleSelect = $("#moduleSelect");
    const ruleSelect = $("#ruleSelect");
    moduleSelect.innerHTML = `<option value="all">全部模块</option>${this.rules.modules
      .map((module) => `<option value="${module.id}">${escapeHtml(module.title)}</option>`)
      .join("")}`;
    ruleSelect.innerHTML = `<option value="all">全部规则</option>${this.rules.errorTypes
      .map((rule) => `<option value="${rule.id}">${escapeHtml(rule.name)}</option>`)
      .join("")}`;
  }

  renderDesk() {
    const query = $("#deskSearch").value.trim().toLowerCase();
    const sort = $("#deskSort").value;
    let materials = this.materials.getAll();

    if (query) {
      materials = materials.filter((material) => {
        const haystack = [
          material.sourceText,
          material.referenceTranslation,
          material.focusModule,
          material.topicCategory,
          ...(material.focusRules || []).map((id) => ERROR_DEFINITIONS[id]?.name || id)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    materials.sort((a, b) => {
      if (sort === "difficulty") return a.difficultyLevel.localeCompare(b.difficultyLevel);
      if (sort === "direction") return a.direction.localeCompare(b.direction);
      return a.focusModule.localeCompare(b.focusModule);
    });

    const cards = [
      `<article class="desk-card add-card">
        <div>
          <button class="icon-btn" type="button" id="deskAddBtn" aria-label="创建新练习" title="创建新练习">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-7-7h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <h3>新练习</h3>
          <p class="card-preview">从规则树、随机素材或自定义原文开始。</p>
        </div>
      </article>`,
      ...materials.map((material) => this.renderDeskCard(material))
    ];

    const deskCards = $("#deskCards");
    deskCards.innerHTML = cards.join("");
    deskCards.classList.toggle("list", this.deskView === "list");
    $("#deskAddBtn").addEventListener("click", () => {
      this.showSurface("workspace");
      this.resetPractice();
    });
    $$(".card-action[data-material-id]").forEach((button) => {
      button.addEventListener("click", () => {
        this.loadMaterial(this.materials.getById(button.dataset.materialId));
        this.showSurface("workspace");
      });
    });
  }

  renderDeskCard(material) {
    const module = this.rules.modules.find((item) => item.id === material.focusModule);
    const rules = (material.focusRules || []).map((id) => ERROR_DEFINITIONS[id]?.name || id).slice(0, 2);
    return `<article class="desk-card">
      <div>
        <div class="card-meta">
          <span class="tag teal">${directionLabel[material.direction]}</span>
          <span class="tag amber">${difficultyLabel[material.difficultyLevel]}</span>
          <span class="tag blue">${escapeHtml(module?.title || material.focusModule)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(truncate(material.sourceText, 42))}</h3>
        <p class="card-preview">${escapeHtml(material.referenceTranslation)}</p>
      </div>
      <div>
        <div class="card-meta">${rules.map((rule) => `<span class="tag">${escapeHtml(rule)}</span>`).join("")}</div>
        <button class="card-action" type="button" data-material-id="${material.id}">打开练习</button>
      </div>
    </article>`;
  }

  renderRuleTree() {
    const activeModule = $("#moduleSelect").value;
    const activeRule = $("#ruleSelect").value;
    $("#ruleTree").innerHTML = this.rules.modules
      .map((module) => {
        const moduleActive = activeModule === module.id;
        return `<div class="tree-module ${moduleActive ? "active" : ""}">
          <button type="button" data-module-id="${module.id}">${escapeHtml(module.title)}</button>
          ${module.errorTypes
            .map((ruleId) => {
              const rule = this.rules.errorTypes.find((item) => item.id === ruleId);
              return `<button class="tree-rule ${activeRule === ruleId ? "active" : ""}" type="button" data-rule-id="${ruleId}" data-parent-module="${module.id}">${escapeHtml(rule?.name || ruleId)}</button>`;
            })
            .join("")}
        </div>`;
      })
      .join("");

    $$(".tree-module > button").forEach((button) => {
      button.addEventListener("click", () => {
        $("#moduleSelect").value = button.dataset.moduleId;
        $("#ruleSelect").value = "all";
        this.saveDraft();
        this.renderRuleTree();
        this.renderRuleMap();
      });
    });
    $$(".tree-rule").forEach((button) => {
      button.addEventListener("click", () => {
        $("#moduleSelect").value = button.dataset.parentModule;
        $("#ruleSelect").value = button.dataset.ruleId;
        this.saveDraft();
        this.renderRuleTree();
        this.renderRuleMap();
      });
    });
  }

  renderRuleMap() {
    const activeModule = $("#moduleSelect").value;
    const activeRule = $("#ruleSelect").value;
    const moduleNodes = this.rules.modules.map((module, index) => ({
      id: module.id,
      type: "module",
      title: module.title,
      x: 330,
      y: 34 + index * 96
    }));
    const ruleNodes = [];
    this.rules.modules.forEach((module, moduleIndex) => {
      module.errorTypes.forEach((ruleId, ruleIndex) => {
        const rule = this.rules.errorTypes.find((item) => item.id === ruleId);
        ruleNodes.push({
          id: `${module.id}:${ruleId}`,
          ruleId,
          parentId: module.id,
          type: "rule",
          title: rule?.name || ruleId,
          x: 650,
          y: 22 + moduleIndex * 96 + ruleIndex * 42
        });
      });
    });

    const nodes = [{ id: "root", type: "root", title: "中英转换训练", x: 70, y: 260 }, ...moduleNodes, ...ruleNodes];
    const links = [
      ...moduleNodes.map((node) => ["root", node.id]),
      ...ruleNodes.map((node) => [node.parentId, node.id])
    ];
    const findNode = (id) => nodes.find((node) => node.id === id);

    const linkMarkup = links
      .map(([fromId, toId]) => {
        const from = findNode(fromId);
        const to = findNode(toId);
        const x1 = from.x + (from.type === "root" ? 210 : 190);
        const y1 = from.y + 36;
        const x2 = to.x;
        const y2 = to.y + 36;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return `<span class="map-link" style="left:${x1}px;top:${y1}px;width:${length}px;transform:rotate(${angle}deg)"></span>`;
      })
      .join("");

    const nodeMarkup = nodes
      .map((node) => {
        const isActive = node.id === activeModule || node.ruleId === activeRule;
        const attrs =
          node.type === "module"
            ? `data-map-module="${node.id}"`
            : node.type === "rule"
              ? `data-map-rule="${node.ruleId}" data-map-parent="${node.parentId}"`
              : "";
        return `<button class="map-node ${node.type} ${isActive ? "active" : ""}" type="button" ${attrs} style="left:${node.x}px;top:${node.y}px">
          <strong>${escapeHtml(node.title)}</strong>
        </button>`;
      })
      .join("");

    $("#ruleMap").innerHTML = `<div class="map-canvas">${linkMarkup}${nodeMarkup}</div>`;
    $$("[data-map-module]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#moduleSelect").value = button.dataset.mapModule;
        $("#ruleSelect").value = "all";
        this.renderRuleTree();
        this.renderRuleMap();
      });
    });
    $$("[data-map-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        $("#moduleSelect").value = button.dataset.mapParent;
        $("#ruleSelect").value = button.dataset.mapRule;
        this.renderRuleTree();
        this.renderRuleMap();
      });
    });
  }

  pickMaterial() {
    const material = this.materials.getRandom({
      direction: $("#directionSelect").value,
      difficulty: $("#difficultySelect").value,
      focusModule: $("#moduleSelect").value,
      focusRule: $("#ruleSelect").value
    });
    if (!material) {
      this.toast("暂无符合条件的素材。", "error");
      return;
    }
    this.loadMaterial(material);
  }

  loadMaterial(material) {
    if (!material) return;
    this.currentMaterial = material;
    $("#directionSelect").value = material.direction;
    $("#difficultySelect").value = material.difficultyLevel;
    $("#moduleSelect").value = material.focusModule || "all";
    $("#ruleSelect").value = material.focusRules?.[0] || "all";
    $("#sourceText").value = material.sourceText;
    $("#referenceText").value = material.referenceTranslation;
    $("#userTranslation").value = "";
    this.currentReport = null;
    this.currentAudioBlobId = "";
    $("#saveRecordBtn").disabled = true;
    this.renderRuleTree();
    this.renderRuleMap();
    this.renderFeedbackEmpty("素材已载入。");
    this.saveDraft();
  }

  resetPractice() {
    this.currentMaterial = null;
    this.currentReport = null;
    this.currentAudioBlobId = "";
    $("#sourceText").value = "";
    $("#referenceText").value = "";
    $("#userTranslation").value = "";
    $("#saveRecordBtn").disabled = true;
    this.renderFeedbackEmpty("新练习已准备。");
    this.saveDraft();
  }

  async translateSource() {
    const sourceText = $("#sourceText").value.trim();
    if (!sourceText) {
      this.toast("请先输入原文。", "error");
      return;
    }
    const button = $("#translateSourceBtn");
    button.disabled = true;
    try {
      const result = await this.translation.translate(sourceText, $("#directionSelect").value);
      $("#referenceText").value = result.translatedText;
      this.toast(`机器翻译完成：${result.provider}`, "success");
      this.saveDraft();
    } catch (error) {
      this.toast(`机器翻译失败：${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  }

  async analyzeCurrentPractice() {
    const sourceText = $("#sourceText").value.trim();
    const userTranslation = $("#userTranslation").value.trim();
    const referenceTranslation = $("#referenceText").value.trim();
    if (!sourceText || !userTranslation) {
      this.toast("请填写原文和你的译文。", "error");
      return;
    }
    if (!referenceTranslation) {
      this.toast("请填写参考译文，或先使用机器翻译。", "error");
      return;
    }

    const button = $("#analyzeBtn");
    button.disabled = true;
    this.renderFeedbackEmpty("正在诊断...");
    try {
      const localReport = this.feedbackEngine.analyze({
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: $("#directionSelect").value,
        mode: this.currentMaterial ? "guided" : "default"
      });
      const report = await this.aiFeedback.enhance(localReport, {
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: $("#directionSelect").value,
        material: this.currentMaterial
      });
      this.currentReport = report;
      this.renderFeedback(report);
      $("#saveRecordBtn").disabled = false;
      this.toast(report.feedbackSource === "ai" ? "AI 增强反馈已生成。" : "本地规则反馈已生成。", "success");
    } catch (error) {
      this.toast(`诊断失败：${error.message}`, "error");
      this.renderFeedbackEmpty("诊断失败。");
    } finally {
      button.disabled = false;
    }
  }

  renderFeedbackEmpty(text) {
    $("#feedbackContent").className = "feedback-content empty-state";
    $("#feedbackContent").innerHTML = `<p>${escapeHtml(text)}</p>`;
  }

  renderFeedback(report) {
    $("#feedbackContent").className = "feedback-content";
    const sourceBadge = report.feedbackSource === "ai" ? "AI 增强" : report.feedbackSource === "local-fallback" ? "本地回退" : "本地规则";
    $("#feedbackContent").innerHTML = `
      <section class="diagnosis-card">
        <div class="card-meta">
          <span class="tag teal">${escapeHtml(sourceBadge)}</span>
          <span class="tag amber">${report.diagnosis.count} 条规则</span>
        </div>
        <h3>诊断</h3>
        <p>${escapeHtml(report.diagnosis.summary)}</p>
        ${report.aiNotice ? `<p class="status-line">${escapeHtml(report.aiNotice)}</p>` : ""}
      </section>
      <section class="score-row">
        ${this.scoreCard("总分", report.scores.total)}
        ${this.scoreCard("发音", report.scores.pronunciation)}
        ${this.scoreCard("流畅", report.scores.fluency)}
        ${this.scoreCard("准确", report.scores.accuracy)}
      </section>
      <section class="reference-card">
        <h3>参考译文</h3>
        <p>${escapeHtml(report.referenceTranslation)}</p>
      </section>
      ${report.breakdown.map((item) => this.renderBreakdown(item)).join("")}
      <section class="reference-card">
        <h3>迁移口诀</h3>
        ${report.mantras.map((mantra) => `<p>${escapeHtml(mantra)}</p>`).join("")}
      </section>
    `;
  }

  scoreCard(label, value) {
    return `<div class="score-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
  }

  renderBreakdown(item) {
    return `<article class="breakdown-item">
      <h3>${escapeHtml(item.ruleName)}</h3>
      <p><strong>中文思维：</strong>${escapeHtml(item.chineseThinking)}</p>
      <p><strong>目标语要求：</strong>${escapeHtml(item.requirement)}</p>
      <p><strong>本句应用：</strong>${escapeHtml(item.application)}</p>
    </article>`;
  }

  async saveCurrentRecord() {
    if (!this.currentReport || !this.records) return;
    try {
      await this.records.savePractice({
        material: this.currentMaterial,
        sourceText: $("#sourceText").value.trim(),
        transcript: $("#userTranslation").value.trim(),
        userTranslation: $("#userTranslation").value.trim(),
        referenceTranslation: $("#referenceText").value.trim(),
        report: this.currentReport,
        audioBlobId: this.currentAudioBlobId
      });
      $("#saveRecordBtn").disabled = true;
      await this.refreshRecords();
      this.toast("本次训练已保存。", "success");
    } catch (error) {
      this.toast(`保存失败：${error.message}`, "error");
    }
  }

  async startRecording() {
    try {
      await this.audioRecorder.start();
      this.speechRecognition.start({
        direction: $("#directionSelect").value,
        onInterim: (text) => {
          $("#interimLine").classList.remove("hidden");
          $("#interimLine").textContent = text;
        },
        onFinal: (text) => {
          $("#userTranslation").value = text;
          this.saveDraft();
        },
        onError: (error) => this.toast(error.message, "error")
      });
      $("#recordBtn").classList.add("hidden");
      $("#stopRecordBtn").classList.remove("hidden");
      $("#recordStatus").textContent = "录音中";
    } catch (error) {
      this.toast(error.message, "error");
    }
  }

  async stopRecording() {
    this.speechRecognition.stop();
    $("#recordBtn").classList.remove("hidden");
    $("#stopRecordBtn").classList.add("hidden");
    $("#recordStatus").textContent = "处理中";
    try {
      const { blob, durationSeconds } = await this.audioRecorder.stop();
      if (blob && this.db.db) {
        this.currentAudioBlobId = await this.db.saveAudioBlob(blob, durationSeconds);
      }
      $("#recordStatus").textContent = "录音完成";
      setTimeout(() => ($("#recordStatus").textContent = ""), 1800);
    } catch (error) {
      this.toast(`录音保存失败：${error.message}`, "error");
      $("#recordStatus").textContent = "";
    }
  }

  async speakReference() {
    const text = $("#referenceText").value.trim();
    if (!text) {
      this.toast("请先填写参考译文。", "error");
      return;
    }
    const language = $("#directionSelect").value === "zh-en" ? "en" : "zh";
    try {
      await this.speechSynthesis.speak(text, language);
    } catch (error) {
      this.toast(error.message, "error");
    }
  }

  async refreshRecords() {
    if (!this.records) return;
    this.recordsCache = await this.records.getAll();
    const stats = await this.records.getStatistics();
    this.renderStats(stats);
    this.renderRecordsTable(this.recordsCache);
  }

  renderStats(stats) {
    $("#statsGrid").innerHTML = [
      ["训练次数", stats.totalSessions],
      ["平均总分", stats.averageScore],
      ["准确", stats.averageAccuracy],
      ["流畅", stats.averageFluency],
      ["发音", stats.averagePronunciation]
    ]
      .map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
      .join("");
  }

  renderRecordsTable(records) {
    if (records.length === 0) {
      $("#recordsTable").innerHTML = `<tr><td colspan="6">暂无学习记录。</td></tr>`;
      return;
    }
    $("#recordsTable").innerHTML = records
      .map((record) => {
        const rules = (record.triggeredRuleNames || []).slice(0, 3).map((rule) => `<span class="tag">${escapeHtml(rule)}</span>`).join("");
        return `<tr>
          <td>${new Date(record.timestamp).toLocaleString("zh-CN")}</td>
          <td>${directionLabel[record.direction] || record.direction}</td>
          <td>${escapeHtml(this.moduleTitle(record.focusModule))}</td>
          <td><strong>${record.scores?.total ?? ""}</strong></td>
          <td><div class="card-meta">${rules || '<span class="tag">无明显触发</span>'}</div></td>
          <td>
            <div class="table-actions">
              <button class="small-btn" type="button" data-record-view="${record.id}">查看</button>
              <button class="small-btn" type="button" data-record-delete="${record.id}">删除</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    $$("[data-record-view]").forEach((button) => button.addEventListener("click", () => this.openRecord(button.dataset.recordView)));
    $$("[data-record-delete]").forEach((button) => button.addEventListener("click", () => this.deleteRecord(button.dataset.recordDelete)));
  }

  openRecord(id) {
    const record = this.recordsCache.find((item) => item.id === id);
    if (!record) return;
    $("#recordDetail").innerHTML = `<div class="record-detail">
      <section class="record-detail-section">
        <div class="card-meta">
          <span class="tag teal">${directionLabel[record.direction] || record.direction}</span>
          <span class="tag amber">总分 ${record.scores?.total ?? ""}</span>
          <span class="tag blue">${escapeHtml(record.feedbackSource)}</span>
        </div>
        <h3>原文</h3>
        <p>${escapeHtml(record.sourceText)}</p>
        <h3>用户译文</h3>
        <p>${escapeHtml(record.userTranslation)}</p>
        <h3>参考译文</h3>
        <p>${escapeHtml(record.referenceTranslation)}</p>
      </section>
      ${record.report?.breakdown?.map((item) => this.renderBreakdown(item)).join("") || ""}
    </div>`;
    $("#recordModal").classList.remove("hidden");
  }

  closeRecordModal() {
    $("#recordModal").classList.add("hidden");
  }

  async deleteRecord(id) {
    if (!confirm("删除这条学习记录？")) return;
    await this.records.delete(id);
    await this.refreshRecords();
    this.toast("记录已删除。", "success");
  }

  exportRecords() {
    if (!this.recordsCache.length) {
      this.toast("暂无可导出的记录。", "error");
      return;
    }
    this.records.downloadCSV(this.recordsCache);
  }

  async clearRecords() {
    if (!this.recordsCache.length) return;
    if (!confirm("清空所有学习记录？")) return;
    await this.records.clear();
    await this.refreshRecords();
    this.toast("学习记录已清空。", "success");
  }

  openSettings() {
    $("#aiEnabled").checked = Boolean(this.settings.aiEnabled);
    $("#aiEndpoint").value = this.settings.aiEndpoint || "";
    $("#aiModel").value = this.settings.aiModel || "";
    $("#aiApiKey").value = this.settings.aiApiKey || "";
    $("#deeplApiKey").value = this.settings.deeplApiKey || "";
    $("#themeSelect").value = this.settings.theme || "light";
    $("#settingsModal").classList.remove("hidden");
  }

  closeSettings() {
    $("#settingsModal").classList.add("hidden");
  }

  saveSettings() {
    this.settings = {
      ...this.settings,
      aiEnabled: $("#aiEnabled").checked,
      aiEndpoint: $("#aiEndpoint").value.trim(),
      aiModel: $("#aiModel").value.trim(),
      aiApiKey: $("#aiApiKey").value.trim(),
      deeplApiKey: $("#deeplApiKey").value.trim(),
      theme: $("#themeSelect").value
    };
    this.storage.saveSettings(this.settings);
    this.translation = new TranslationService(this.settings);
    this.aiFeedback = new AIFeedbackService(this.settings);
    this.applyTheme();
    this.closeSettings();
    this.toast("设置已保存。", "success");
  }

  applyTheme() {
    document.documentElement.dataset.theme = this.settings.theme || "light";
  }

  saveDraft() {
    this.storage.saveSessionDraft({
      direction: $("#directionSelect")?.value,
      difficulty: $("#difficultySelect")?.value,
      module: $("#moduleSelect")?.value,
      rule: $("#ruleSelect")?.value,
      sourceText: $("#sourceText")?.value,
      referenceText: $("#referenceText")?.value,
      userTranslation: $("#userTranslation")?.value
    });
  }

  restoreDraft() {
    const draft = this.storage.getSessionDraft();
    if (!draft || Object.keys(draft).length === 0) return;
    if (draft.direction) $("#directionSelect").value = draft.direction;
    if (draft.difficulty) $("#difficultySelect").value = draft.difficulty;
    if (draft.module) $("#moduleSelect").value = draft.module;
    if (draft.rule) $("#ruleSelect").value = draft.rule;
    $("#sourceText").value = draft.sourceText || "";
    $("#referenceText").value = draft.referenceText || "";
    $("#userTranslation").value = draft.userTranslation || "";
    this.renderRuleTree();
    this.renderRuleMap();
    if (this.settings.activeSurface) this.showSurface(this.settings.activeSurface);
  }

  moduleTitle(id) {
    if (id === "direct") return "直接训练";
    return this.rules.modules.find((module) => module.id === id)?.title || id || "";
  }

  toast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $("#toastStack").appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
  }
}

const app = new InterpreterV4App();
app.init();
