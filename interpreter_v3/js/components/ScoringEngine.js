/**
 * Multi-dimensional scoring engine: pronunciation, fluency, and accuracy.
 * All analysis is local (no LLM required).
 */
export class ScoringEngine {
  constructor() {
    this._initHomophoneMap();
    this._initFillerWords();
  }

  // --- Homophone detection maps ---
  _initHomophoneMap() {
    // Chinese common homophone groups (pairs that STT commonly confuses)
    this.cnHomophones = {
      '在': ['再'], '的': ['得', '地', '底'], '了': ['啦', '嘹'],
      '是': ['事', '时', '十', '市'], '和': ['河', '合', '何'],
      '你': ['里', '理', '李'], '他': ['她', '它', '塔'],
      '有': ['又', '由', '友'], '不': ['部', '布', '步'],
      '这': ['者', '着', '折'], '们': ['门', '闷'],
      '会': ['回', '汇', '惠'], '对': ['队', '堆'],
      '可': ['科', '颗', '渴'], '以': ['已', '意', '义'],
      '学': ['雪', '血', '穴'], '生': ['声', '省', '升'],
      '大': ['达', '打', '答'], '中': ['钟', '众', '终'],
      '上': ['尚', '赏', '伤'], '下': ['夏', '吓'],
      '人': ['任', '认', '仁'], '国': ['过', '郭'],
      '为': ['未', '位', '味'], '能': ['嫩'],
      '好': ['号', '毫', '豪'], '小': ['晓', '笑'],
      '家': ['加', '佳', '嘉'], '到': ['道', '倒'],
      '说': ['所'], '看': ['砍', '刊'],
      '想': ['像', '向', '响'], '做': ['作', '坐', '座'],
      '天': ['田', '填', '添'], '地': ['第', '帝'],
      '心': ['新', '辛', '欣'], '手': ['首', '守'],
    };

    // English common homophone groups
    this.enHomophones = {
      'there': ['their', "they're"], 'your': ["you're"],
      'its': ["it's"], 'to': ['too', 'two'],
      'hear': ['here'], 'right': ['write', 'rite'],
      'where': ['wear', 'ware'], 'see': ['sea'],
      'new': ['knew'], 'know': ['no'],
      'for': ['four', 'fore'], 'by': ['buy', 'bye'],
      'our': ['hour'], 'their': ['there'],
      'through': ['threw'], 'whether': ['weather'],
      'peace': ['piece'], 'whole': ['hole'],
      'led': ['lead'], 'past': ['passed'],
      'sight': ['site', 'cite'], 'would': ['wood'],
    };
  }

  // --- Filler word detection ---
  _initFillerWords() {
    this.cnFillers = [
      '嗯', '啊', '额', '呃', '呀', '嘛', '哦',
      '那个', '这个', '就是', '然后', '反正', '对吧',
      '怎么说', '就是说', '那么', '对不对'
    ];
    this.enFillers = [
      'um', 'uh', 'er', 'ah', 'hmm',
      'like', 'you know', 'well', 'actually',
      'basically', 'sort of', 'kind of', 'i mean',
      'so', 'right', 'okay'
    ];
  }

