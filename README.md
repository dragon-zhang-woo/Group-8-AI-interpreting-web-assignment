# AI 口译与中英转换训练平台

当前主版本是 `interpreter_v4`：一个纯前端、零依赖、无构建步骤的中英转换训练网站。项目早期曾规划为 Python / Gradio 多模块系统，但当前可运行版本已经转为浏览器端单页应用。

## 当前入口

```bash
cd interpreter_v4
python -m http.server 8084
```

然后用 Chrome 或 Edge 打开：

```text
http://localhost:8084
```

推荐 Chrome / Edge，因为语音识别和语音合成依赖浏览器 Web Speech API。

## 当前功能

`interpreter_v4` 围绕 `interpret.md` 的“中英转换训练专家”设计，目标是训练中文和英文在结构、逻辑、语态、主语和文化表达上的转换能力。

主要入口：

- 训练桌面：浏览、搜索、筛选内置训练素材。
- 实战工作区：按方向、难度、模块和多条规则抽题，提交译文后获得转换诊断。
- 专家对话：直接发送原文获得默认训练反馈，或发送“我想练中→英，文化负载词，综合难度”进入引导练习。
- 学习记录：保存训练结果，区分训练选择规则和实际触发规则，查看趋势、规则频次、详情并导出 CSV。

本轮 UI 已向 Claude 桌面版的简洁工具感收敛：选择器使用紧凑圆角菜单和对勾选中态，左侧转换规则树支持多规则勾选。单个规则是专项训练，多个规则是综合训练。

内置素材库已扩充到 132 条原创中英转换素材，覆盖中→英、英→中、基础 / 进阶 / 综合、六大模块和七类常见错误。

核心诊断输出：

- 诊断：列出触发的转换规则。
- 拆解：中文思维、目标语要求、本句应用。
- 参考译文。
- 迁移口诀。
- 辅助分数：发音、流畅、准确、总分。

## 规则体系

当前版本覆盖六大模块：

- 形合 vs 意合
- 话题-评论 vs 主谓结构
- 句法整合
- 词性 / 语态 / 主语转换
- 冗余 / 逻辑 / 文化
- 文化负载词实战

本地规则引擎会扫描七类常见问题：

- 动词并列堆砌
- 按中文语序直译
- 缺少逻辑连词
- 话题-主语未转换
- 范畴词 / 冗余未删除
- 文化意象直译
- 被动 / 主动语态不当

## 技术架构

当前主版本不需要后端：

- HTML：`interpreter_v4/index.html`
- CSS：`interpreter_v4/styles/main.css`
- JavaScript：`interpreter_v4/js/`
- 素材和规则：`interpreter_v4/data/`
- 测试：`interpreter_v4/tests/feedback-engine.test.mjs`

浏览器 API：

- Web Speech API：语音识别和朗读。
- MediaRecorder API：录音。
- localStorage：设置和草稿。
- IndexedDB：学习记录和录音。

外部服务均为可选：

- MyMemory / LibreTranslate：免费机器翻译 fallback。
- DeepL：可选机器翻译。
- OpenAI-compatible chat completions endpoint：可选 AI 反馈增强。

没有 API key 时，本地规则诊断仍可使用。

## 测试

```bash
cd interpreter_v4
node tests/feedback-engine.test.mjs
node --check js/main.js
node --check js/components/TranscodingFeedbackEngine.js
node --check js/components/ExpertConversation.js
```

测试中会故意触发一次 AI fallback 警告，用来确认 AI 失败时本地诊断仍保留。

## 仓库结构

```text
.
├── interpret.md              # 中英转换训练专家规范
├── interpreter_v4/            # 当前主版本
├── interpreter_v3/            # 上一代模块化前端版本
├── interpreter_v2.html        # 早期单文件前端版本
├── integrated_ui.html         # V1 原型
├── src/Front-end/             # 早期前端副本和说明
├── uploads/                   # 预留目录
└── venv/                      # 历史 Python 虚拟环境
```

## 历史说明

早期 README 中的 Python / Gradio、`main.py`、`audio_engine.py`、`translate_engine.py`、`scoring_engine.py` 等拆分方案是课程项目初期计划，不再是当前主运行架构。若要演示或继续开发，请以 `interpreter_v4` 为准。
