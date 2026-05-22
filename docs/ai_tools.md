# AI 工具

AI 能力集中在前端，默认请求 OpenAI 兼容的 Chat Completions 接口。用户可以在设置页分别配置释义、歌词校正和翻译使用的 API Key、URL、模型和 max tokens。

## 共享模块

- `src/lib/llmClient.ts`：统一请求 LLM，处理超时、HTTP 错误和响应格式。
- `src/lib/aiJson.ts`：从 LLM 回复中提取 fenced JSON 或 raw JSON，并校验歌词 JSON。
- `src/lib/backendClient.ts`：统一后端 URL 拼接、JSON 解析和错误封装。

## Prompt 预览

歌词校正、歌词翻译、无时间轴歌词导入等工具保留 Prompt 预览。用户可以复制 Prompt 到网页 LLM，再把 JSON 结果粘回 J-Melo。这对长歌词、慢接口或不想把 Key 存到浏览器的用户很有用。

## JSON 约束

歌词类 AI 输出必须能解析为 `LyricLine[]`。前端会接受：

```json
[
  {
    "startTime": 0,
    "endTime": 4.2,
    "text": "歌詞",
    "tokens": [],
    "translation": "翻译"
  }
]
```

如果 LLM 输出包含 Markdown 代码块，`aiJson` 会先提取代码块；如果没有代码块，则尝试直接解析全文。

## 失败处理

AI 输出不合法时，工具会显示错误并保留手动编辑入口。歌词最终仍以本地 Dexie 中保存的 JSON 为准，AI 只负责辅助生成或修正。
