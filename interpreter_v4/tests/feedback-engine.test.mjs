import assert from "node:assert/strict";
import { TranscodingFeedbackEngine } from "../js/components/TranscodingFeedbackEngine.js";

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

const cleanReport = report({
  sourceText: "问题已经解决了。",
  userTranslation: "The problem has been solved.",
  referenceTranslation: "The problem has been solved.",
  direction: "zh-en"
});
assert.equal(cleanReport.feedbackSource, "local");
assert.deepEqual(cleanReport.scores.total >= 0 && cleanReport.scores.total <= 3, true);

console.log("feedback-engine tests passed");
