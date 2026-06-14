const ERROR_DEFINITIONS = {
  "verb-piling": {
    name: "动词并列堆砌",
    mantra: "一个英文句子先保一个主干，次要动作收进从句、分词或连接词。"
  },
  "chinese-order-literalism": {
    name: "按中文语序直译",
    mantra: "不要跟着中文逗号走，先找目标语主干再安排背景信息。"
  },
  "missing-logical-connector": {
    name: "缺少逻辑连词",
    mantra: "看到中文两个短句并排，先问它们是条件、因果、转折还是让步。"
  },
  "topic-subject-mismatch": {
    name: "话题-主语未转换",
    mantra: "中文话题不等于英文主语，英文必须找出动作真正的承担者。"
  },
  "redundancy-category-word": {
    name: "范畴词 / 冗余未删除",
    mantra: "遇到“工作、问题、情况、状态、趋势”，先删一遍再译。"
  },
  "cultural-imagery-literalism": {
    name: "文化意象直译",
    mantra: "成语先译功能，意象只有在目标语能懂时才保留。"
  },
  "passive-active-mismatch": {
    name: "被动 / 主动语态不当",
    mantra: "英译中多转主动，中译英遇到无施动者常用被动。"
  }
};

const CULTURE_PATTERNS = [
  {
    source: /对牛弹琴/,
    literal: /\b(cow|cattle|ox|lute|piano)\b/i,
    better: "cast pearls before swine / talk to the wrong audience"
  },
  {
    source: /画蛇添足/,
    literal: /\b(draw|paint).{0,20}\bsnake\b|\bfeet\b/i,
    better: "unnecessary and overdone"
  },
  {
    source: /摸着石头过河/,
    literal: /\b(stone|stones|river|cross).{0,30}\b(stone|river|cross)\b/i,
    better: "take a trial-and-error approach"
  },
  {
    source: /万事俱备，只欠东风/,
    literal: /\beast wind\b|\bwind\b/i,
    better: "Everything is ready; only one crucial condition is missing."
  },
  {
    source: /拖泥带水/,
    literal: /\b(mud|water|drag)\b/i,
    better: "sloppy and inefficient"
  }
];

const NOMINALIZATION_PATTERNS = [
  {
    source: /反对|支持|决定|讨论|调查|改进|保护|分析|申请|批准/,
    target: /\b(oppose|support|decide|discuss|investigate|improve|protect|analyze|apply|approve)\b/i,
    suggestion: "可考虑用 opposition to, support for, decision on, discussion of 等名词或介词结构。"
  }
];

const PERSONAL_SUBJECT_PATTERNS = [
  {
    source: /我突然想到|我认为有必要|我们发现|我记得|我担心/,
    target: /^(i|we)\b/i,
    suggestion: "可考虑用 It occurred to me that..., Evidence shows..., This raises concerns that... 等物称或形式主语。"
  }
];

