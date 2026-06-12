import { LocalStorageManager } from "./storage/LocalStorageManager.js?v=20260612-draw-fix2";
import { IndexedDBManager } from "./storage/IndexedDBManager.js?v=20260612-draw-fix2";
import { TranslationService } from "./services/TranslationService.js?v=20260612-draw-fix2";
import { AIFeedbackService } from "./services/AIFeedbackService.js?v=20260612-draw-fix2";
import { AudioRecorder, SpeechRecognitionService, SpeechSynthesisService } from "./services/SpeechService.js?v=20260612-draw-fix2";
import { TranscodingFeedbackEngine, ERROR_DEFINITIONS, detectDirection } from "./components/TranscodingFeedbackEngine.js?v=20260612-draw-fix2";
import { looksLikePracticeRequest, parseExpertRequestIntent } from "./components/ExpertConversation.js?v=20260612-draw-fix2";
import { MaterialLibrary } from "./components/MaterialLibrary.js?v=20260612-draw-fix2";
import { RecordManager } from "./components/RecordManager.js?v=20260612-draw-fix2";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const directionLabel = {
  auto: "自动检测",
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

function textToParagraphs(value = "") {
  return String(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function normalizeRuleList(value) {
  const items = Array.isArray(value) ? value : value && value !== "all" ? [value] : [];
  return [...new Set(items.filter((item) => item && item !== "all"))];
}

function ruleName(ruleId) {
  return ERROR_DEFINITIONS[ruleId]?.name || ruleId;
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
    this.rubric = null;
    this.currentMaterial = null;
    this.currentReport = null;
    this.currentReportMode = "workspace";
    this.currentAudioBlobId = "";
    this.expertMaterial = null;
    this.expertReport = null;
    this.recordsCache = [];
    this.deskView = "grid";
    this.recordModuleFilter = "all";
    this.recordRuleFilter = "all";
    this.selectedRules = [];
    this.selectedExpertRules = [];
  }

  async init() {
    this.applyTheme();
    this.bindGlobalEvents();

    try {
      await Promise.all([this.loadRules(), this.loadRubric(), this.materials.load(), this.db.init()]);
      this.aiFeedback.setRubric(this.rubric);
      this.records = new RecordManager(this.db);
      this.populateControls();
      this.bindWorkspaceEvents();
      this.bindExpertEvents();
      this.renderRuleTree();
      this.renderRuleMap();
      await this.refreshRecords();
      this.renderDesk();
      this.renderExpertWelcome();
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

  async loadRubric() {
    try {
      const response = await fetch("data/interpret-rubric.json");
      if (!response.ok) throw new Error("rubric request failed");
      this.rubric = await response.json();
    } catch (error) {
      console.warn("Rubric loading failed; using AI service fallback rubric.", error);
      this.rubric = null;
    }
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
    $("#recordModuleFilter").addEventListener("change", () => {
      this.recordModuleFilter = $("#recordModuleFilter").value;
      if (this.recordModuleFilter !== "all" && $("#moduleSelect").value !== this.recordModuleFilter) {
        $("#moduleSelect").value = this.recordModuleFilter;
        this.syncCustomSelect("moduleSelect");
      }
      this.renderRecords();
      this.syncCustomSelect("recordModuleFilter");
    });
    $("#recordRuleFilter").addEventListener("change", () => {
      this.recordRuleFilter = $("#recordRuleFilter").value;
      if (this.recordRuleFilter !== "all" && !this.selectedRules.includes(this.recordRuleFilter)) {
        this.setSelectedRules([this.recordRuleFilter], { render: true, syncRecords: false });
      }
      this.renderRecords();
      this.syncCustomSelect("recordRuleFilter");
    });
    $("#resetRecordFiltersBtn").addEventListener("click", () => this.syncRecordFilters("all", []));
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

    ["directionSelect", "difficultySelect", "moduleSelect", "sourceText", "referenceText", "userTranslation"].forEach((id) => {
      $(`#${id}`).addEventListener("input", () => this.saveDraft());
      $(`#${id}`).addEventListener("change", () => {
        this.saveDraft();
        this.syncCustomSelect(id);
        if (id === "moduleSelect") {
          this.syncRecordFilters($("#moduleSelect").value, this.selectedRules, { silent: true });
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
    $("#recordModuleFilter").innerHTML = moduleSelect.innerHTML;
    $("#recordRuleFilter").innerHTML = ruleSelect.innerHTML;
    $("#expertModule").innerHTML = moduleSelect.innerHTML;
    $("#expertRule").innerHTML = ruleSelect.innerHTML;
    this.hydrateCustomSelects();
    this.renderRuleSelectionSummary();
    this.renderExpertRulePicker();
  }

  hydrateCustomSelects() {
    $$("select:not([data-native-only])").forEach((select) => {
      let shell = select.closest(".select-shell");
      if (!shell) {
        shell = document.createElement("div");
        shell.className = "select-shell";
        select.parentNode.insertBefore(shell, select);
        shell.appendChild(select);
        select.classList.add("native-select");
        const button = document.createElement("button");
        button.className = "select-trigger";
        button.type = "button";
        button.setAttribute("aria-haspopup", "listbox");
        const menu = document.createElement("div");
        menu.className = "select-menu";
        menu.setAttribute("role", "listbox");
        shell.append(button, menu);
        button.addEventListener("click", () => {
          const isOpen = shell.classList.contains("open");
          this.closeCustomSelects();
          shell.classList.toggle("open", !isOpen);
          button.setAttribute("aria-expanded", String(!isOpen));
        });
        select.addEventListener("change", () => this.syncCustomSelect(select.id));
      }
      this.syncCustomSelect(select.id);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".select-shell")) this.closeCustomSelects();
    });
  }

  syncCustomSelect(id) {
    const select = $(`#${id}`);
    const shell = select?.closest(".select-shell");
    if (!select || !shell) return;
    const trigger = shell.querySelector(".select-trigger");
    const menu = shell.querySelector(".select-menu");
    const selected = select.selectedOptions[0] || select.options[0];
    trigger.innerHTML = `<span>${escapeHtml(selected?.textContent || "请选择")}</span><span class="select-caret">⌄</span>`;
    trigger.setAttribute("aria-expanded", String(shell.classList.contains("open")));
    menu.innerHTML = [...select.options]
      .map(
        (option) => `<button class="select-option ${option.selected ? "selected" : ""}" type="button" role="option" aria-selected="${option.selected}" data-select-value="${escapeHtml(option.value)}">
          <span>${escapeHtml(option.textContent)}</span>
          <span class="select-check" aria-hidden="true">✓</span>
        </button>`
      )
      .join("");
    menu.querySelectorAll(".select-option").forEach((button) => {
      button.addEventListener("click", () => {
        select.value = button.dataset.selectValue;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        this.closeCustomSelects();
      });
    });
  }

  refreshCustomSelects() {
    $$("select").forEach((select) => this.syncCustomSelect(select.id));
  }

  closeCustomSelects() {
    $$(".select-shell.open").forEach((shell) => {
      shell.classList.remove("open");
      shell.querySelector(".select-trigger")?.setAttribute("aria-expanded", "false");
    });
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

  renderExpertWelcome() {
    if ($("#expertMessages").children.length > 0) return;
    this.appendExpertMessage(
      "system",
      "专家对话支持两种用法：直接发送一句中文或英文原文，获得参考译文和转换关注点；也可以说“我想练中→英、文化负载词、综合难度”，系统会按条件出题。"
    );
  }

  appendExpertMessage(role, content, { html = false } = {}) {
    const message = document.createElement("article");
    message.className = `message ${role}`;
    message.innerHTML = html ? content : textToParagraphs(content);
    $("#expertMessages").appendChild(message);
    $("#expertMessages").scrollTop = $("#expertMessages").scrollHeight;
  }

  clearExpertConversation() {
    $("#expertMessages").innerHTML = "";
    $("#expertInput").value = "";
    $("#expertSourceText").value = "";
    $("#expertUserTranslation").value = "";
    $("#expertReferenceText").value = "";
    this.expertMaterial = null;
    this.expertReport = null;
    $("#expertSaveRecordBtn").disabled = true;
    this.renderExpertWelcome();
    this.saveDraft();
  }

  selectedExpertMaterialDirection() {
    const selected = $("#expertDirection").value;
    return selected === "auto" ? "all" : selected;
  }

  inferExpertPreferences(text) {
    const intent = parseExpertRequestIntent(text, this.rules.errorTypes);
    if (intent.direction) $("#expertDirection").value = intent.direction;
    if (intent.difficulty) $("#expertDifficulty").value = intent.difficulty;
    if (intent.module) $("#expertModule").value = intent.module;
    if (intent.rule) this.setSelectedExpertRules([intent.rule]);
    this.refreshCustomSelects();
    return intent;
  }

  pickExpertMaterial() {
    const material = this.materials.getRandom({
      direction: this.selectedExpertMaterialDirection(),
      difficulty: $("#expertDifficulty").value,
      focusModule: $("#expertModule").value,
      focusRules: this.selectedExpertRules,
      excludeId: this.expertMaterial?.id || ""
    });
    if (!material) {
      this.toast("暂无符合条件的专家练习素材。", "error");
      return;
    }

    this.expertMaterial = material;
    this.expertReport = null;
    $("#expertSourceText").value = material.sourceText;
    $("#expertReferenceText").value = material.referenceTranslation;
    $("#expertUserTranslation").value = "";
    $("#expertSaveRecordBtn").disabled = true;

    const module = this.moduleTitle(material.focusModule);
    const rules = (material.focusRules || []).map((id) => ERROR_DEFINITIONS[id]?.name || id).join("、") || "综合转换";
    this.appendExpertMessage(
      "assistant",
      `<p><strong>练习题</strong></p>
       <p>${escapeHtml(material.sourceText)}</p>
       <p class="status-line">${escapeHtml(directionLabel[material.direction])} / ${escapeHtml(difficultyLabel[material.difficultyLevel])} / ${escapeHtml(module)} / ${escapeHtml(rules)}</p>
       <p>请在右侧“你的译文”输入答案，然后点击“诊断译文”。</p>`,
      { html: true }
    );
    this.saveDraft();
  }

  async handleExpertSend() {
    const text = $("#expertInput").value.trim();
    if (!text) {
      this.toast("请先输入要发送给专家的内容。", "error");
      return;
    }

    this.appendExpertMessage("user", text);
    $("#expertInput").value = "";
    const intent = this.inferExpertPreferences(text);

    if (intent.isPracticeRequest || looksLikePracticeRequest(text)) {
      this.pickExpertMaterial();
      return;
    }

    if (this.expertMaterial && !$("#expertUserTranslation").value.trim()) {
      $("#expertUserTranslation").value = text;
      await this.diagnoseExpertPractice();
      return;
    }

    $("#expertSourceText").value = text;
    $("#expertUserTranslation").value = "";
    $("#expertReferenceText").value = "";
    this.expertMaterial = null;
    await this.diagnoseExpertPractice({ sourceOnly: true });
  }

  async diagnoseExpertPractice({ sourceOnly = false } = {}) {
    const sourceText = $("#expertSourceText").value.trim();
    const userTranslation = sourceOnly ? "" : $("#expertUserTranslation").value.trim();
    if (!sourceText) {
      this.toast("请先输入或抽取原文。", "error");
      return;
    }

    const selectedDirection = $("#expertDirection").value;
    const activeDirection = selectedDirection === "auto" || selectedDirection === "all" ? detectDirection(sourceText) : selectedDirection;
    $("#expertDiagnoseBtn").disabled = true;

    try {
      const referenceTranslation = await this.ensureExpertReferenceTranslation(sourceText, activeDirection);
      const localReport = this.feedbackEngine.analyze({
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: activeDirection,
        mode: this.expertMaterial ? "guided" : userTranslation ? "default" : "source-only"
      });
      const report = await this.aiFeedback.enhance(localReport, {
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: activeDirection,
        material: this.expertMaterial,
        surface: "expert"
      });
      this.expertReport = report;
      $("#expertSaveRecordBtn").disabled = false;
      this.appendExpertMessage("assistant", this.renderExpertReport(report), { html: true });
      this.toast(report.feedbackSource === "ai" ? "专家 AI 增强反馈已生成。" : "专家本地规则反馈已生成。", "success");
      this.saveDraft();
    } catch (error) {
      this.toast(`专家诊断失败：${error.message}`, "error");
      this.appendExpertMessage("assistant", `诊断失败：${error.message}`);
    } finally {
      $("#expertDiagnoseBtn").disabled = false;
    }
  }

  async ensureExpertReferenceTranslation(sourceText, activeDirection) {
    const currentReference = $("#expertReferenceText").value.trim();
    if (currentReference) return currentReference;

    const result = await this.translation.translate(sourceText, activeDirection);
    $("#expertReferenceText").value = result.translatedText;
    this.toast(`专家模式已生成参考译文：${result.provider}`, "success");
    return result.translatedText;
  }

  renderExpertReport(report) {
    const triggered = report.diagnosis.triggeredRuleNames?.join("、") || "无明显触发";
    const breakdown = report.breakdown
      .map(
        (item) => `<li><strong>${escapeHtml(item.displayRuleName || item.ruleName)}</strong>：${escapeHtml(item.application)}</li>`
      )
      .join("");
    const mantras = report.mantras.map((mantra) => `<li>${escapeHtml(mantra)}</li>`).join("");
    return `<p><strong>诊断</strong>：${escapeHtml(report.diagnosis.summary)}</p>
      <p class="status-line">触发规则：${escapeHtml(triggered)}；总分 ${escapeHtml(report.scores.total)}</p>
      ${breakdown ? `<p><strong>拆解</strong></p><ul>${breakdown}</ul>` : ""}
      <p><strong>参考译文</strong>：${escapeHtml(report.referenceTranslation)}</p>
      <p><strong>迁移口诀</strong></p><ul>${mantras}</ul>`;
  }

  renderRuleTree() {
    const activeModule = $("#moduleSelect").value;
    const activeRules = this.selectedRules;
    const summary =
      activeRules.length === 0
        ? "未限定规则，将按方向、难度和模块综合抽题。"
        : activeRules.length === 1
          ? `专项训练：${ruleName(activeRules[0])}`
          : `综合训练：已选择 ${activeRules.length} 条规则`;
    $("#ruleTree").innerHTML = `
      <div class="rule-tree-tools">
        <button class="small-btn" type="button" id="clearRuleSelectionBtn">清空规则</button>
        <span>${escapeHtml(summary)}</span>
      </div>
      ${this.rules.modules
      .map((module) => {
        const moduleActive = activeModule === module.id;
        const selectedCount = module.errorTypes.filter((ruleId) => activeRules.includes(ruleId)).length;
        return `<section class="tree-module ${moduleActive || selectedCount ? "active" : ""}">
          <button class="tree-module-head" type="button" data-module-id="${module.id}" aria-expanded="${moduleActive || selectedCount ? "true" : "false"}">
            <span>
              <strong>${escapeHtml(module.title)}</strong>
              <small>${escapeHtml(module.summary)}</small>
            </span>
            <em>${selectedCount ? `${selectedCount}/${module.errorTypes.length}` : `${module.errorTypes.length} 条`}</em>
          </button>
          <div class="tree-module-actions">
            <button class="tree-mini-btn" type="button" data-select-module-rules="${module.id}">全选本组</button>
            <button class="tree-mini-btn" type="button" data-clear-module-rules="${module.id}">清空本组</button>
          </div>
          <div class="tree-rules">
          ${module.errorTypes
            .map((ruleId) => {
              const rule = this.rules.errorTypes.find((item) => item.id === ruleId);
              const checked = activeRules.includes(ruleId);
              return `<label class="tree-rule ${checked ? "active" : ""}">
                <input type="checkbox" data-rule-id="${ruleId}" data-parent-module="${module.id}" ${checked ? "checked" : ""}>
                <span class="tree-check" aria-hidden="true">✓</span>
                <span>
                  <strong>${escapeHtml(rule?.name || ruleId)}</strong>
                  <small>${escapeHtml(rule?.defaultFix || "")}</small>
                </span>
              </label>`;
            })
            .join("")}
          </div>
        </section>`;
      })
      .join("")}`;

    $("#clearRuleSelectionBtn").addEventListener("click", () => this.setSelectedRules([], { render: true }));
    $$(".tree-module-head").forEach((button) => {
      button.addEventListener("click", () => {
        this.applyPracticeFilters(button.dataset.moduleId, this.selectedRules);
        this.saveDraft();
      });
    });
    $$("[data-select-module-rules]").forEach((button) => {
      button.addEventListener("click", () => {
        const module = this.rules.modules.find((item) => item.id === button.dataset.selectModuleRules);
        this.applyPracticeFilters(module?.id || "all", module?.errorTypes || []);
      });
    });
    $$("[data-clear-module-rules]").forEach((button) => {
      button.addEventListener("click", () => {
        const module = this.rules.modules.find((item) => item.id === button.dataset.clearModuleRules);
        const nextRules = this.selectedRules.filter((ruleId) => !module?.errorTypes.includes(ruleId));
        this.applyPracticeFilters(module?.id || "all", nextRules);
      });
    });
    $$(".tree-rule input").forEach((input) => {
      input.addEventListener("change", () => {
        const ruleId = input.dataset.ruleId;
        const nextRules = input.checked ? [...this.selectedRules, ruleId] : this.selectedRules.filter((item) => item !== ruleId);
        this.applyPracticeFilters(input.dataset.parentModule, nextRules);
        this.saveDraft();
      });
    });
  }

  bindExpertEvents() {
    $("#expertSendBtn").addEventListener("click", () => this.handleExpertSend());
    $("#expertDiagnoseBtn").addEventListener("click", () => this.diagnoseExpertPractice());
    $("#expertNewPromptBtn").addEventListener("click", () => this.pickExpertMaterial());
    $("#expertClearBtn").addEventListener("click", () => this.clearExpertConversation());
    $("#expertSaveRecordBtn").addEventListener("click", () => this.saveExpertRecord());

    ["expertDirection", "expertDifficulty", "expertModule", "expertSourceText", "expertUserTranslation", "expertReferenceText"].forEach((id) => {
      $(`#${id}`).addEventListener("input", () => this.saveDraft());
      $(`#${id}`).addEventListener("change", () => {
        this.saveDraft();
        this.syncCustomSelect(id);
      });
    });
  }

  renderRuleMap() {
    const activeModule = $("#moduleSelect").value;
    const activeRules = this.selectedRules;
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
        const isActive =
          node.type === "module"
            ? node.id === activeModule
            : node.type === "rule"
              ? activeRules.includes(node.ruleId)
              : false;
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
        this.applyPracticeFilters(button.dataset.mapModule, this.selectedRules);
      });
    });
    $$("[data-map-rule]").forEach((button) => {
      button.addEventListener("click", () => {
        const ruleId = button.dataset.mapRule;
        const nextRules = this.selectedRules.includes(ruleId)
          ? this.selectedRules.filter((item) => item !== ruleId)
          : [...this.selectedRules, ruleId];
        this.applyPracticeFilters(button.dataset.mapParent, nextRules);
      });
    });
  }

  setSelectedRules(rules = [], { render = false, syncRecords = true, save = true } = {}) {
    this.selectedRules = normalizeRuleList(rules);
    $("#ruleSelect").value = this.selectedRules[0] || "all";
    this.renderRuleSelectionSummary();
    if (syncRecords) this.syncRecordFilters($("#moduleSelect").value, this.selectedRules, { silent: true });
    if (render) {
      this.renderRuleTree();
      this.renderRuleMap();
    }
    if (save) this.saveDraft();
  }

  setSelectedExpertRules(rules = [], { save = true } = {}) {
    this.selectedExpertRules = normalizeRuleList(rules);
    $("#expertRule").value = this.selectedExpertRules[0] || "all";
    this.renderExpertRulePicker();
    if (save) this.saveDraft();
  }

  renderRuleSelectionSummary() {
    const target = $("#selectedRuleSummary");
    if (!target) return;
    if (this.selectedRules.length === 0) {
      target.innerHTML = `<span>全部规则</span><small>未限定规则</small>`;
      return;
    }
    const mode = this.selectedRules.length === 1 ? "专项训练" : "综合训练";
    target.innerHTML = `<span>${escapeHtml(mode)}</span><small>${escapeHtml(this.selectedRules.map(ruleName).join("、"))}</small>`;
  }

  renderExpertRulePicker() {
    const target = $("#expertRulePicker");
    if (!target) return;
    target.innerHTML = `
      <div class="rule-picker-head">
        <span>${this.selectedExpertRules.length ? `已选 ${this.selectedExpertRules.length} 条规则` : "全部规则"}</span>
        <button class="tree-mini-btn" type="button" id="clearExpertRulesBtn">清空</button>
      </div>
      <div class="rule-picker-grid">
        ${this.rules.errorTypes
          .map((rule) => {
            const checked = this.selectedExpertRules.includes(rule.id);
            return `<label class="compact-check ${checked ? "active" : ""}">
              <input type="checkbox" data-expert-rule-id="${rule.id}" ${checked ? "checked" : ""}>
              <span aria-hidden="true">✓</span>
              <strong>${escapeHtml(rule.name)}</strong>
            </label>`;
          })
          .join("")}
      </div>`;
    $("#clearExpertRulesBtn")?.addEventListener("click", () => this.setSelectedExpertRules([]));
    $$("[data-expert-rule-id]").forEach((input) => {
      input.addEventListener("change", () => {
        const ruleId = input.dataset.expertRuleId;
        const nextRules = input.checked
          ? [...this.selectedExpertRules, ruleId]
          : this.selectedExpertRules.filter((item) => item !== ruleId);
        this.setSelectedExpertRules(nextRules);
      });
    });
  }

  applyPracticeFilters(moduleId = "all", rules = []) {
    $("#moduleSelect").value = moduleId;
    this.syncCustomSelect("moduleSelect");
    this.setSelectedRules(rules, { syncRecords: false });
    this.syncRecordFilters(moduleId, this.selectedRules);
    this.renderRuleTree();
    this.renderRuleMap();
    this.saveDraft();
  }

  syncRecordFilters(moduleId = "all", rules = [], { silent = false } = {}) {
    this.recordModuleFilter = moduleId || "all";
    const ruleList = normalizeRuleList(rules);
    this.recordRuleFilter = ruleList.length === 1 ? ruleList[0] : "all";
    if ($("#recordModuleFilter")) $("#recordModuleFilter").value = this.recordModuleFilter;
    if ($("#recordRuleFilter")) $("#recordRuleFilter").value = this.recordRuleFilter;
    this.syncCustomSelect("recordModuleFilter");
    this.syncCustomSelect("recordRuleFilter");
    if (!silent) this.renderRecords();
  }

  resolveDirection(sourceText = "", selectedDirection = $("#directionSelect").value) {
    return selectedDirection === "auto" ? detectDirection(sourceText) : selectedDirection;
  }

  selectedMaterialDirection() {
    const selected = $("#directionSelect").value;
    return selected === "auto" ? "all" : selected;
  }

  pickMaterial() {
    const material = this.materials.getRandom({
      direction: this.selectedMaterialDirection(),
      difficulty: $("#difficultySelect").value,
      focusModule: $("#moduleSelect").value,
      focusRules: this.selectedRules,
      excludeId: this.currentMaterial?.id || ""
    });
    if (!material) {
      this.toast("暂无符合条件的素材。", "error");
      return;
    }
    this.loadMaterial(material, { syncFilters: false });
  }

  loadMaterial(material, { syncFilters = true } = {}) {
    if (!material) return;
    this.currentMaterial = material;
    if (syncFilters) {
      $("#directionSelect").value = material.direction;
      $("#difficultySelect").value = material.difficultyLevel;
      $("#moduleSelect").value = material.focusModule || "all";
      this.setSelectedRules(material.focusRules || [], { syncRecords: false });
      this.refreshCustomSelects();
    }
    $("#sourceText").value = material.sourceText;
    $("#referenceText").value = material.referenceTranslation;
    $("#userTranslation").value = "";
    this.currentReport = null;
    this.currentAudioBlobId = "";
    $("#saveRecordBtn").disabled = true;
    this.renderRuleTree();
    this.renderRuleMap();
    if (syncFilters) this.syncRecordFilters($("#moduleSelect").value, this.selectedRules);
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
    const activeDirection = this.resolveDirection(sourceText);
    const button = $("#translateSourceBtn");
    button.disabled = true;
    try {
      const result = await this.translation.translate(sourceText, activeDirection);
      $("#referenceText").value = result.translatedText;
      this.toast(`机器翻译完成：${result.provider} / ${directionLabel[activeDirection]}`, "success");
      this.saveDraft();
    } catch (error) {
      this.toast(`机器翻译失败：${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  }

  async ensureReferenceTranslation(sourceText, activeDirection) {
    const currentReference = $("#referenceText").value.trim();
    if (currentReference) return currentReference;

    const result = await this.translation.translate(sourceText, activeDirection);
    $("#referenceText").value = result.translatedText;
    this.toast(`已生成参考译文：${result.provider}`, "success");
    this.saveDraft();
    return result.translatedText;
  }

  async analyzeCurrentPractice() {
    const sourceText = $("#sourceText").value.trim();
    const userTranslation = $("#userTranslation").value.trim();
    if (!sourceText) {
      this.toast("请先填写原文。", "error");
      return;
    }
    const activeDirection = this.resolveDirection(sourceText);

    const button = $("#analyzeBtn");
    button.disabled = true;
    this.renderFeedbackEmpty(userTranslation ? "正在诊断..." : "正在生成默认训练反馈...");
    try {
      const referenceTranslation = await this.ensureReferenceTranslation(sourceText, activeDirection);
      const localReport = this.feedbackEngine.analyze({
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: activeDirection,
        mode: this.currentMaterial ? "guided" : userTranslation ? "default" : "source-only"
      });
      const report = await this.aiFeedback.enhance(localReport, {
        sourceText,
        userTranslation,
        referenceTranslation,
        direction: activeDirection,
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
      ${report.breakdown.map((item) => this.renderBreakdown(item)).join("")}
      <section class="reference-card">
        <h3>参考译文</h3>
        <p>${escapeHtml(report.referenceTranslation)}</p>
      </section>
      <section class="reference-card">
        <h3>迁移口诀</h3>
        ${report.mantras.map((mantra) => `<p>${escapeHtml(mantra)}</p>`).join("")}
      </section>
      <section class="score-row">
        ${this.scoreCard("总分", report.scores.total)}
        ${this.scoreCard("发音", report.scores.pronunciation)}
        ${this.scoreCard("流畅", report.scores.fluency)}
        ${this.scoreCard("准确", report.scores.accuracy)}
      </section>
    `;
  }

  scoreCard(label, value) {
    return `<div class="score-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
  }

  renderBreakdown(item) {
    const title = item.displayRuleName || item.diagnosticLabel || item.ruleName;
    const parentRule =
      item.diagnosticLabel && item.ruleName && item.diagnosticLabel !== item.ruleName
        ? `<span class="tag">${escapeHtml(item.ruleName)}</span>`
        : "";
    return `<article class="breakdown-item">
      <div class="breakdown-title">
        <h3>${escapeHtml(title)}</h3>
        ${parentRule}
      </div>
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
        audioBlobId: this.currentAudioBlobId,
        modeSource: "workspace",
        selectedTrainingRules: this.selectedRules,
        selectedTrainingRuleNames: this.selectedRules.map(ruleName)
      });
      $("#saveRecordBtn").disabled = true;
      await this.refreshRecords();
      this.toast("本次训练已保存。", "success");
    } catch (error) {
      this.toast(`保存失败：${error.message}`, "error");
    }
  }

  async saveExpertRecord() {
    if (!this.expertReport || !this.records) return;
    try {
      await this.records.savePractice({
        material: this.expertMaterial,
        sourceText: $("#expertSourceText").value.trim(),
        transcript: $("#expertUserTranslation").value.trim(),
        userTranslation: $("#expertUserTranslation").value.trim(),
        referenceTranslation: $("#expertReferenceText").value.trim(),
        report: this.expertReport,
        audioBlobId: "",
        modeSource: "expert",
        selectedTrainingRules: this.selectedExpertRules,
        selectedTrainingRuleNames: this.selectedExpertRules.map(ruleName)
      });
      $("#expertSaveRecordBtn").disabled = true;
      await this.refreshRecords();
      this.toast("专家对话训练已保存。", "success");
    } catch (error) {
      this.toast(`保存失败：${error.message}`, "error");
    }
  }

  async startRecording() {
    try {
      await this.audioRecorder.start();
      const activeDirection = this.resolveDirection($("#sourceText").value.trim());
      this.speechRecognition.start({
        direction: activeDirection,
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
    const language = this.resolveDirection($("#sourceText").value.trim()) === "zh-en" ? "en" : "zh";
    try {
      await this.speechSynthesis.speak(text, language);
    } catch (error) {
      this.toast(error.message, "error");
    }
  }

  async refreshRecords() {
    if (!this.records) return;
    this.recordsCache = await this.records.getAll();
    this.renderRecords();
  }

  renderRecords() {
    const records = this.getFilteredRecords();
    const stats = this.computeRecordStats(records);
    this.renderStats(stats);
    this.renderTrend(stats.trend);
    this.renderRuleFrequency(stats.ruleCounts);
    this.renderRecordFilterSummary(records.length);
    this.renderRecordsTable(records);
  }

  getFilteredRecords() {
    return this.recordsCache.filter((record) => {
      const moduleOk = this.recordModuleFilter === "all" || record.focusModule === this.recordModuleFilter;
      const recordRules = [...(record.triggeredRules || []), ...(record.selectedTrainingRules || [])];
      const ruleOk = this.recordRuleFilter === "all" || recordRules.includes(this.recordRuleFilter);
      return moduleOk && ruleOk;
    });
  }

  computeRecordStats(records) {
    if (!records.length) {
      return {
        totalSessions: 0,
        averageScore: 0,
        averageAccuracy: 0,
        averageFluency: 0,
        averagePronunciation: 0,
        ruleCounts: {},
        trend: []
      };
    }

    const sums = records.reduce(
      (acc, record) => {
        acc.total += record.scores?.total || 0;
        acc.accuracy += record.scores?.accuracy || 0;
        acc.fluency += record.scores?.fluency || 0;
        acc.pronunciation += record.scores?.pronunciation || 0;
        (record.triggeredRuleNames || []).forEach((ruleName) => {
          acc.ruleCounts[ruleName] = (acc.ruleCounts[ruleName] || 0) + 1;
        });
        const day = new Date(record.timestamp).toISOString().slice(0, 10);
        acc.trendMap[day] ||= { total: 0, count: 0 };
        acc.trendMap[day].total += record.scores?.total || 0;
        acc.trendMap[day].count += 1;
        return acc;
      },
      { total: 0, accuracy: 0, fluency: 0, pronunciation: 0, ruleCounts: {}, trendMap: {} }
    );

    const round = (value) => Number(value.toFixed(1));
    return {
      totalSessions: records.length,
      averageScore: round(sums.total / records.length),
      averageAccuracy: round(sums.accuracy / records.length),
      averageFluency: round(sums.fluency / records.length),
      averagePronunciation: round(sums.pronunciation / records.length),
      ruleCounts: sums.ruleCounts,
      trend: Object.entries(sums.trendMap)
        .map(([date, data]) => ({ date, score: round(data.total / data.count), count: data.count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
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

  renderTrend(trend) {
    $("#trendCount").textContent = `${trend.reduce((sum, item) => sum + item.count, 0)} 次`;
    if (!trend.length) {
      $("#scoreTrend").innerHTML = `<div class="mini-empty">暂无趋势</div>`;
      return;
    }
    const maxScore = 3;
    $("#scoreTrend").innerHTML = trend
      .map((item) => {
        const height = Math.max(8, Math.round((item.score / maxScore) * 100));
        return `<div class="trend-bar" title="${escapeHtml(item.date)}：${item.score}">
          <span style="height:${height}%"></span>
          <strong>${item.score}</strong>
          <em>${escapeHtml(item.date.slice(5))}</em>
        </div>`;
      })
      .join("");
  }

  renderRuleFrequency(ruleCounts) {
    const entries = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
    $("#ruleCountSummary").textContent = `${entries.length} 类`;
    if (!entries.length) {
      $("#ruleFrequency").innerHTML = `<div class="mini-empty">暂无触发</div>`;
      return;
    }
    const max = Math.max(...entries.map(([, count]) => count), 1);
    $("#ruleFrequency").innerHTML = entries
      .map(([ruleName, count]) => {
        const width = Math.max(8, Math.round((count / max) * 100));
        return `<div class="frequency-row">
          <span>${escapeHtml(ruleName)}</span>
          <div><i style="width:${width}%"></i></div>
          <strong>${count}</strong>
        </div>`;
      })
      .join("");
  }

  renderRecordFilterSummary(count) {
    const moduleText = this.recordModuleFilter === "all" ? "全部模块" : this.moduleTitle(this.recordModuleFilter);
    const ruleText = this.recordRuleFilter === "all" ? "全部规则" : ERROR_DEFINITIONS[this.recordRuleFilter]?.name || this.recordRuleFilter;
    $("#recordFilterSummary").textContent = `${moduleText} / ${ruleText} / ${count} 条`;
  }

  renderRecordsTable(records) {
    if (records.length === 0) {
      $("#recordsTable").innerHTML = `<tr><td colspan="7">暂无学习记录。</td></tr>`;
      return;
    }
    $("#recordsTable").innerHTML = records
      .map((record) => {
        const rules = (record.triggeredRuleNames || []).slice(0, 3).map((rule) => `<span class="tag">${escapeHtml(rule)}</span>`).join("");
        return `<tr>
          <td>${new Date(record.timestamp).toLocaleString("zh-CN")}</td>
          <td>${directionLabel[record.direction] || record.direction}</td>
          <td>${escapeHtml(this.moduleTitle(record.focusModule))}</td>
          <td>${record.modeSource === "expert" ? "专家对话" : "工作区"}</td>
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
    const selectedRules = record.selectedTrainingRuleNames?.length
      ? record.selectedTrainingRuleNames.join("、")
      : record.selectedTrainingRules?.length
        ? record.selectedTrainingRules.map(ruleName).join("、")
        : "未限定规则";
    $("#recordDetail").innerHTML = `<div class="record-detail">
      <section class="record-detail-section">
        <div class="card-meta">
          <span class="tag teal">${directionLabel[record.direction] || record.direction}</span>
          <span class="tag amber">总分 ${record.scores?.total ?? ""}</span>
          <span class="tag">${record.modeSource === "expert" ? "专家对话" : "工作区"}</span>
          <span class="tag blue">${escapeHtml(record.feedbackSource)}</span>
        </div>
        <h3>原文</h3>
        <p>${escapeHtml(record.sourceText)}</p>
        <h3>用户译文</h3>
        <p>${escapeHtml(record.userTranslation || "未提交译文（默认模式）")}</p>
        <h3>参考译文</h3>
        <p>${escapeHtml(record.referenceTranslation)}</p>
        <h3>训练选择规则</h3>
        <p>${escapeHtml(selectedRules)}</p>
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
    const records = this.getFilteredRecords();
    if (!records.length) {
      this.toast("暂无可导出的记录。", "error");
      return;
    }
    this.records.downloadCSV(records);
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
    this.aiFeedback = new AIFeedbackService(this.settings, this.rubric);
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
      rule: this.selectedRules[0] || "all",
      rules: this.selectedRules,
      sourceText: $("#sourceText")?.value,
      referenceText: $("#referenceText")?.value,
      userTranslation: $("#userTranslation")?.value,
      expertDirection: $("#expertDirection")?.value,
      expertDifficulty: $("#expertDifficulty")?.value,
      expertModule: $("#expertModule")?.value,
      expertRule: this.selectedExpertRules[0] || "all",
      expertRules: this.selectedExpertRules,
      expertSourceText: $("#expertSourceText")?.value,
      expertReferenceText: $("#expertReferenceText")?.value,
      expertUserTranslation: $("#expertUserTranslation")?.value
    });
  }

  restoreDraft() {
    const draft = this.storage.getSessionDraft();
    if (!draft || Object.keys(draft).length === 0) return;
    if (draft.direction) $("#directionSelect").value = draft.direction;
    if (draft.difficulty) $("#difficultySelect").value = draft.difficulty;
    if (draft.module) $("#moduleSelect").value = draft.module;
    this.setSelectedRules(draft.rules || draft.rule || [], { syncRecords: false, save: false });
    $("#sourceText").value = draft.sourceText || "";
    $("#referenceText").value = draft.referenceText || "";
    $("#userTranslation").value = draft.userTranslation || "";
    if (draft.expertDirection) $("#expertDirection").value = draft.expertDirection;
    if (draft.expertDifficulty) $("#expertDifficulty").value = draft.expertDifficulty;
    if (draft.expertModule) $("#expertModule").value = draft.expertModule;
    this.setSelectedExpertRules(draft.expertRules || draft.expertRule || [], { save: false });
    $("#expertSourceText").value = draft.expertSourceText || "";
    $("#expertReferenceText").value = draft.expertReferenceText || "";
    $("#expertUserTranslation").value = draft.expertUserTranslation || "";
    this.renderRuleTree();
    this.renderRuleMap();
    this.refreshCustomSelects();
    this.syncRecordFilters($("#moduleSelect").value, this.selectedRules, { silent: true });
    if (this.settings.activeSurface) this.showSurface(this.settings.activeSurface);
  }

  moduleTitle(id) {
    if (id === "all") return "全部模块";
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
