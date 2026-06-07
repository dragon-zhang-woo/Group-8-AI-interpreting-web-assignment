const RUBRIC_SUMMARY = `
You are enhancing a Chinese-English language transcoding training report.
Keep the same JSON shape as the local report.
The report must include diagnosis, breakdown, referenceTranslation, mantras, scores, feedbackSource, and aiNotice.
Do not remove locally detected rule violations.
Feedback must follow this teaching logic: diagnosis, thinking contrast, reference translation, transferable mantra.
`;

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

export class AIFeedbackService {
  constructor(settings = {}) {
    this.settings = settings;
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
    const timeout = setTimeout(() => controller.abort(), 18000);

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

      return {
        ...localReport,
        ...enhanced,
        diagnosis: {
          ...localReport.diagnosis,
          ...enhanced.diagnosis,
          triggeredRuleIds: [
            ...new Set([
              ...(localReport.diagnosis?.triggeredRuleIds || []),
              ...(enhanced.diagnosis?.triggeredRuleIds || [])
            ])
          ]
        },
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
