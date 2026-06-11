# Interpreter V4

中英转换训练台。当前版本以 `interpret.md` 的“中英转换训练专家”为核心，面向中文到英文、英文到中文的结构转换训练，而不是普通翻译演示。

## 运行方式

`interpreter_v4` 使用 ES modules 和 `fetch()` 加载本地 JSON，建议用本地 HTTP 服务打开：

```bash
cd interpreter_v4
python -m http.server 8084
```

然后用 Chrome 或 Edge 打开：

```text
http://localhost:8084
```

Chrome / Edge 是语音识别和语音合成的推荐浏览器。直接双击 `index.html` 可能因浏览器本地文件限制导致 JSON 加载失败。

## 核心功能

### 训练桌面

- 浏览内置中英转换素材卡片。
- 按模块、难度、方向排序或搜索。
- 点击“新练习”进入自定义训练，点击“打开练习”进入指定素材。

### 实战工作区

- 选择方向：自动检测、中 → 英、英 → 中。
- 选择难度：全部、基础、进阶、综合。
- 选择模块或具体规则后抽题。
- 输入原文、参考译文和你的译文。
- 点击“诊断”后输出：
  - 诊断：触发了哪些转换规则。
  - 拆解：中文思维、目标语要求、本句应用。
  - 参考译文。
  - 迁移口诀。
  - 辅助分数：发音、流畅、准确和总分，每项 0-3。
- 支持录音、浏览器语音识别、朗读参考译文。

### 专家对话

专家对话是 V4 的新增入口，和工作区共用同一套规则引擎。

两种用法：

- 默认模式：直接发送一句中文或英文原文，系统自动判断方向，生成参考译文和转换关注点。
- 引导练习：发送类似“我想练中→英，文化负载词，综合难度”，系统会识别方向、模块和难度并出题。

出题后，在右侧“你的译文”输入答案，点击“诊断译文”。诊断结果可保存到学习记录，记录中会标记入口为“专家对话”。

### 学习记录

- 保存工作区和专家对话训练。
- 展示训练次数、平均总分、发音、流畅、准确。
- 展示分数趋势和规则触发频次。
- 可按模块和规则筛选。
- 支持查看详情、删除记录、清空记录、导出 CSV。

## 规则体系

V4 内置六大知识模块：

- 形合 vs 意合
- 话题-评论 vs 主谓结构
- 句法整合
- 词性 / 语态 / 主语转换
- 冗余 / 逻辑 / 文化
- 文化负载词实战

收到用户译文时，本地规则引擎会扫描七类问题：

- 动词并列堆砌
- 按中文语序直译
- 缺少逻辑连词
- 话题-主语未转换
- 范畴词 / 冗余未删除
- 文化意象直译
- 被动 / 主动语态不当

V4 还会在相关场景中提示两个常见子问题：

- 汉语动词转英语名词 / 介词结构。
- 汉语人称主语转英语物称 / 形式主语。

## AI 与翻译设置

本地规则诊断始终可用，不依赖 API key。

设置面板支持：

- AI 反馈增强：兼容 OpenAI-style `/v1/chat/completions` JSON 接口。
- DeepL API Key：可选，用于优先机器翻译。
- 主题切换：浅色 / 深色。

AI 增强只负责补充或润色本地诊断，不允许删除本地已触发的规则、拆解和口诀。AI 请求失败、超时或返回格式不合法时，会自动回退到本地规则报告。

免费机器翻译 fallback：

- MyMemory
- LibreTranslate

如果机器翻译失败，可以手动填写参考译文后继续运行本地诊断。

## 数据存储

- 设置和草稿保存在当前浏览器 `localStorage`，key 前缀为 `int4_`。
- 学习记录和录音保存在 IndexedDB。
- 没有后端、没有账号系统、没有构建步骤。

## 项目结构

```text
interpreter_v4/
  index.html
  styles/main.css
  data/
    interpret-rubric.json
    materials.json
    transcoding-rules.json
  js/
    main.js
    components/
      ExpertConversation.js
      MaterialLibrary.js
      RecordManager.js
      TranscodingFeedbackEngine.js
    services/
      AIFeedbackService.js
      SpeechService.js
      TranslationService.js
    storage/
      IndexedDBManager.js
      LocalStorageManager.js
  tests/
    feedback-engine.test.mjs
```

## 测试

```bash
cd interpreter_v4
node tests/feedback-engine.test.mjs
node --check js/main.js
node --check js/components/TranscodingFeedbackEngine.js
node --check js/components/ExpertConversation.js
```

测试覆盖：

- 七类错误的代表性触发。
- 英译中长定语链“的的不休”检测。
- 默认原文直诊。
- AI 增强失败回退。
- AI 增强不得删除本地规则诊断。
- 专家对话练习意图解析。

测试中会故意请求一个无效 AI endpoint 来验证 fallback，因此控制台出现一次 AI 请求失败警告是预期行为。

## 常见问题

### 页面打不开或素材为空

请确认使用本地 HTTP 服务访问，而不是直接双击文件：

```bash
cd interpreter_v4
python -m http.server 8084
```

### 语音识别不可用

请使用 Chrome 或 Edge，并允许麦克风权限。部分系统或浏览器策略会限制 Web Speech API。

### 没有 API key 能不能用

可以。API key 只影响 AI 增强和可选 DeepL 翻译。本地规则诊断、素材练习、学习记录都能使用。

### 机器翻译失败怎么办

可以手动填写参考译文，再点击“诊断”。本地规则引擎不依赖机器翻译服务。
