# 社区与后台

社区功能面向自托管小圈子，不做完整账号体系。分享者用昵称标识自己的内容，管理员用后端 token 管理缓存和社区数据。

## 社区库

后端使用 `shared_songs.db`，表 `shared_songs` 保存：

- 标题、歌手、分享昵称、创建时间。
- 歌曲 JSON 和词卡 JSON。
- 可选封面 Blob。

启动时自动创建索引：

- `idx_shared_songs_created`
- `idx_shared_songs_sharer`
- `idx_shared_songs_title_artist`

上传前会检查单次 payload 大小和社区数据库总配额。

## 社区 API

- `POST /api/community/share`：分享歌曲。
- `GET /api/community/songs`：搜索和分页列表。
- `GET /api/community/songs/{song_id}`：下载歌曲和词卡数据。
- `DELETE /api/community/songs/{song_id}?sharer_name=...`：分享者删除。
- `GET /api/community/songs/{song_id}/cover`：读取封面。

## 导入冲突

前端从社区导入时会与本地歌曲库比对。若检测到重复歌曲，用户可以选择保留现有、覆盖或合并词卡，避免静默覆盖本地修改。

## 后台

后台接口使用 Bearer token，token 来自 `backend/config.json` 的 `admin_token`。

管理员可以：

- 查看媒体、转录、临时文件和社区库占用。
- 清理指定缓存。
- 更新缓存策略、CORS、模型名和上传限制。
- 查看转录任务。
- 强制删除社区歌曲。

公网部署时请使用 HTTPS，并设置足够长的 `admin_token`。
