const MODULE_KEYWORD_MAP = [
  ["culture-loaded", /文化|成语|俗语|负载|意象|东风|石头|对牛|画蛇|拖泥/],
  ["hypotaxis-parataxis", /形合|意合|逻辑|连词|条件|因果|让步|转折/],
  ["topic-subject", /话题|评论|主语|主谓|无主句/],
  ["syntax-integration", /句法|长句|拆句|整合|动词|并列|的的不休/],
  ["static-dynamic", /词性|语态|被动|主动|物称|人称|名词|介词/],
  ["logic-redundancy", /冗余|范畴词|废话|工作|问题|情况/]
];

export function looksLikePracticeRequest(text = "") {
  return /练|出题|题目|模块|难度|方向|中→英|英→中|汉译英|英译中|文化负载词|规则/.test(text);
}

export function parseExpertRequestIntent(text = "", rules = []) {
  const normalized = text.toLowerCase();
  const result = {};

  if (/中\s*(->|→|到|-)\s*英|汉译英|中文.*英文|中英/.test(text)) result.direction = "zh-en";
  else if (/英\s*(->|→|到|-)\s*中|英译中|英文.*中文/.test(text)) result.direction = "en-zh";
  else if (/混合|随机|都可以/.test(text)) result.direction = "all";

  if (/基础|简单|easy/.test(normalized)) result.difficulty = "easy";
  else if (/进阶|中等|medium/.test(normalized)) result.difficulty = "medium";
  else if (/综合|困难|高阶|hard/.test(normalized)) result.difficulty = "hard";

  const moduleMatch = MODULE_KEYWORD_MAP.find(([, pattern]) => pattern.test(text));
  if (moduleMatch) result.module = moduleMatch[0];

  const ruleMatch = rules.find((rule) => text.includes(rule.name) || text.includes(rule.id));
  if (ruleMatch) result.rule = ruleMatch.id;

  result.isPracticeRequest = looksLikePracticeRequest(text);
  return result;
}
