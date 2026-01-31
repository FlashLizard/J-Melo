# 模块实现: 沉浸式播放器 (Immersive Player)

## 1. 目标
创建一个功能丰富、交互流畅的媒体播放器，能够同步显示视频/封面和卡拉OK风格的动态歌词。

## 2. 技术选型
- **UI 框架**: React, TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand (用于管理播放器状态，如播放/暂停、当前时间、总时长等)
- **动画**: `requestAnimationFrame`

## 3. 组件设计

### 3.1 `<PlayerContainer />` (主容器)
- **职责**: 整合视频/音频播放器和歌词显示区域，并根据屏幕尺寸应用不同的布局（桌面 vs. 移动）。
- **包含组件**: `<MediaDisplay />`, `<LyricsDisplay />`, `<PlayerControls />`。

### 3.2 `<MediaDisplay />` (媒体显示)
- **职责**:
    - 接收 `media_url` 和 `media_type`。
    - 如果 `media_type` 是 `video`，则渲染 `<video>` 元素。
    - 如果 `media_type` 是 `audio`，则渲染一个包含 `cover_url` 的 `<img>` 元素，并可以添加旋转动画或音频波形图效果。
- **关键**: `<video>` 或 `<audio>` 元素需要通过 `ref` 暴露给父组件，以便控制播放和监听事件。

### 3.3 `<LyricsDisplay />` (歌词显示)
- **Props**:
  ```typescript
  interface Props {
    lyrics: LyricLine[];
    currentTime: number; // 由 Zustand store 提供
  }
  ```
- **职责**:
    - 渲染 `LyricLine[]` 列表。
    - **当前行高亮**: 根据 `currentTime` 找到当前播放的**行** (`LyricLine`)，并为其添加特殊样式（如更大的字体、不同的颜色），同时将该行滚动到视图中央。
    - **字级高亮 (Karaoke Style)**:
        - 在当前行内，再次根据 `currentTime` 找到正在播放的**字** (`token`)。
        - 使用 CSS 渐变或伪元素（`::before`）来实现从左到右的颜色填充效果，填充的百分比根据 `(currentTime - token.startTime) / (token.endTime - token.startTime)` 计算。
        - 这个计算和样式更新需要在 `requestAnimationFrame` 循环中进行，以保证动画流畅。

### 3.4 `<PlayerControls />` (播放控件)
- **职责**: 提供播放/暂停按钮、进度条、音量控制和 AB 循环按钮。
- **进度条**:
    - `input[type=range]` 是一个不错的选择。
    - 其值应与播放器的 `currentTime` 双向绑定。
    - 用户拖动时，应暂停对 `currentTime` 的监听，拖动结束后再 `seek` 到新位置。
- **AB 循环**:
    - 提供两个按钮 "Set A" 和 "Set B"。
    - 用户点击后，记录下当前的 `currentTime` 作为 A点或 B点。
    - 在 `requestAnimationFrame` 循环中检查，如果 `currentTime` 超过 B点，则立即 `seek` 回 A点。

## 4. 状态管理 (Zustand Store)
创建一个 `usePlayerStore` 来全局管理播放器状态，避免不必要的 props drilling。
```typescript
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  pointA: number | null;
  pointB: number | null;
  actions: {
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    setABPoint: (type: 'A' | 'B') => void;
    // ... 其他 actions
  }
}
```
- React 组件通过这个 store 来获取状态和调用控制方法。
- 播放器 `ref` 的 `onTimeUpdate` 事件会频繁调用 `actions.setCurrentTime()` 来更新 `currentTime`。为了性能，可以使用 `requestAnimationFrame` 来节流更新。

## 5. 实现细节与挑战
- **性能优化**: `onTimeUpdate` 事件触发非常频繁。直接在事件回调中更新 React state 会导致大量重渲染。必须使用 `requestAnimationFrame` 来同步 `currentTime` 和 UI，并且只在必要时（如行或字改变时）才触发 React 的渲染。
- **精确同步**: 视频/音频的 `currentTime` 与歌词高亮之间的同步需要精确。`requestAnimationFrame` 是实现此目标的标准方法。
- **滚动逻辑**: 当前播放行自动滚动到视图中央需要计算元素位置和容器高度，可以使用 `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`。

## 6. 待办事项
- [ ] 创建 `usePlayerStore` (Zustand)。
- [ ] 实现 `<MediaDisplay />` 组件。
- [ ] 实现 `<PlayerControls />` 组件，包括进度条和按钮。
- [ ] **重点攻关**: 实现 `<LyricsDisplay />` 组件，特别是流畅的字级高亮动画。
- [ ] 实现 AB 循环的逻辑。
- [ ] 将所有组件整合到 `<PlayerContainer />` 中。
