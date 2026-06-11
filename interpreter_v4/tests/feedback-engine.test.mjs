import assert from "node:assert/strict";
import { TranscodingFeedbackEngine } from "../js/components/TranscodingFeedbackEngine.js";
import { AIFeedbackService } from "../js/services/AIFeedbackService.js";

const engine = new TranscodingFeedbackEngine();

function report(input) {
  return engine.analyze({
    referenceTranslation: "reference",
    ...input
  });
}

function assertTriggered(input, ruleId) {
  const result = report(input);
  assert.ok(
    result.diagnosis.triggeredRuleIds.includes(ruleId),
    `Expected ${ruleId} to be triggered, got ${result.diagnosis.triggeredRuleIds.join(", ")}`
  );
  return result;
}

assertTriggered(
  {
    sourceText: "这家公司去年亏损严重，裁掉了30%的员工，现在正在寻找新的投资者。",
    userTranslation: "This company lost a lot of money last year, cut 30% of its staff, now is looking for new investors.",
    direction: "zh-en"
  },
  "verb-piling"
);

assertTriggered(
  {
    sourceText: "你不来，我不走。",
    userTranslation: "I will not leave, you do not come.",
    direction: "zh-en"
  },
  "missing-logical-connector"
);

assertTriggered(
  {
    sourceText: "那所房子你们早该修了。",
    userTranslation: "That house you should have repaired long ago.",
    direction: "zh-en"
  },
  "topic-subject-mismatch"
);

assertTriggered(
  {
    sourceText: "我们要加强环境保护的工作。",
    userTranslation: "We should strengthen the work of environmental protection.",
    direction: "zh-en"
  },
  "redundancy-category-word"
);

assertTriggered(
  {
    sourceText: "你这样说就是对牛弹琴。",
    userTranslation: "What you said is playing the lute to a cow.",
    direction: "zh-en"
  },
  "cultural-imagery-literalism"
);

const passiveReport = assertTriggered(
  {
    sourceText: "Many of the buildings destroyed in the earthquake were constructed without proper safety standards.",
    userTranslation: "许多在地震中被摧毁的建筑是被建造在没有适当安全标准下的。",
    direction: "en-zh"
  },
  "passive-active-mismatch"
);

assert.ok(
  passiveReport.diagnosis.triggeredRuleIds.includes("chinese-order-literalism"),
  "Expected over-literal Chinese order to be detected for the passive EN-ZH example."
);

const sourceOnlyZh = report({
  sourceText: "你不来，我不走。",
  userTranslation: "",
  referenceTranslation: "I will not leave if you do not come."
});
assert.equal(sourceOnlyZh.direction, "zh-en");
assert.ok(sourceOnlyZh.diagnosis.triggeredRuleIds.includes("missing-logical-connector"));
assert.equal(sourceOnlyZh.mode, "default");

const sourceOnlyEn = report({
  sourceText: "The proposal put forward by a researcher who joined the team only three months ago has attracted wide attention.",
  userTranslation: "",
  referenceTranslation: "一名研究员提出了这项议案。他三个月前才加入团队，这项议案已经引起广泛关注。"
});
assert.equal(sourceOnlyEn.direction, "en-zh");
assert.ok(sourceOnlyEn.breakdown.some((item) => item.diagnosticLabel === "的的不休"));

const deRunReport = assertTriggered(
  {
    sourceText: "The proposal put forward by a researcher who joined the team only three months ago has attracted wide attention.",
    userTranslation: "一位三个月前才加入团队的研究员提出的已经被广泛关注的议案。",
    direction: "en-zh"
  },
  "chinese-order-literalism"
);
assert.ok(deRunReport.breakdown.some((item) => item.diagnosticLabel === "的的不休"));

const cleanReport = report({
  sourceText: "问题已经解决了。",
  userTranslation: "The problem has been solved.",
  referenceTranslation: "The problem has been solved.",
  direction: "zh-en"
});
assert.equal(cleanReport.feedbackSource, "local");
assert.deepEqual(cleanReport.scores.total >= 0 && cleanReport.scores.total <= 3, true);

const noKeyReport = await new AIFeedbackService({}).enhance(cleanReport, {});
assert.equal(noKeyReport.feedbackSource, "local");

const fallbackReport = await new AIFeedbackService({
  aiEnabled: true,
  aiEndpoint: "http://127.0.0.1:9/v1/chat/completions",
  aiModel: "invalid-model",
  aiApiKey: "test-key",
  aiTimeoutMs: 500
}).enhance(cleanReport, {});
assert.equal(fallbackReport.feedbackSource, "local-fallback");
assert.ok(fallbackReport.aiNotice.includes("AI 增强未完成"));

console.log("feedback-engine tests passed");
