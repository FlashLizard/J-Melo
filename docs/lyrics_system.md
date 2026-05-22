# 歌词系统

J-Melo 的歌词格式以 `LyricLine[]` 为核心，每行包含时间、原文、token 和可选翻译。token 内保留表面词、读音、罗马音和词级时间。

```ts
interface LyricLine {
  startTime: number;
  endTime: number;
  text: string;
  tokens: LyricToken[];
  translation?: string;
}
```

## 获取路径

- 语音转录：后端 `faster-whisper` 生成带时间轴的初稿。
- PetitLyrics：通过搜索结果 ID 抓取带时间轴歌词。
- Utaten：抓取带注音文本，再解析为 token。
- 无时间轴导入：用户粘贴歌词，前端用 LLM 或解析器生成 `LyricLine[]`。
- 歌词对齐：后端 `stable-ts` 根据已有歌词和音频重新对齐时间。

## 编辑能力

前端保留三类编辑入口：

- 句子编辑：修改单行文本、时间、翻译和 token。
- 完整 JSON 编辑：高级用户直接编辑歌词结构。
- 对齐和校正工具：AI 或后端任务批量调整歌词。

## 注音

后端使用 SudachiPy 做日语分词和读音标注。Utaten 的 `漢字[かな]` 形式会被解析成 token，不再依赖 Kuroshiro/kuromoji。

## 缓存

转录结果写入 `backend/transcription_cache/{media_id}.json`。旧状态接口会先检查缓存文件，因此已经完成的歌曲不会重复排队，除非请求中设置强制重转录。
