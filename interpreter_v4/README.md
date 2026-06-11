# Interpreter V4

中英转换训练台。纯前端、零依赖、无构建步骤。

## Run

`interpreter_v4` 使用 ES modules 和 `fetch()` 加载本地 JSON，因此建议用本地 HTTP 服务打开：

```bash
cd interpreter_v4
python -m http.server 8084
```

然后用 Chrome 或 Edge 打开 `http://localhost:8084`。

## Structure

```text
index.html
styles/main.css
data/
  materials.json
  transcoding-rules.json
js/
  main.js
  components/
  services/
  storage/
tests/
  feedback-engine.test.mjs
```

## Notes

- 本地规则引擎始终可用，不依赖 API key。
- AI 反馈增强是可选项；失败时会回退到本地规则报告。
- API key 只存储在当前浏览器的 `localStorage` 中，前缀为 `int4_`。
- 学习记录和录音保存在 IndexedDB。

## Test

```bash
node tests/feedback-engine.test.mjs
```
