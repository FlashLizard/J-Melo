# 模块实现: 移动端适配 (Mobile Responsive)

## 1. 目标
确保 J-Melo 应用在不同尺寸的设备上（特别是手机）都能提供良好、可用的用户体验。布局和交互需要根据屏幕大小进行智能调整。

## 2. 技术选型
- **CSS 框架**: Tailwind CSS (利用其响应式断点 `sm`, `md`, `lg`, `xl`)
- **方法论**: Mobile-First Design (优先设计移动端布局，然后通过断点扩展到桌面端)

## 3. 布局设计

### 3.1 核心思想
- **移动端 (默认)**: 垂直布局是关键。屏幕空间有限，需要将核心内容垂直堆叠。
- **桌面端 (`lg:` 及以上)**: 水平空间充足，可以采用多列布局，同时展示更多信息。

### 3.2 主要页面/组件适配

#### 1. 播放器主界面 (`<PlayerContainer />`)
- **Mobile (`base` to `lg`)**:
    - **媒体区域**: 位于屏幕顶部，保持 16:9 的宽高比。
    - **歌词区域**: 位于媒体区域下方，占据剩余的主要屏幕空间，可垂直滚动。
    - **播放控件**: 作为**浮动条**固定在屏幕底部，始终可见，方便单手操作。
    - **生词本/AI面板**: 默认隐藏。通过按钮触发，以底部抽屉（Bottom Sheet）或全屏模态框（Full-screen Modal）的形式向上滑出。

- **Desktop (`lg:` and up)**:
    - **左侧面板 (固定宽度)**:
        - 顶部是媒体区域（视频或封面）。
        - 底部是播放控件。
    - **右侧面板 (占据剩余空间)**:
        - 可滚动的歌词列表。
        - [可选] 可以在右侧再分出一列，用于固定显示 AI Tutor 或生词本，形成三栏布局。

**Tailwind CSS 示例**:
```html
<div class="flex flex-col lg:flex-row h-screen">
  <!-- Left Panel (Desktop) / Top Area (Mobile) -->
  <div class="lg:w-1/3 lg:h-full">
    <div class="aspect-video bg-black">
      <!-- Video/Cover goes here -->
    </div>
    <!-- Desktop player controls (hidden on mobile) -->
    <div class="hidden lg:block">
      <!-- ... -->
    </div>
  </div>

  <!-- Right Panel (Desktop) / Bottom Area (Mobile) -->
  <div class="flex-1 overflow-y-auto">
    <!-- Lyrics go here -->
  </div>

  <!-- Floating Mobile Controls (only on mobile) -->
  <div class="fixed bottom-0 left-0 right-0 lg:hidden">
    <!-- ... -->
  </div>
</div>
```

#### 2. 设置页面 (`/settings`)
- **Mobile**: 单列表单，所有设置项垂直排列，标签（Label）在输入框上方。
- **Desktop**: 可以将表单分为两列，例如左边是 LLM 设置，右边是显示设置。

## 4. 交互调整

### 4.1 点击 vs. 长按
- **问题**: 在移动端，歌词是滚动的，用户在滚动时可能会误触单词的 `onClick` 事件，触发 AI 面板。
- **解决方案**:
    - 在移动端断点下，将触发 AI 面板或“添加到生词本”菜单的事件从 `onClick` 改为 `onLongPress` (长按)。
    - 可以使用 `framer-motion` 或自定义 hook 来简单地实现长按事件的检测（例如，监听 `onMouseDown`/`onTouchStart` 和 `onMouseUp`/`onTouchEnd` 之间的时间差）。

### 4.2 触摸区域
- 确保所有可点击的元素（按钮、开关、链接）在移动端都有足够大的触摸区域（建议至少 44x44px），以符合移动设备可用性标准。可以使用 padding 来扩大触摸目标而无需改变图标或文本的大小。

## 5. 测试
- **浏览器开发者工具**: 使用 Chrome 或 Firefox 的设备模拟器，测试不同预设的手机型号和屏幕尺寸。
- **真实设备**: 条件允许的情况下，在真实的 iOS 和 Android 设备上进行测试是至关重要的，因为模拟器无法完全复现触摸行为和性能。

## 6. 待办事项
- [ ] 采用 Mobile-First 的原则搭建所有核心页面的基础布局。
- [ ] 使用 Tailwind CSS 的响应式前缀（`lg:`, `md:`）来添加桌面端样式。
- [ ] 为播放器界面实现移动端和桌面端的不同布局结构。
- [ ] **重点**: 实现一个 `useLongPress` hook 或使用库来处理移动端的长按交互。
- [ ] 调整所有按钮和交互元素，确保在移动端有足够大的触摸区域。
- [ ] 在多种设备（模拟器和真实设备）上进行全面的响应式测试。