function normalize(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

export function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

export function detectDirection(sourceText) {
  if (containsChinese(sourceText)) return "zh-en";
  if (/[A-Za-z]/.test(sourceText)) return "en-zh";
  return "zh-en";
}

function tokenizeWords(text) {
  return normalize(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function clampScore(value) {
  return Math.max(0, Math.min(3, Number(value.toFixed(1))));
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = finding?.dedupeKey || finding?.id;
    if (!finding || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class TranscodingFeedbackEngine {
  analyze({ sourceText, userTranslation, referenceTranslation = "", direction, mode = "default" }) {
    const source = normalize(sourceText);
    const user = normalize(userTranslation);
    const reference = normalize(referenceTranslation);
    const activeDirection = direction || detectDirection(source);
    const hasUserTranslation = user.length > 0;

    const findings = uniqueFindings(
      hasUserTranslation
        ? [
            this.detectVerbPiling(source, user, activeDirection),
            this.detectChineseOrderLiteralism(source, user, activeDirection),
            this.detectMissingLogicalConnector(source, user, activeDirection),
            this.detectTopicSubjectMismatch(source, user, activeDirection),
            this.detectNominalizationOpportunity(source, user, activeDirection),
            this.detectImpersonalSubjectOpportunity(source, user, activeDirection),
            this.detectRedundancyCategoryWord(source, user, activeDirection),
            this.detectCulturalImageryLiteralism(source, user, activeDirection),
            this.detectPassiveActiveMismatch(source, user, activeDirection)
          ]
        : this.detectSourceChallenges(source, activeDirection)
    );

    const scores = this.score({ sourceText: source, userTranslation: user, referenceTranslation: reference, findings });
    const triggeredRuleIds = findings.map((finding) => finding.id);
    const triggeredRuleNames = findings.map((finding) => finding.diagnosticLabel || finding.ruleName);

    return {
      mode,
      direction: activeDirection,
      diagnosis: {
        count: findings.length,
        triggeredRuleIds,
        triggeredRuleNames,
        summary:
          !hasUserTranslation && findings.length > 0
            ? `默认模式识别出 ${findings.length} 个转换关注点：${triggeredRuleNames.join("、")}。`
            : !hasUserTranslation
              ? "已生成参考译文；未发现明显高风险转换点，可以继续提交自己的译文做精确诊断。"
              : findings.length > 0
            ? `这句译文触犯了 ${findings.length} 条转换规则：${findings.map((finding) => finding.ruleName).join("、")}。`
            : "未发现明显转换规则问题，可以继续检查表达自然度和信息完整性。"
      },
      breakdown: findings.map((finding) => ({
        ruleId: finding.id,
        ruleName: finding.ruleName,
        displayRuleName: finding.diagnosticLabel || finding.ruleName,
        diagnosticLabel: finding.diagnosticLabel || "",
        chineseThinking: finding.chineseThinking,
        requirement: finding.requirement,
        application: finding.application
      })),
      referenceTranslation: reference,
      mantras: findings.length > 0 ? findings.map((finding) => finding.mantra) : ["先抓主干，再处理逻辑，最后打磨自然度。"],
      scores,
      feedbackSource: "local",
      aiNotice: "",
      createdAt: Date.now()
    };
  }

  detectSourceChallenges(source, direction) {
    if (!source) return [];

    if (direction === "zh-en") {
      return [
        this.sourceHint(
          /这家公司|，.+，|、|并且|然后|现在/.test(source),
          "verb-piling",
          "原文有连续动作或多个分句，容易被译成英文逗号流水句。",
          "英语需要先立主句，再把背景动作收进从句、分词结构或连接词。",
          "本句训练重点是先判断哪个动作是主干，再处理次要动作。"
        ),
        this.sourceHint(
          /你不来，我不走|有.+大家|如果|要是|若|只要|因为|所以|虽然|但是|否则|以便|为了/.test(source),
          "missing-logical-connector",
          "原文依靠语义暗示条件、因果、目的或转折关系。",
          "英语需要用 if, because, so that, unless, although 等词显化逻辑。",
          "本句训练重点是先给两个分句命名逻辑关系，再选择连接词。"
        ),
        this.sourceHint(
          /^(那所房子|这所房子|这个问题|这个项目|这件事|这家公司)/.test(source),
          "topic-subject-mismatch",
          "原文先抛出话题，再对话题发表评论。",
          "英语需要明确主语和谓语，话题不一定能直接当主语。",
          "本句训练重点是把真正的施动者或判断对象放进英语主干。"
        ),
        this.sourceHint(
          NOMINALIZATION_PATTERNS.some((pattern) => pattern.source.test(source)),
          "chinese-order-literalism",
          "原文含有汉语动词化表达，直译时容易把动作一路铺开。",
          "英语常用名词、介词或抽象结构承接动作概念，让句子更静态、更紧凑。",
          "本句训练重点是判断哪些动作可以转为名词或介词结构。",
          { diagnosticLabel: "动词转名词/介词", dedupeKey: "source-nominalization" }
        ),
        this.sourceHint(
          PERSONAL_SUBJECT_PATTERNS.some((pattern) => pattern.source.test(source)),
          "topic-subject-mismatch",
          "原文以人称主语展开，符合中文表达习惯。",
          "英语在正式表达中常用事物、抽象名词或形式主语承载判断。",
          "本句训练重点是判断是否可把 I / we 改成 it, evidence, the situation 等主语。",
          { diagnosticLabel: "人称主语转物称/形式主语", dedupeKey: "source-impersonal-subject" }
        ),
        this.sourceHint(
          /工作|问题|情况|状态|趋势|方面|任务/.test(source),
          "redundancy-category-word",
          "原文含有汉语常见范畴词或壳词。",
          "英语通常删除空泛名词，直接表达核心概念。",
          "本句训练重点是先删掉 work/problem/situation 这类直译冲动。"
        ),
        this.sourceHint(
          CULTURE_PATTERNS.some((pattern) => pattern.source.test(source)),
          "cultural-imagery-literalism",
          "原文含有文化负载词，字面意象可能不能直接迁移。",
          "目标语表达要优先传达交际功能，再决定是否保留文化意象。",
          "本句训练重点是先问它在语境里起什么作用，而不是先逐字翻译。"
        ),
        this.sourceHint(
          /问题已经解决了|已经完成了|已经确定了|已经批准了|已经公布了|得到解决/.test(source),
          "passive-active-mismatch",
          "原文没有明确施动者，汉语可以自然省略。",
          "英语常把对象放到主语位置，用被动结构承接。",
          "本句训练重点是判断是否应译成 has been done 这类被动。"
        )
      ].filter(Boolean);
    }

    return [
      this.sourceHint(
        /\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/.test(source.toLowerCase()),
        "passive-active-mismatch",
        "原文含有英语被动结构，直译成中文容易生硬。",
        "汉语更常转主动或拆分短句，必要时补出泛指施动者。",
        "本句训练重点是先找事件本身，再决定谁来做中文主语。"
      ),
      this.sourceHint(
        /\b(who|which|that|put forward by|destroyed in|constructed without|designed to)\b/i.test(source),
        "chinese-order-literalism",
        "原文含有英语长修饰链，中文直译容易出现层层“的”。",
        "汉语更适合拆成短句，把修饰信息分步交代。",
        "本句训练重点是避免“的的不休”，先拆再顺。",
        { diagnosticLabel: "的的不休" }
      )
    ].filter(Boolean);
  }

  detectVerbPiling(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const lower = user.toLowerCase();
    const commaClauses = lower.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
    const hasWeakCommaChain = commaClauses.length >= 3;
    const hasKnownPattern = /,\s*(cut|laid|lost|now\s+is|now\s+are|is\s+now|are\s+now|looks?|seeks?|wants?)\b/.test(lower);
    const hasConnectorRepair = /\b(which|who|because|although|while|and|but|so that|therefore|after|before)\b/.test(lower);

    if ((hasWeakCommaChain || hasKnownPattern) && !hasConnectorRepair) {
      return this.finding(
        "verb-piling",
        "学生译文把中文连续动作照搬成英文逗号串，像中文流水句一样一路排下去。",
        "英语需要明确主句和从属信息，多个谓语不能只靠逗号连接。",
        `本句应把“${source.slice(0, 22)}...”中的背景动作降级，例如改成 which 从句、分词结构或 and 连接。`
      );
    }
    return null;
  }

  detectChineseOrderLiteralism(source, user, direction) {
    if (!user) return null;
    const lower = user.toLowerCase();

    if (direction === "zh-en") {
      const startsWithCondition = /^(if|when|because|although)\b/.test(lower);
      const commaCount = (user.match(/[,;]/g) || []).length;
      const sourceHasCondition = /如果|要是|若|只要/.test(source);
      const literalTopic = /^(that|the|this)\s+(house|problem|matter|issue)\s+(you|we|they|i)\b/.test(lower);

      if ((sourceHasCondition && startsWithCondition && commaCount >= 2) || literalTopic) {
        return this.finding(
          "chinese-order-literalism",
          "学生译文跟着中文的先后顺序走，把条件或话题直接放到英文句首。",
          "英语更重信息主次，常把主命令或主判断提前，再用从句说明条件。",
          "本句应先确定主句，再把条件、背景或话题转成从句、宾语或独立句。"
        );
      }
    }

    if (direction === "en-zh") {
      const deCount = (user.match(/的/g) || []).length;
      const passiveLiteral = /是被|被建造在|被构建在|被设计来/.test(user);
      const longAttributiveChain = /(?:的[^。！？,.，；;]*){3,}/.test(user);
      const sentenceLikeFragments = user.split(/[。！？!?]/).map((part) => part.trim()).filter(Boolean).length;
      const sourceHasLongModifier = /\b(who|which|that|put forward by|destroyed in|constructed without|designed to|joined|attracted)\b/i.test(source);
      const likelyFragmentTranslation = sentenceLikeFragments <= 1 && user.length >= 24 && (deCount >= 3 || longAttributiveChain);
      if (deCount >= 4 || passiveLiteral || (sourceHasLongModifier && likelyFragmentTranslation)) {
        return this.finding(
          "chinese-order-literalism",
          "学生译文保留英文长定语和被动骨架，中文读起来层层套叠。",
          "汉语更适合短句分述，先说事件，再补背景和条件。",
          "本句应拆成两到三个短句，减少连续“的”字结构。",
          deCount >= 3 || longAttributiveChain ? { diagnosticLabel: "的的不休" } : {}
        );
      }
    }

    return null;
  }

  detectMissingLogicalConnector(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const lower = user.toLowerCase();
    const hasLogicalSource =
      /你不来，我不走|有.+大家|如果|要是|因为|所以|虽然|但是|否则|以便|为了/.test(source) ||
      (/，/.test(source) && source.length <= 40);
    const hasExplicitConnector = /\b(if|because|so that|unless|although|though|while|when|therefore|so|but|and)\b/.test(lower);
    const hasCommaOnlyJoin = /,\s*(there|we|i|you|he|she|they|it|this|that|the)\b/.test(lower);

    if (hasLogicalSource && (!hasExplicitConnector || hasCommaOnlyJoin)) {
      return this.finding(
        "missing-logical-connector",
        "学生译文让英文读者自己猜条件、因果或目的关系。",
        "英语句间逻辑必须显化，尤其是条件句和目的句。",
        "本句应根据语义补出 if, because, so that, unless 等连接词。"
      );
    }
    return null;
  }

  detectTopicSubjectMismatch(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const lower = user.toLowerCase();
    const sourceTopic = /^(那所房子|这所房子|这个问题|这个项目|这件事|这家公司)/.test(source);
    const literalTopic = /^(that|this|the)\s+(house|problem|project|matter|company)\s+(you|we|they|i)\b/.test(lower);
    const missingSubject = /\b(no subject|without subject)\b/.test(lower);

    if (sourceTopic && (literalTopic || missingSubject)) {
      return this.finding(
        "topic-subject-mismatch",
        "学生译文把中文话题当成英文主语，后面又另起执行者。",
        "英语句子需要清楚的主语和谓语，话题若不是施动者就要转为宾语或拆句。",
        "本句应把真正执行动作的人或机构放到主语位置，例如 You should have repaired that house."
      );
    }
    return null;
  }

  detectRedundancyCategoryWord(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const lower = user.toLowerCase();
    const sourceHasCategoryWord = /工作|问题|情况|状态|趋势|方面|任务/.test(source);
    const targetHasCategoryWord =
      /\b(work|task)\s+of\b|\bproblem\s+of\b|\bsituation\s+of\b|\bstate\s+of\b|\btrend\s+of\b|\baspect\s+of\b/.test(lower);

    if (sourceHasCategoryWord && targetHasCategoryWord) {
      return this.finding(
        "redundancy-category-word",
        "学生译文把中文空泛范畴词原样带入英文。",
        "英文倾向直接表达核心概念，空泛名词会让表达拖沓。",
        "本句应删除 work/problem/situation 等壳词，直接说 strengthen environmental protection 一类结构。"
      );
    }
    return null;
  }

  detectNominalizationOpportunity(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const match = NOMINALIZATION_PATTERNS.find((pattern) => pattern.source.test(source) && pattern.target.test(user));
    if (!match) return null;

    return this.finding(
      "chinese-order-literalism",
      "学生译文把中文动词表达直接搬进英语，动作感偏重。",
      "英语常用名词化或介词结构压缩动作，让信息层级更清楚。",
      `本句可检查是否需要静态化处理：${match.suggestion}`,
      { diagnosticLabel: "动词转名词/介词", dedupeKey: "nominalization-opportunity" }
    );
  }

  detectImpersonalSubjectOpportunity(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const match = PERSONAL_SUBJECT_PATTERNS.find((pattern) => pattern.source.test(source) && pattern.target.test(user));
    if (!match) return null;

    return this.finding(
      "topic-subject-mismatch",
      "学生译文保留了中文的人称主语开头。",
      "英语正式表达常用物称主语、抽象名词或形式主语，让判断更客观自然。",
      `本句可检查是否需要改写主语：${match.suggestion}`,
      { diagnosticLabel: "人称主语转物称/形式主语", dedupeKey: "impersonal-subject-opportunity" }
    );
  }

  detectCulturalImageryLiteralism(source, user, direction) {
    if (direction !== "zh-en" || !user) return null;
    const match = CULTURE_PATTERNS.find((pattern) => pattern.source.test(source) && pattern.literal.test(user));
    if (!match) return null;

    return this.finding(
      "cultural-imagery-literalism",
      "学生译文保留了中文文化意象，但没有保证英语读者能理解其功能。",
      "文化负载词要优先传达交际功能，必要时用功能对应或意译。",
      `本句更适合译成 ${match.better}，而不是逐字保留原意象。`
    );
  }

  detectPassiveActiveMismatch(source, user, direction) {
    if (!user) return null;

    if (direction === "zh-en") {
      const sourceNoAgentPassive = /问题已经解决了|已经完成了|已经确定了|已经批准了|已经公布了|得到解决/.test(source);
      const lower = user.toLowerCase();
      const hasEnglishPassive = /\b(is|are|was|were|be|been|being|has been|have been)\s+\w+(ed|en)\b/.test(lower);
      if (sourceNoAgentPassive && !hasEnglishPassive) {
        return this.finding(
          "passive-active-mismatch",
          "学生译文没有处理中文无施动者句，只是顺着中文主动语气说。",
          "英语遇到施动者不明或不重要时，常用被动语态让对象成为主语。",
          "本句应译为 The problem has been solved. 这类被动结构。"
        );
      }
    }

    if (direction === "en-zh") {
      const sourcePassive = /\b(was|were|is|are|been|being)\s+\w+(ed|en)\b/.test(source.toLowerCase());
      const overPassiveChinese = /是被|被建造|被构建|被设计|被摧毁|被制造/.test(user);
      if (sourcePassive && overPassiveChinese) {
        return this.finding(
          "passive-active-mismatch",
          "学生译文机械保留英文被动，导致中文出现生硬的“是被...”结构。",
          "汉语更常把被动改成主动或拆成短句，必要时补出泛指施动者。",
          "本句应改为“地震摧毁了许多建筑。这些建筑当初建造时...”这样的主动短句。"
        );
      }
    }

    return null;
  }

  score({ sourceText, userTranslation, referenceTranslation, findings }) {
    const accuracy = this.scoreAccuracy(userTranslation, referenceTranslation, findings);
    const fluency = this.scoreFluency(userTranslation);
    const pronunciation = this.scorePronunciation(userTranslation, referenceTranslation);
    return {
      pronunciation,
      fluency,
      accuracy,
      total: clampScore((pronunciation + fluency + accuracy) / 3)
    };
  }

  scoreAccuracy(userTranslation, referenceTranslation, findings) {
    if (!userTranslation || !referenceTranslation) return 0;
    const refBigrams = this.bigrams(referenceTranslation);
    const userBigrams = this.bigrams(userTranslation);
    const intersection = userBigrams.filter((item) => refBigrams.includes(item)).length;
    const union = new Set([...refBigrams, ...userBigrams]).size || 1;
    const bigramScore = intersection / union;
    const penalty = Math.min(1.2, findings.length * 0.22);
    return clampScore(bigramScore * 3.2 - penalty + 0.2);
  }

  scoreFluency(userTranslation) {
    if (!userTranslation) return 0;
    const fillerCount = (userTranslation.match(/\b(um|uh|er|like|you know|i mean)\b|嗯|啊|呃|那个|这个|就是说/gim) || []).length;
    const repeatedCount = (userTranslation.match(/\b(\w+)\s+\1\b/gi) || []).length;
    const commaRun = (userTranslation.match(/,\s*[^,]+,\s*[^,]+,/g) || []).length;
    return clampScore(3 - fillerCount * 0.45 - repeatedCount * 0.55 - commaRun * 0.35);
  }

  scorePronunciation(userTranslation, referenceTranslation) {
    if (!userTranslation || !referenceTranslation) return 0;
    const userWords = tokenizeWords(userTranslation);
    const refWords = new Set(tokenizeWords(referenceTranslation));
    if (userWords.length === 0) return 0;
    const overlap = userWords.filter((word) => refWords.has(word)).length / Math.max(userWords.length, refWords.size, 1);
    return clampScore(1.5 + overlap * 1.5);
  }

  bigrams(text) {
    const compact = normalize(text).replace(/\s+/g, "");
    if (compact.length < 2) return compact ? [compact] : [];
    const result = [];
    for (let i = 0; i < compact.length - 1; i += 1) result.push(compact.slice(i, i + 2).toLowerCase());
    return result;
  }

  sourceHint(active, id, chineseThinking, requirement, application, options = {}) {
    return active ? this.finding(id, chineseThinking, requirement, application, options) : null;
  }

  finding(id, chineseThinking, requirement, application, options = {}) {
    const definition = ERROR_DEFINITIONS[id];
    return {
      id,
      dedupeKey: options.dedupeKey || id,
      ruleName: definition.name,
      diagnosticLabel: options.diagnosticLabel || "",
      chineseThinking,
      requirement,
      application,
      mantra: definition.mantra
    };
  }
}

export { ERROR_DEFINITIONS };
