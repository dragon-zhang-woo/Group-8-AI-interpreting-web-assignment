### 🧱 核心模块与架构解构
注意：环境采用venv虚拟环境

为了让 6 个人并行开发互不干扰，我们将项目拆分为 5 个独立的 Python 脚本模块，最后由你（组长）在 `main.py` 中进行拼装。

1. **UI & 路由 (`main.py`)**: 组长负责，用 `Gradio Blocks` 搭建三大 Tab（AI口译、实战演练、学习记录）。
2. **语音转换引擎 (`audio_engine.py`)**: 负责 STT（语音转文字）和 TTS（文字转语音）。
3. **翻译引擎 (`translate_engine.py`)**: 负责调用 LLM 进行纯文本的中英互译。
4. **AI 裁判引擎 (`scoring_engine.py`)**: 核心难点。由于大模型听不到声音，我们要**用 ASR 的识别结果来“欺骗” LLM 进行打分**。
5. **数据中心 (`data_manager.py`)**: 负责读写素材库（JSON 格式）和用户的学习记录（CSV 或 SQLite）。

---

### 👥 六人任务分配表 (每人每周专注一项)

| 队员 | 角色/职责 | 核心交付物 | 建议技术 |
| --- | --- | --- | --- |
| **你 (组长)** | **架构师 & UI 集成** | 建立 GitHub，分配任务，编写 `main.py` 整合所有人代码。 | `Gradio.Blocks`, Git |
| **Paul** | **语音工程师** | 编写 `audio_engine.py`。实现音频文件输入，输出文字；及文字输入，输出音频文件。 | 阿里 DashScope, `edge-tts` |
| **Sara** | **翻译与素材库** | 编写 `translate_engine.py` 进行高质翻译；在 `data_manager.py` 中写一个随机抽取素材的函数。 | 智谱 GLM-4 / DeepSeek V3, `json` |
| **David** | **Prompt 工程师 (裁判)** | 编写 `scoring_engine.py`。设计一段绝佳的 Prompt，让 LLM 根据原句和用户语音识别出的文本，给出 9 分制打分和评语。 | LLM Prompt Engineering |
| **Meg** | **数据库工程师** | 编写 `data_manager.py` 里的记录读写功能。把用户的每次练习、得分存入文件，并能读取展示。 | `pandas` 或 `sqlite3` |
| **队员 6** | **测试与云端部署** | 负责跑测试，找出报错（如没说话就提交导致的崩溃），并在最后一周部署到云端公网。 | ModelScope 创空间 / HuggingFace |

---

### 🗓️ 5 周极速开发流程 (每周 30-60 min)

#### **第 1 周：基础设施建设与 API 跑通 (Git Init)**

* **组长：** 在 GitHub 上新建仓库，创建好上述的 5 个 `.py` 空文件。写好 `README.md`，规定大家只在自己的文件里写代码。
* **全员：** 把代码 `git clone` 到本地。各自去申请负责模块的 API Key（阿里灵积、智谱等）。
* **目标：** 每个人在本地能用 Python 写一个最简单的 `print("hello")` 并成功 `git push` 到仓库。

#### **第 2 周：底层原子函数开发 (Core Functions)**

这是最关键的并行开发周。每个人只需要专注自己文件里的函数，**不要管界面**。

* **Paul:** 完成 `stt(audio_path)` 和 `tts(text)`。
* **Sara:** 完成 `translate(text, target_lang)` 和 `get_random_material()`。
* **David:** 完成打分逻辑 `evaluate_translation(original_text, user_audio_text)`，返回 `{"发音":3, "流畅":2, "准确":3, "评语":"..."}`。
* **Meg:** 完成 `save_record(data_dict)` 和 `get_all_records()`。

#### **第 3 周：Gradio UI 骨架搭建 (UI Prototype)**

* **组长主导：** 运用 Gradio Blocks 搭建界面。这周暂不连接真实的后台函数，只做界面布局。
* **Tab 1 - AI 翻译机：** 录音组件 -> 文本框(识别) -> 文本框(翻译) -> 音频播放器。
* **Tab 2 - 实战演练：** 点击“抽取素材” -> 显示英文 -> 录制我的翻译 -> 显示我的文字 -> 显示 3 维打分及雷达图。
* **Tab 3 - 学习记录：** 一个 `gr.Dataframe` 表格展示历史。



#### **第 4 周：全面拼装与大联调 (Integration)**

* **全员操作：** 组长把组员在第 2 周写好的原子函数，导入到第 3 周写好的 UI 骨架中。
* **示例逻辑 (实战演练 Tab)：**
用户点击提交录音 -> `Paul的stt` 获取文字 -> `David的打分函数` 分析 -> `Meg的保存函数` 记录 -> Gradio 界面更新得分。
* 大家开始互相测试，捕捉 Bug（比如中文乱码、API 超时）。

#### **第 5 周：打磨与一键部署 (Deployment)**

* **队员 6 主导：** 把写好的代码传到 ModelScope 创空间 或 HuggingFace Spaces。这些平台原生支持 Gradio，写一个 `requirements.txt` 就能一键部署，免费获得一个公网 URL 给老师看。
* **全员：** 补充素材库的 JSON 数据，优化页面的提示语，准备答辩或录制 Demo 视频。

---

### 💡 核心难点攻克：如何让 LLM 给发音和流畅度打分？

由于大模型（如 GLM-4）听不到用户的真实发音，David 在做 `scoring_engine.py` 时，需要利用**语音识别（STT）的容错特性**。

如果用户发音不准或不流畅，STT 会识别出同音错字、结巴（如“我我我”）、或者断句奇怪的标点。
David 的 Prompt 可以这样设计：

> "你是一个严格的口译老师。目标英文原句是：[A]。用户录音后，语音识别器得出的文本是：[B]。
> 请根据 [B] 进行打分（满分9分）：
> 1. 准确性(3分)：[B] 的意思是否准确传达了 [A]？
> 2. 流畅性(3分)：[B] 中是否有重复词、口语化卡顿（如‘那个’、‘额’）？
> 3. 发音标准性(3分)：[B] 中是否出现了明显的由于发音不准导致的同音错别字？
> 请返回 JSON 格式的打分结果和简短评语。"
> 
> 
