# 🎤 AI 口译练习网站 - 完整版

> 一个功能完整的中英翻译训练平台，支持AI翻译、用户翻译评分和学习记录

## ✨ 核心功能

### 1. 📖 AI 翻译机
- **文本翻译**：支持英文→中文、中文→英文
- **语音输入**：实时录音或上传音频文件
- **语音识别**：自动转换为文字
- **智能翻译**：AI驱动的文本翻译
- **音频输出**：生成翻译结果的语音

### 2. 💪 实战演练 - 用户翻译模式
- **选择材料**：多难度的练习材料
- **录制翻译**：用户用中文录制自己的翻译
- **自动评分**：3维度智能评分系统
  - 📊 发音标准性 (0-3分)
  - 📊 语言流畅性 (0-3分)
  - 📊 翻译准确性 (0-3分)
- **智能反馈**：个性化的改进建议

### 3. 📊 学习记录
- 练习统计面板
- 历史记录表
- 详情查看
- 数据持久化

## 🚀 快速开始

### 1. 环境设置

```bash
# 克隆项目
cd Group-8-AI-interpreting-web-assignment

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置 .env 文件

创建 `.env` 文件并配置API密钥（可选，支持离线模式）：

```
# 可选：阿里云 SenseVoice API（用于语音识别）
DASHSCOPE_API_KEY=your_api_key_here

# 可选：Google Translate API（用于在线翻译）
GOOGLE_TRANSLATE_API_KEY=your_api_key_here

# 可选：百度翻译 API
BAIDU_APPID=your_appid
BAIDU_SECRET_KEY=your_secret_key
```

**注意**：所有API都是可选的，系统支持完全离线工作模式

### 3. 启动服务

#### 方式一：启动后端服务

```bash
# 启动 Flask 后端服务
python app.py
```

服务将在 `http://localhost:5000` 启动

#### 方式二：仅使用前端HTML

无需启动后端，直接在浏览器打开：

```bash
# 直接打开 HTML 文件
integrated_ui.html  # 完整版前端（需要后端）
preview.html        # 原始版本（仅前端功能）
```

## 📁 项目文件结构

```
.
├── app.py                       # Flask 后端主文件 ⭐
├── integrated_ui.html           # 统一前端 HTML ⭐
├── audio_engine.py              # 音频处理引擎
├── translate_engine.py          # 翻译引擎
├── scoring_engine.py            # 评分引擎（包装器）
├── scoring_engine_impl.py       # 评分引擎实现 ⭐
├── data_manager.py              # 数据管理
├── materials.json               # 练习材料库
├── records.csv                  # 学习记录
├── requirements.txt             # Python 依赖
└── README.md                    # 本文档
```

## 🎯 API 端点

### 翻译接口
```
POST /api/translate
Content-Type: application/json

{
    "text": "Hello world",
    "source_lang": "en",
    "target_lang": "zh"
}

Response:
{
    "success": true,
    "source_text": "Hello world",
    "translated_text": "你好世界",
    "source_lang": "en",
    "target_lang": "zh"
}
```

### 语音识别
```
POST /api/speech-to-text
Content-Type: multipart/form-data

Parameters:
- audio: <audio file>
- language: en/zh

Response:
{
    "success": true,
    "text": "Recognized text",
    "language": "en"
}
```

### 文字转语音
```
POST /api/text-to-speech
Content-Type: application/json

{
    "text": "你好",
    "language": "zh-CN"
}

Response: (audio/wav binary)
```

### 评分接口
```
POST /api/score
Content-Type: application/json

{
    "original_text": "Hello",
    "user_translation": "你好",
    "reference_translation": "你好",
    "source_lang": "en",
    "target_lang": "zh"
}

Response:
{
    "success": true,
    "pronunciation_score": 3,
    "fluency_score": 2,
    "accuracy_score": 3,
    "total_score": 2.67,
    "feedback": "表现良好...",
    "suggestions": ["...", "..."]
}
```

### 保存记录
```
POST /api/save-record
Content-Type: application/json

{
    "original_text": "Hello",
    "user_translation": "你好",
    "scores": {
        "发音": 3,
        "流畅": 2,
        "准确": 3,
        "评语": "..."
    }
}

Response:
{
    "success": true,
    "message": "记录保存成功！",
    "timestamp": "2026-05-15T12:00:00"
}
```

### 获取记录
```
GET /api/records

Response:
{
    "success": true,
    "records": [...],
    "count": 5
}
```

