import assert from "node:assert/strict";
import fs from "node:fs";
import { TranscodingFeedbackEngine } from "../js/components/TranscodingFeedbackEngine.js";
import { parseExpertRequestIntent } from "../js/components/ExpertConversation.js";
import { AIFeedbackService } from "../js/services/AIFeedbackService.js";
import { MaterialLibrary } from "../js/components/MaterialLibrary.js";

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

const originalFetch = globalThis.fetch;
const localViolationReport = report({
  sourceText: "你不来，我不走。",
  userTranslation: "I will not leave, you do not come.",
  referenceTranslation: "I will not leave if you do not come.",
  direction: "zh-en"
});
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              diagnosis: { count: 0, triggeredRuleIds: [], triggeredRuleNames: [], summary: "AI summary" },
              breakdown: [],
              referenceTranslation: "I will not leave if you do not come.",
              mantras: [],
              scores: { pronunciation: 3, fluency: 3, accuracy: 3, total: 3 },
              feedbackSource: "ai",
              aiNotice: ""
            })
          }
        }
      ]
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
const mergedAiReport = await new AIFeedbackService({
  aiEnabled: true,
  aiEndpoint: "http://127.0.0.1:8080/v1/chat/completions",
  aiModel: "test-model",
  aiApiKey: "test-key"
}).enhance(localViolationReport, {});
globalThis.fetch = originalFetch;
assert.ok(mergedAiReport.diagnosis.triggeredRuleIds.includes("missing-logical-connector"));
assert.ok(mergedAiReport.breakdown.some((item) => item.ruleId === "missing-logical-connector"));
assert.ok(mergedAiReport.diagnosis.count >= localViolationReport.diagnosis.count);

const fallbackReport = await new AIFeedbackService({
  aiEnabled: true,
  aiEndpoint: "http://127.0.0.1:9/v1/chat/completions",
  aiModel: "invalid-model",
  aiApiKey: "test-key",
  aiTimeoutMs: 500
}).enhance(cleanReport, {});
assert.equal(fallbackReport.feedbackSource, "local-fallback");
assert.ok(fallbackReport.aiNotice.includes("AI 增强未完成"));

const expertIntent = parseExpertRequestIntent("我想练中→英，文化负载词，综合难度", [
  { id: "cultural-imagery-literalism", name: "文化意象直译" }
]);
assert.equal(expertIntent.isPracticeRequest, true);
assert.equal(expertIntent.direction, "zh-en");
assert.equal(expertIntent.module, "culture-loaded");
assert.equal(expertIntent.difficulty, "hard");

const materials = JSON.parse(fs.readFileSync(new URL("../data/materials.json", import.meta.url), "utf8"));
assert.ok(materials.length >= 120, `Expected at least 120 materials, got ${materials.length}`);

const countBy = (field) =>
  materials.reduce((acc, material) => {
    acc[material[field]] = (acc[material[field]] || 0) + 1;
    return acc;
  }, {});
const byDirection = countBy("direction");
assert.ok(byDirection["zh-en"] >= 55, `Expected substantial zh-en coverage, got ${byDirection["zh-en"] || 0}`);
assert.ok(byDirection["en-zh"] >= 55, `Expected substantial en-zh coverage, got ${byDirection["en-zh"] || 0}`);

const byDifficulty = countBy("difficultyLevel");
["easy", "medium", "hard"].forEach((difficulty) => {
  assert.ok(byDifficulty[difficulty] >= 30, `Expected ${difficulty} coverage, got ${byDifficulty[difficulty] || 0}`);
});

const byModule = countBy("focusModule");
["hypotaxis-parataxis", "topic-subject", "syntax-integration", "static-dynamic", "logic-redundancy", "culture-loaded"].forEach((moduleId) => {
  assert.ok(byModule[moduleId] >= 15, `Expected module coverage for ${moduleId}, got ${byModule[moduleId] || 0}`);
});

const ruleCounts = materials.reduce((acc, material) => {
  (material.focusRules || []).forEach((ruleId) => {
    acc[ruleId] = (acc[ruleId] || 0) + 1;
  });
  return acc;
}, {});
[
  "verb-piling",
  "chinese-order-literalism",
  "missing-logical-connector",
  "topic-subject-mismatch",
  "redundancy-category-word",
  "cultural-imagery-literalism",
  "passive-active-mismatch"
].forEach((ruleId) => {
  assert.ok(ruleCounts[ruleId] >= 15, `Expected rule coverage for ${ruleId}, got ${ruleCounts[ruleId] || 0}`);
});

const fakeStorage = {
  getRecentMaterialIds: () => [],
  saveRecentMaterialIds: () => {}
};
const materialLibrary = new MaterialLibrary(fakeStorage);
materialLibrary.materials = [
  {
    id: "one-rule",
    direction: "zh-en",
    difficultyLevel: "medium",
    focusModule: "syntax-integration",
    focusRules: ["verb-piling"],
    sourceText: "A",
    referenceTranslation: "B"
  },
  {
    id: "two-rules",
    direction: "zh-en",
    difficultyLevel: "medium",
    focusModule: "syntax-integration",
    focusRules: ["verb-piling", "chinese-order-literalism"],
    sourceText: "C",
    referenceTranslation: "D"
  },
  {
    id: "other-rule",
    direction: "zh-en",
    difficultyLevel: "medium",
    focusModule: "syntax-integration",
    focusRules: ["missing-logical-connector"],
    sourceText: "E",
    referenceTranslation: "F"
  }
];
const selectedMaterial = materialLibrary.getRandom({
  direction: "zh-en",
  difficulty: "medium",
  focusModule: "syntax-integration",
  focusRules: ["verb-piling", "chinese-order-literalism"]
});
assert.equal(selectedMaterial.id, "two-rules");

const noImmediateRepeat = materialLibrary.getRandom({
  direction: "zh-en",
  difficulty: "medium",
  focusModule: "syntax-integration",
  focusRules: ["verb-piling"],
  excludeId: "one-rule"
});
assert.notEqual(noImmediateRepeat.id, "one-rule");

const narrowLibrary = new MaterialLibrary(fakeStorage);
narrowLibrary.materials = [
  {
    id: "current-only-exact",
    direction: "zh-en",
    difficultyLevel: "hard",
    focusModule: "syntax-integration",
    focusRules: ["verb-piling", "chinese-order-literalism"],
    sourceText: "A",
    referenceTranslation: "B"
  },
  {
    id: "same-module-alternative",
    direction: "zh-en",
    difficultyLevel: "hard",
    focusModule: "syntax-integration",
    focusRules: ["verb-piling"],
    sourceText: "C",
    referenceTranslation: "D"
  },
  {
    id: "other-module",
    direction: "zh-en",
    difficultyLevel: "hard",
    focusModule: "culture-loaded",
    focusRules: ["cultural-imagery-literalism"],
    sourceText: "E",
    referenceTranslation: "F"
  }
];
const relaxedMaterial = narrowLibrary.getRandom({
  direction: "zh-en",
  difficulty: "hard",
  focusModule: "syntax-integration",
  focusRules: ["verb-piling", "chinese-order-literalism"],
  excludeId: "current-only-exact"
});
assert.equal(relaxedMaterial.id, "same-module-alternative");

console.log("feedback-engine tests passed");
