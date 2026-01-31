# 模块实现: AI 老师与解释系统 (AI Tutor)

## 1. 目标
提供一个交互式的 AI 讲解功能。当用户点击歌词中的句子或单词时，能够调用大语言模型（LLM）提供详细的语法、词义和文化背景解释。

## 2. 技术选型
- **API 调用**: `fetch` API 或 `axios`
- **UI**: React (弹出式面板或侧边栏)
- **状态管理**: Zustand (用于管理 API Key, Endpoint 等用户设置)

## 3. 组件设计

### 3.1 `<AITutorPanel />`
- **职责**:
    - 作为显示 AI 生成内容的容器。可以是模态框（Modal）、弹出框（Popover）或侧边栏（Sidebar）。
    - 管理自身的显示/隐藏状态。
    - 显示加载中（Loading）状态、错误（Error）状态和成功返回的内容。
- **Props**:
  ```typescript
  interface Props {
    targetText: string;   // 用户点击的单词或句子
    context: {
      previousLine?: string;
      nextLine?: string;
    };
    onClose: () => void;
  }
  ```

### 3.2 交互触发
- 在 `<LyricsDisplay />` 组件中，为每一个渲染的句子（`LyricLine`）和单词（`token`）包裹一个可点击的元素（如 `<span>`）。
- `onClick` 事件处理器会：
    1. 获取被点击的文本内容 (`targetText`)。
    2. 从 `lyrics` 数组中找到该句的前后句作为 `context`。
    3. 设置一个 state（例如 `selectedTextForAI`），触发 `<AITutorPanel />` 的显示和数据获取。

## 4. Prompt 设计与 API 调用

### 4.1 Prompt 构建
- 这是决定 AI 解释质量的关键。
- **角色设定**: "You are a senior Japanese language teacher explaining a part of a song's lyrics to a student."
- **任务指令**:
    - **对于句子**: "Explain the grammar, vocabulary, and any cultural nuances in the following Japanese sentence. The user clicked on this specific sentence."
    - **对于单词**: "Explain the meaning, usage, and conjugation (if applicable) of the Japanese word '{targetText}'. Provide an example sentence."
- **上下文提供**:
  ```
  Here is the context from the lyrics:
  Previous Line: {context.previousLine}
  Current Line: {targetText or the line containing it}
  Next Line: {context.nextLine}

  Please provide your explanation in {targetLanguage}.
  ```
  - `{targetLanguage}` 可以是中文或英文，根据用户设置决定。

### 4.2 API 调用流程
1.  从 `useSettingsStore` (Zustand) 中获取用户保存的 `baseUrl`, `apiKey`, `modelName`。
2.  检查这些设置是否存在。如果不存在，提示用户在设置页面中填写。
3.  构建符合 OpenAI-Compatible API 格式的请求体。
    ```json
    {
      "model": "user-configured-model-name",
      "messages": [
        { "role": "system", "content": "You are a senior Japanese language teacher..." },
        { "role": "user", "content": "..." } // 包含上下文和指令的 Prompt
      ],
      "stream": true // 推荐使用流式传输，以获得更好的用户体验
    }
    ```
4.  使用 `fetch` 发送 POST 请求。
5.  **流式处理**: 如果 `stream: true`，需要读取 `ReadableStream` 并逐步更新 UI，实现打字机效果。这可以显著降低用户的等待感。

## 5. 错误处理与用户体验
- **加载状态**: 在等待 API 响应时，显示一个骨架屏（Skeleton）或加载动画。
- **API 错误**: 如果 API Key 无效、网络错误或服务器返回错误，需要在面板中清晰地显示错误信息，并提供重试按钮。
- **空状态**: 如果用户没有设置 API Key，点击“AI 讲解”时应弹出一个提示，引导他们去设置页面。

## 6. 待办事项
- [ ] 创建 `<AITutorPanel />` 组件，包含加载、错误和内容显示逻辑。
- [ ] 在 `<LyricsDisplay />` 中为歌词文本添加 `onClick` 处理器。
- [ ] 实现 `prompt` 的动态构建逻辑。
- [ ] 实现调用 OpenAI-Compatible API 的服务函数。
- [ ] **重点**: 实现流式响应（streaming）的处理，以提供打字机输出效果。
- [ ] 从设置存储中读取 API 配置。
- [ ] 设计并实现引导用户设置 API Key 的交互流程。