### 获取练习材料
```
GET /api/material

Response:
{
    "success": true,
    "material": "Welcome to the school..."
}
```

## 📊 评分系统详解

### 3维度评分维度

| 维度 | 分值 | 评估标准 |
|-----|------|---------|
| 发音标准性 | 0-3 | 发音清晰度、用词规范性 |
| 语言流畅性 | 0-3 | 表达自然度、逻辑连接 |
| 翻译准确性 | 0-3 | 与参考翻译的相似度 |
| **总分** | 0-3 | 三项平均值 |

### 评分等级

| 总分 | 等级 | 评语 |
|------|------|------|
| ≥ 2.7 | ⭐⭐⭐ | 表现优秀 |
| ≥ 2.3 | ⭐⭐ | 表现良好 |
| ≥ 1.7 | ⭐ | 表现一般 |
| ≥ 1.0 | · | 需要改进 |
| < 1.0 | 。 | 表现较差 |

## 🔧 技术栈

### 后端
- **Flask** - Web 框架
- **Python 3.8+** - 运行环境
- **edge-tts** - 文字转语音（无需API）
- **requests** - HTTP 请求

### 前端
- **HTML5** - 语义化标记
- **CSS3** - 响应式设计
- **Vanilla JavaScript** - 无依赖

### 浏览器 API
- 🎤 **Web Speech API** - 语音识别与合成
- 🎙️ **Media Recorder API** - 音频录制
- 📁 **File API** - 文件处理
- 💾 **LocalStorage API** - 本地存储

## 📱 浏览器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| 文本翻译 | ✅ | ✅ | ✅ | ✅ |
| 语音识别 | ✅ | ✅ | ✅ | ✅ |
| 语音合成 | ✅ | ✅ | ✅ | ✅ |
| 音频录制 | ✅ | ✅ | ✅ | ✅ |

## ⚙️ 离线模式

系统支持完全离线使用！如果没有配置API密钥：

- **翻译**：使用本地翻译字典
- **语音识别**：返回演示文本
- **文字转语音**：使用 edge-tts（无需网络）
- **评分**：使用本地算法

## 🎓 使用示例

### 场景 1：在线翻译
1. 打开 `integrated_ui.html`
2. 进入"AI 翻译机"标签页
3. 选择翻译方向（英→中或中→英）
4. 输入或录制文本
5. 点击"翻译"获得结果
6. 点击"播放"听翻译

### 场景 2：实战演练
1. 进入"实战演练"标签页
2. 选择练习难度
3. 查看英文原文和参考翻译
4. 点击"开始录音"录制你的翻译
5. 系统自动识别并评分
6. 查看评分和改进建议
7. 保存记录到学习统计

### 场景 3：学习记录
1. 进入"学习记录"标签页
2. 查看练习统计（次数、平均分、最高分）
3. 浏览历史记录表
4. 点击"查看"查看详细信息

## 📝 项目改进说明

本次迭代主要改进：

1. **完整后端整合**
   - ✅ Flask API 服务
   - ✅ 6个主要API端点
   - ✅ 完整的错误处理

2. **前端UI统一**
   - ✅ 三标签页设计
   - ✅ 响应式布局
   - ✅ 实时反馈

3. **评分系统升级**
   - ✅ 3维度评分（发音、流畅、准确）
   - ✅ 智能算法（相似度计算、词频分析）
   - ✅ 个性化反馈

4. **数据持久化**
   - ✅ SQLite 记录存储
   - ✅ CSV 导出
   - ✅ LocalStorage 前端缓存

## 🐛 常见问题

### Q: 无法识别语音？
A: 确保浏览器已授予麦克风权限，或配置 DASHSCOPE_API_KEY

### Q: 翻译不准确？
A: 本地翻译字典有限，建议配置在线API或输入字典中的常用短语

### Q: 如何导出学习记录？
A: 学习记录自动保存在 `records.csv` 文件中

### Q: 支持离线使用吗？
A: 完全支持！所有功能都可以在没有网络的情况下工作（仅使用本地功能）

## 📞 技术支持

如有问题，请检查：

1. **Python 版本** >= 3.8
2. **依赖安装** `pip install -r requirements.txt`
3. **浏览器**最新版 Chrome/Firefox/Safari/Edge
4. **网络连接**（如使用在线API）

## 📄 许可证

本项目为教学演示项目。

---

**版本**: 2.0  
**最后更新**: 2026年5月15日  
**开发者**: Group 8 AI 口译项目组
