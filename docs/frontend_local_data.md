# 前端本地数据

前端使用 Dexie 管理 IndexedDB，数据库名为 `JeloDB`。用户的核心数据默认留在浏览器本地，后端只在需要媒体、任务、社区或备份 token 时参与。

## 数据表

- `songs`：歌曲元数据、歌词、缓存状态、可选音频 Blob 和封面 Blob。
- `words`：词卡、读音、罗马音、来源歌曲、熟练度。
- `settings`：LLM、后端地址、语言、显示、主题、分享昵称等设置。
- `promptTemplates`：AI 释义 prompt 模板。
- `cardTemplates`：词卡模板。

关键类型仍是 `SongRecord`、`WordRecord`、`LyricLine`、`LyricToken`。重构只新增可选元数据，不改变语义。

## 设置优先级

后端地址的加载顺序：

1. IndexedDB 中用户已保存的设置。
2. `app/public/config.json` 中的部署默认值。
3. 代码默认值 `http://localhost:8000`。

这样同一份前端构建可以部署到不同服务器，用户也能在设置页覆盖。

## 导出与导入

导出 JSON 当前包含：

```json
{
  "version": 2,
  "exportedAt": "2026-05-22T00:00:00.000Z",
  "songs": [],
  "words": [],
  "settings": {},
  "promptTemplates": [],
  "cardTemplates": []
}
```

导出会去掉音频二进制缓存，保留可转换的封面数据和歌词词卡。导入器兼容旧版无 `version` 的对象，也兼容社区接口返回的 `songs`、`words` 数据。

导入模式：

- `overwrite`：清空本地表后写入导入数据。
- `merge`：按 `sourceUrl` 合并歌曲，按 `surface + sourceSongId` 合并词卡，设置和模板使用导入版本。

## 迁移

Dexie 版本迁移负责补齐历史字段，例如 `is_cached`、歌词 `translation`、LLM max tokens、分享昵称、主题和默认首页。升级代码后首次打开页面会自动执行迁移。
