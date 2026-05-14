🎙️ AI Interpreter (AI 口译实战与评测平台)

🚀 本项目是由六人小组基于极限敏捷开发模式（5周极速交付）打造的 AI 口译训练平台。结合了大语言模型（LLM）、语音识别（STT）和语音合成（TTS）技术，旨在为用户提供沉浸式的中英口译训练与 AI 智能打分体验。

📑 目录 (Table of Contents)

✨ 核心功能

🛠️ 技术栈

👥 团队分工 & 模块结构

🚀 快速启动指南 (Quick Start)

🤝 开发与协作规范 (必读)

✨ 核心功能

🔄 极速双向翻译 (AI 翻译机)

支持文字输入或语音录入。

自动识别并输出地道的中文/英文翻译文本。

自动生成目标语言的高质量语音播报。

🤺 实战演练与 AI 裁判

🎲 素材拉取：内置 materials.json 素材库，随机抽取不同难度的中英文段落进行训练。

🎤 实机录音：用户针对抽取的英文原句，录制自己的中文口译音频。

⚖️ 多维度智能评分：

发音标准性（3分）：识别同音错字与发音缺陷。

语言流畅性（3分）：检测卡顿、重复与冗余词汇。

翻译准确性（3分）：评估语义还原度。

📝 综合点评：AI 根据具体表现生成针对性的改进建议。

📈 学习记录数据看板

自动保存用户的每次实战录音打分数据至本地 records.csv。

提供可视化的数据表格，随时追踪口译能力的成长轨迹。

🛠️ 技术栈

本项目采用“低代码、高产出”的纯 Python 架构，极具轻量化：

前端与路由管理: Gradio (纯 Python 渲染交互界面与音视频流)

语音转文本 (STT): 阿里灵积 DashScope (Paraformer API)

文本翻译与裁判 (LLM): 智谱 GLM-4 / DeepSeek API

文本转语音 (TTS): edge-tts (微软官方引擎，自然流畅)

数据持久化: JSON (素材库) + CSV (学习记录)

👥 团队分工 & 模块结构

为保证每周 30-60 分钟的高效协同，代码按模块进行物理隔离。

模块文件

负责人

核心职责

main.py

组长

UI 组装、路由配置、Gradio Blocks 架构集成

audio_engine.py

Paul

接入 STT API (语音转字) 与 TTS (字转语音) 功能

translate_engine.py

Sara

接入 LLM 翻译接口，编写高质量翻译 Prompt

scoring_engine.py

David

核心裁判逻辑，校验 STT 文本，输出 9 分制 JSON

data_manager.py

Meg

读写 materials.json 和 records.csv

运维与测试部署

队员 6

全局 Bug 追踪，ModelScope 创空间云端部署

🚀 快速启动指南 (Quick Start)

1. 克隆仓库

git clone https://github.com/你的用户名/ai-interpreter.git
cd ai-interpreter


2. 安装依赖环境

建议使用 Python 3.9+。

pip install gradio dashscope zhipuai edge-tts pandas


3. 配置 API 密钥

在项目根目录新建一个 .env 文件（请勿提交到 Git），填入你们申请到的 API Keys：

DASHSCOPE_API_KEY=你的阿里灵积API密钥
ZHIPU_API_KEY=你的智谱API密钥


4. 初始化数据文件

确保根目录下存在以下两个文件（如果 data_manager.py 已运行则自动生成）：

materials.json（内含至少一条测试数据）

records.csv

5. 运行项目

python main.py


终端会输出一个本地链接（如 http://127.0.0.1:7860），在浏览器中打开即可开始体验！

🤝 开发与协作规范 (必读)

绝对隔离：请只修改你负责的 .py 文件，不要碰别人的文件，更不要直接修改 main.py（除非你是组长）。

及时提交：每次完成一个小函数的测试后，立刻 git add . -> git commit -m "功能描述" -> git push。

遇到报错：如果你的模块在本地跑不通，可以先写一个 return 假数据（Mock 数据）的兜底方案，不要阻塞组长在 main.py 里的集成进度。

“Done is better than perfect. 先跑通，再完美！”