  /**
   * Score pronunciation (0-3) by detecting homophone errors.
   */
  analyzePronunciation(userText, referenceText) {
    if (!userText || !referenceText) {
      return { score: 0, homophoneErrors: [], feedback: '无法评估发音：文本为空' };
    }

    const homophoneMap = this._detectLanguage(userText) === 'zh'
      ? this.cnHomophones : this.enHomophones;
    const isChinese = this._detectLanguage(userText) === 'zh';

    const errors = [];

    if (isChinese) {
      // Chinese: character-level comparison
      const refChars = referenceText.replace(/\s+/g, '').split('');
      const userChars = userText.replace(/\s+/g, '').split('');

      for (let i = 0; i < userChars.length; i++) {
        const uc = userChars[i];
        // Check if this character is in homophone map and its replacement would make sense
        if (homophoneMap[uc]) {
          const alternates = homophoneMap[uc];
          // Check if any of the reference characters near this position match homophone alternatives
          const refWindow = refChars.slice(Math.max(0, i - 2), Math.min(refChars.length, i + 3));
          for (const alt of alternates) {
            if (refWindow.includes(alt)) {
              errors.push({ detected: uc, expected: alt, position: i });
              break;
            }
          }
        }
      }
    } else {
      // English: word-level comparison
      const refWords = referenceText.toLowerCase().split(/\s+/);
      const userWords = userText.toLowerCase().split(/\s+/);

      for (let i = 0; i < userWords.length; i++) {
        const uw = userWords[i].replace(/[^a-z]/g, '');
        if (homophoneMap[uw]) {
          const alternates = homophoneMap[uw];
          const refWindow = refWords.slice(Math.max(0, i - 2), Math.min(refWords.length, i + 3));
          for (const alt of alternates) {
            if (refWindow.includes(alt)) {
              errors.push({ detected: uw, expected: alt, position: i });
              break;
            }
          }
        }
      }
    }

    // Deduplicate errors
    const uniqueErrors = errors.filter((e, i, arr) =>
      arr.findIndex(x => x.detected === e.detected && x.expected === e.expected) === i
    );

    let score, feedback;
    const count = uniqueErrors.length;
    if (count === 0) { score = 3; feedback = '发音标准，无明显同音字错误。'; }
    else if (count <= 2) {
      score = 2;
      const examples = uniqueErrors.map(e => `"${e.detected}"应为"${e.expected}"`).join('、');
      feedback = `检测到 ${count} 处轻微发音偏差：${examples}。`;
    } else if (count <= 4) {
      score = 1;
      const examples = uniqueErrors.slice(0, 3).map(e => `"${e.detected}"应为"${e.expected}"`).join('、');
      feedback = `检测到 ${count} 处发音错误：${examples}等。建议加强发音练习。`;
    } else {
      score = 0;
      feedback = `检测到 ${count} 处严重发音错误，建议从基础发音开始练习。`;
    }

    return { score, homophoneErrors: uniqueErrors, feedback };
  }

