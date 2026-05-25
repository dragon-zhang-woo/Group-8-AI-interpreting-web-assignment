# AI 口译训练平台 v3

中英文双向 AI 口译训练网站 — 纯前端、零依赖、模块化架构。

## 快速启动

```bash
cd interpreter_v3
python -m http.server 8000
```

然后用 Chrome 或 Edge 打开 `http://localhost:8000`。

> **为什么需要 HTTP 服务器？** 项目使用 ES 模块 (`type="module"`)，浏览器不允许 `file://` 协议加载模块。另外 Web Speech API 仅在 Chrome/Edge 中可用。

## 功能概览

三个标签页覆盖完整的口译训练流程：

| 标签 | 功能 |
|------|------|
| **AI 翻译机** | 文本输入或语音输入 → 中英双向翻译 → TTS 朗读 |
| **实战演练** | 随机抽取素材 → 录音翻译 → 三维度智能评分 + 雷达图 → 保存记录 |
| **学习记录** | 历史记录查看、详情、统计面板、CSV 导出、删除 |

## 技术架构

```
index.html              # 入口文件，Tailwind CSS CDN + 完整 HTML 骨架
styles/main.css         # 玻璃拟态设计系统、动画、响应式 (~1000 行)
js/
├── main.js             # App 引导、依赖注入、事件绑定
├── components/         # 业务逻辑组件
│   ├── AudioRecorder.js      # MediaRecorder 封装、计时器
│   ├── TranslationEngine.js  # 编排 STT → 翻译 → TTS 工作流
│   ├── ScoringEngine.js      # 三维度本地评分引擎
│   ├── MaterialLibrary.js    # 素材加载、随机抽取
│   ├── RecordManager.js      # 记录 CRUD、统计、CSV 导出
│   └── TabManager.js         # 标签页切换 + 状态保持
├── services/           # 可插拔 API 提供者
│   ├── STTService.js         # Web Speech API (预留 Whisper 接口)
│   ├── TranslationService.js # MyMemory + LibreTranslate 回退 (预留 DeepL 接口)
│   └── TTSService.js         # SpeechSynthesis API (预留 OpenAI TTS 接口)
├── storage/
│   ├── IndexedDBManager.js   # 音频 Blob + 学习记录持久化
│   └── LocalStorageManager.js # 配置、API 密钥、标签状态
└── utils/
    ├── ErrorHandler.js       # Toast 错误队列、自动消失
    ├── LoadingIndicator.js   # 全局 + 局部加载指示器
    ├── Validator.js          # 输入校验 + XSS 防护
    └── RadarChart.js         # Canvas 2D 雷达图
data/
└── materials.json      # 174 条中英双语练习素材
```

## 技术栈

| 层 | 技术 | 说明 |
|------|------|------|
| 结构 | HTML5 | 语义元素、浏览器 API |
| 样式 | Tailwind CSS v3 CDN + 自定义 CSS | 银蓝黑玻璃拟态 3D 设计系统 |
| 逻辑 | Vanilla JS ES 模块 | 零框架、零构建步骤 |
| 语音识别 | Web Speech API | Chrome/Edge 内置 |
| 翻译 | MyMemory + LibreTranslate 回退 | 免费、无需认证 |
| 语音合成 | SpeechSynthesis API | 浏览器内置 |
| 评分 | 本地评分引擎 | 同音字映射 + 填充词检测 + 加权语义相似度 |
| 存储 | IndexedDB + localStorage | 大容量音频 + 快速键值配置 |

## API 策略：可插拔提供者模式

每个 Service 导出多个提供者实现，根据 localStorage 中的 API 密钥自动选择：

- **无密钥** → 免费默认提供者（Web Speech、MyMemory、SpeechSynthesis）
- **有 OpenAI 密钥** → 自动切换到 Whisper STT + OpenAI TTS
- **有 DeepL 密钥** → 自动切换到 DeepL 翻译

配置 API 密钥：点击右下角齿轮图标 → 填入密钥 → 保存。

## 评分引擎

| 维度 (0-3) | 方法 |
|-------------|------|
| **发音标准性** | ~50 组中英同音字映射表 + 上下文窗口匹配 |
| **语言流畅性** | 填充词字典（嗯/啊/um/like）+ 连续重复检测 + 停顿分析 |
| **翻译准确性** | 加权 Jaccard (40%) + Bigram (60%) + 长度惩罚 + 关键词覆盖 |

## 设计系统

银蓝黑高科技玻璃拟态风格：

- 半透明玻璃材质：`rgba(15,23,42,0.68)` + `backdrop-filter: blur(44px)`
- 3D 立体层次：多层 `box-shadow` 模拟金属边框凸起
- `::before` 伪元素对角光扫 + `::after` 伪元素边缘高光
- 金属按钮：`linear-gradient(180deg, ...)` 凸起 + hover 抬升 + active 按入
- 凹陷输入框：`inset 0 2px 4px` 内阴影
- 彩色底栏渐变背景提供对比衬托

## 浏览器兼容性

- **Chrome / Edge**：完整支持
- **Firefox**：不支持 Web Speech API（语音功能不可用）
- **Safari**：SpeechRecognition 不支持
