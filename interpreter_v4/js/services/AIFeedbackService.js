const RUBRIC_SUMMARY = `
You are enhancing a Chinese-English language transcoding training report.
Keep the same JSON shape as the local report.
The report must include diagnosis, breakdown, referenceTranslation, mantras, scores, feedbackSource, and aiNotice.
Do not remove locally detected rule violations.
Feedback must follow this teaching logic: diagnosis, thinking contrast, reference translation, transferable mantra.
`;

const FALLBACK_RUBRIC = {
  role: "中英转换训练专家",
  modes: ["默认模式：直接给出译文与训练反馈", "备选模式：按方向、难度、模块逐题训练"],
  modules: ["形合 vs 意合", "话题-评论 vs 主谓结构", "句法整合", "词性/语态/主语转换", "冗余/逻辑/文化", "文化负载词实战"],
  requiredScans: ["动词并列堆砌", "按中文语序直译", "缺少逻辑连词", "话题-主语未转换", "范畴词/冗余未删除", "文化意象直译", "被动/主动语态不当"],
  feedbackTemplate: ["诊断", "拆解：中文思维 / 目标语要求 / 本句应用", "参考译文", "迁移口诀"]
};

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");
  return JSON.parse(match[0]);
}

function isValidReport(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.diagnosis &&
      Array.isArray(value.breakdown) &&
      value.referenceTranslation !== undefined &&
      Array.isArray(value.mantras) &&
      value.scores
  );
}

function mergeByRuleId(localItems = [], enhancedItems = []) {
  const merged = [...localItems];
  const seen = new Set(localItems.map((item) => item.ruleId || item.id || item.displayRuleName || item.ruleName));

  enhancedItems.forEach((item) => {
    const key = item.ruleId || item.id || item.displayRuleName || item.ruleName;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

function mergeStrings(localItems = [], enhancedItems = []) {
  return [...new Set([...(localItems || []), ...(enhancedItems || [])].filter(Boolean))];
}

export class AIFeedbackService {
  constructor(settings = {}, rubric = FALLBACK_RUBRIC) {
    this.settings = settings;
    this.rubric = rubric || FALLBACK_RUBRIC;
  }

  setRubric(rubric) {
    this.rubric = rubric || FALLBACK_RUBRIC;
  }

  get enabled() {
    return Boolean(
      this.settings.aiEnabled &&
        this.settings.aiEndpoint &&
        this.settings.aiModel &&
        this.settings.aiApiKey
    );
  }

  async enhance(localReport, context) {
    if (!this.enabled) return localReport;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.aiTimeoutMs || 18000);

    try {
      const response = await fetch(this.settings.aiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.settings.aiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.settings.aiModel,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: RUBRIC_SUMMARY },
            {
              role: "user",
              content: JSON.stringify({
                task: "Enhance this deterministic training report without changing its schema.",
                rubric: this.rubric || FALLBACK_RUBRIC,
                context,
                localReport
              })
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`AI feedback request failed (${response.status})`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI response was empty.");

      const enhanced = extractJson(content);
      if (!isValidReport(enhanced)) throw new Error("AI response JSON did not match the expected report shape.");

      const triggeredRuleIds = mergeStrings(localReport.diagnosis?.triggeredRuleIds, enhanced.diagnosis?.triggeredRuleIds);
      const triggeredRuleNames = mergeStrings(localReport.diagnosis?.triggeredRuleNames, enhanced.diagnosis?.triggeredRuleNames);
      const breakdown = mergeByRuleId(localReport.breakdown, enhanced.breakdown);
      const mantras = mergeStrings(localReport.mantras, enhanced.mantras);

      return {
        ...localReport,
        ...enhanced,
        diagnosis: {
          ...localReport.diagnosis,
          ...enhanced.diagnosis,
          count: Math.max(localReport.diagnosis?.count || 0, enhanced.diagnosis?.count || 0, triggeredRuleIds.length, breakdown.length),
          triggeredRuleIds,
          triggeredRuleNames
        },
        breakdown,
        mantras,
        feedbackSource: "ai",
        aiNotice: "AI 已基于本地诊断补充更自然的讲解。"
      };
    } catch (error) {
      console.warn("AI feedback enhancement failed:", error);
      return {
        ...localReport,
        feedbackSource: "local-fallback",
        aiNotice: `AI 增强未完成，已保留本地诊断：${error.message}`
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