  /**
   * Score fluency (0-3) by detecting filler words, repetitions, and unnatural pauses.
   */
  analyzeFluency(userText) {
    if (!userText) {
      return { score: 0, repeatedWords: [], fillerWords: [], pauses: 0, feedback: '无法评估流畅性：文本为空' };
    }

    const isChinese = this._detectLanguage(userText) === 'zh';
    const fillers = isChinese ? this.cnFillers : this.enFillers;

    // Detect filler words
    const detectedFillers = [];
    for (const filler of fillers) {
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      let match;
      while ((match = regex.exec(userText)) !== null) {
        // Only count as filler if not part of a longer word (for English)
        if (!isChinese || filler.length >= 2) {
          detectedFillers.push({ word: filler, position: match.index });
        } else if (isChinese && filler.length === 1) {
          // Single-char Chinese filler: check context
          // Count "嗯", "啊" etc. when they appear alone or as interjections
          detectedFillers.push({ word: filler, position: match.index });
        }
      }
    }

    // Detect repeated words
    const repeatedWords = [];
    if (isChinese) {
      // Chinese: detect consecutive repeating characters 3+ times
      const repeatMatches = userText.match(/(.)\1{2,}/g);
      if (repeatMatches) {
        repeatMatches.forEach(m => {
          repeatedWords.push({ word: m, pattern: m[0] + '×' + m.length });
        });
      }
      // Chinese: detect repeated 2-3 char words
      const wordRepeatMatches = userText.match(/(.{2,3})\1+/g);
      if (wordRepeatMatches) {
        wordRepeatMatches.forEach(m => {
          repeatedWords.push({ word: m, pattern: m.slice(0, m.length / 2) + '×2' });
        });
      }
    } else {
      // English: detect consecutive repeated words
      const words = userText.split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].toLowerCase() === words[i + 1].toLowerCase()) {
          repeatedWords.push({ word: words[i], position: i });
        }
      }
    }

    // Detect unnatural pauses (excessive punctuation)
    let pauses = 0;
    const punctuationCount = (userText.match(/[,，;；.。…、！!？?]/g) || []).length;
    const wordsCount = userText.split(/\s+/).length;
    if (wordsCount > 0) {
      const punctuationRatio = punctuationCount / Math.max(1, wordsCount);
      if (punctuationRatio > 0.5) pauses = Math.floor(punctuationRatio * 10);
    }
    // Short fragments indicate unnatural pauses
    const fragments = userText.split(/[,，;；.。…、！!？?]+/).filter(f => f.trim().length < 3);
    pauses += fragments.length;

    const totalIssues = detectedFillers.length + repeatedWords.length + pauses;

    let score, feedback;
    if (totalIssues === 0) { score = 3; feedback = '表达流畅，无明显停顿或犹豫标记。'; }
    else if (totalIssues <= 2) {
      score = 2;
      const parts = [];
      if (detectedFillers.length > 0) parts.push(`${detectedFillers.length} 处填充词`);
      if (repeatedWords.length > 0) parts.push(`${repeatedWords.length} 处词语重复`);
      if (pauses > 0) parts.push(`${pauses} 处不自然停顿`);
      feedback = `整体流畅，有${parts.join('、')}。`;
    } else if (totalIssues <= 4) {
      score = 1;
      const example = detectedFillers.slice(0, 2).map(f => `"${f.word}"`).join('、');
      feedback = `检测到 ${totalIssues} 处流畅性问题${example ? `，如填充词 ${example}` : ''}。建议放慢语速，减少口头禅。`;
    } else {
      score = 0;
      feedback = `检测到 ${totalIssues} 处严重流畅性问题，建议加强口语流利度训练。`;
    }

    return { score, repeatedWords, fillerWords: detectedFillers, pauses, feedback };
  }

  /**
   * Score accuracy (0-3) using weighted Jaccard + Bigram similarity with length penalty.
   */
  analyzeAccuracy(sourceText, userTranslation, referenceTranslation) {
    if (!userTranslation || !referenceTranslation) {
      return { score: 0, missingKeyInfo: [], addedInfo: [], feedback: '无法评估准确性：翻译文本为空' };
    }

    // Normalize texts
    const normRef = referenceTranslation.replace(/\s+/g, ' ').trim();
    const normUser = userTranslation.replace(/\s+/g, ' ').trim();

    // Character-level Jaccard similarity
    const refSet = new Set([...normRef]);
    const userSet = new Set([...normUser]);
    const intersection = new Set([...refSet].filter(x => userSet.has(x)));
    const union = new Set([...refSet, ...userSet]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    // Bigram similarity
    const refBigrams = this._extractBigrams(normRef);
    const userBigrams = this._extractBigrams(normUser);
    const bgIntersection = refBigrams.filter(bg => userBigrams.includes(bg));
    const bgUnion = [...new Set([...refBigrams, ...userBigrams])];
    const bigramSimilarity = bgUnion.length > 0 ? bgIntersection.length / bgUnion.length : 0;

    // Weighted combination (40% Jaccard, 60% Bigram)
    let similarity = jaccard * 0.4 + bigramSimilarity * 0.6;

    // Length penalty
    const lenRatio = normUser.length / Math.max(1, normRef.length);
    if (lenRatio < 0.5) {
      similarity -= 0.2;
    } else if (lenRatio > 1.5) {
      similarity -= 0.1;
    }

    similarity = Math.max(0, Math.min(1, similarity));

    // Determine missing/additional key info
    const sourceKeywords = this._extractKeywords(sourceText);
    const missingKeyInfo = sourceKeywords.filter(kw => !userTranslation.includes(kw));

    let score, feedback;
    if (similarity >= 0.80) { score = 3; feedback = '翻译准确，完整传达了原文意思。'; }
    else if (similarity >= 0.60) {
      score = 2;
      const parts = [];
      if (missingKeyInfo.length > 0) parts.push(`可能遗漏了"${missingKeyInfo.slice(0, 2).join('、')}"`);
      feedback = `翻译基本准确${parts.length > 0 ? '，' + parts.join('；') : ''}。`;
    } else if (similarity >= 0.35) {
      score = 1;
      const parts = [];
      if (missingKeyInfo.length > 0) parts.push(`遗漏了"${missingKeyInfo.slice(0, 3).join('、')}"等关键信息`);
      if (lenRatio < 0.5) parts.push('翻译内容过短');
      feedback = `翻译有较多缺失或偏差${parts.length > 0 ? '：' + parts.join('；') : ''}。`;
    } else {
      score = 0;
      feedback = '翻译与原文意思差距较大，建议重新翻译。';
    }

    return { score, similarity, missingKeyInfo: missingKeyInfo.slice(0, 5), feedback };
  }

  /**
   * Full evaluation: returns ScoreReport with all 3 dimensions.
   */
  evaluateTranslation(sourceText, userTranslation, referenceTranslation) {
    if (!sourceText || !userTranslation || !referenceTranslation) {
      throw new Error('评分参数不完整：需要原文、用户翻译和参考翻译');
    }

    const pronResult = this.analyzePronunciation(userTranslation, referenceTranslation);
    const fluResult = this.analyzeFluency(userTranslation);
    const accResult = this.analyzeAccuracy(sourceText, userTranslation, referenceTranslation);

    const totalScore = parseFloat(
      ((pronResult.score + fluResult.score + accResult.score) / 3).toFixed(1)
    );

    // Generate overall suggestions
    const suggestions = this._generateSuggestions(pronResult, fluResult, accResult);

    return {
      pronunciationScore: pronResult.score,
      fluencyScore: fluResult.score,
      accuracyScore: accResult.score,
      totalScore,
      pronunciationFeedback: pronResult.feedback,
      fluencyFeedback: fluResult.feedback,
      accuracyFeedback: accResult.feedback,
      homophoneErrors: pronResult.homophoneErrors,
      fillerWords: fluResult.fillerWords,
      repeatedWords: fluResult.repeatedWords,
      missingKeyInfo: accResult.missingKeyInfo,
      suggestions,
      timestamp: Date.now()
    };
  }

  // --- Private helpers ---

  _extractBigrams(text) {
    const bigrams = [];
    for (let i = 0; i < text.length - 1; i++) {
      bigrams.push(text.slice(i, i + 2));
    }
    return bigrams;
  }

  _extractKeywords(text) {
    const isChinese = this._detectLanguage(text) === 'zh';
    if (isChinese) {
      // Extract meaningful 2-4 char chunks
      const cleaned = text.replace(/[^一-鿿]/g, '');
      const keywords = [];
      for (let i = 0; i < cleaned.length - 1; i++) {
        const chunk = cleaned.slice(i, i + 2);
        if (!this._isCommonStopWord(chunk)) {
          keywords.push(chunk);
        }
      }
      return [...new Set(keywords)].slice(0, 10);
    } else {
      // Extract words > 3 chars, excluding stop words
      const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
        'and', 'or', 'but', 'not', 'this', 'that', 'it', 'its',
        'has', 'have', 'do', 'does', 'did', 'will', 'would', 'can',
        'could', 'should', 'may', 'might', 'they', 'them', 'their'
      ]);
      const words = text.split(/\s+/);
      return words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
    }
  }

  _isCommonStopWord(text) {
    const stops = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '这个', '那个'];
    return stops.includes(text);
  }

  _detectLanguage(text) {
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    return chineseChars > text.length * 0.3 ? 'zh' : 'en';
  }

  _generateSuggestions(pron, flu, acc) {
    const suggestions = [];
    if (pron.score < 3) suggestions.push('发音：注意区分同音字，可多听标准发音材料进行跟读练习');
    if (pron.score < 2) suggestions.push('发音：建议从基础拼音/音标开始，逐步纠正发音习惯');
    if (flu.score < 3) suggestions.push('流畅性：减少"嗯、啊"等填充词，练习时可用录音回听自我纠正');
    if (flu.score < 2) suggestions.push('流畅性：尝试先组织语言再开口，避免边想边说导致的停顿');
    if (acc.score < 3) suggestions.push('准确性：注意完整传达原文的关键信息，避免遗漏重要内容');
    if (acc.score < 2) suggestions.push('准确性：建议先理解全文再翻译，确保核心意思准确传达');
    return suggestions;
  }
}
