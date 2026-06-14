export class RecordManager {
  constructor(db) {
    this.db = db;
  }

  async savePractice({ material, sourceText, transcript, userTranslation, referenceTranslation, report, audioBlobId, modeSource = "workspace", selectedTrainingRules = [], selectedTrainingRuleNames = [] }) {
    return this.db.saveRecord({
      materialId: material?.id || "",
      sourceText,
      transcript: transcript || "",
      userTranslation,
      referenceTranslation,
      scores: report.scores,
      triggeredRules: report.diagnosis.triggeredRuleIds,
      triggeredRuleNames: report.diagnosis.triggeredRuleNames,
      selectedTrainingRules,
      selectedTrainingRuleNames,
      feedbackSource: report.feedbackSource,
      modeSource,
      focusModule: material?.focusModule || "direct",
      difficultyLevel: material?.difficultyLevel || "custom",
      direction: report.direction,
      report,
      audioBlobId: audioBlobId || "",
      timestamp: Date.now()
    });
  }

  async getAll() {
    return this.db.getAllRecords();
  }

  async getStatistics() {
    return this.db.getStatistics();
  }

  async delete(id) {
    return this.db.deleteRecord(id);
  }

  async clear() {
    return this.db.clearRecords();
  }

  toCSV(records) {
    const headers = [
      "时间",
      "方向",
      "模块",
      "难度",
      "原文",
      "用户译文",
      "参考译文",
      "总分",
      "发音",
      "流畅",
      "准确",
      "触发规则",
      "训练选择规则",
      "训练入口",
      "反馈来源"
    ];
    const rows = records.map((record) => [
      new Date(record.timestamp).toLocaleString("zh-CN"),
      record.direction,
      record.focusModule,
      record.difficultyLevel,
      record.sourceText,
      record.userTranslation,
      record.referenceTranslation,
      record.scores?.total ?? "",
      record.scores?.pronunciation ?? "",
      record.scores?.fluency ?? "",
      record.scores?.accuracy ?? "",
      (record.triggeredRuleNames || []).join(" / "),
      (record.selectedTrainingRuleNames || record.selectedTrainingRules || []).join(" / "),
      record.modeSource || "workspace",
      record.feedbackSource
    ]);

    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return "\uFEFF" + [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  }

  downloadCSV(records) {
    const blob = new Blob([this.toCSV(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interpreter_v4_records_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
