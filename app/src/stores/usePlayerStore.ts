// src/stores/usePlayerStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// 接口定义不变
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  actions: {
    setMediaElement: (element: HTMLAudioElement | HTMLVideoElement | null) => void;
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    togglePlay: () => void;
    setLoopA: () => void;
    setLoopB: () => void;
    clearLoop: () => void;
  };
}

const usePlayerStore = create<PlayerState>()(
  devtools(
    (set, get) => {
      // 内部变量，用于存储 DOM 引用，这部分保持不变
      let _mediaElement: HTMLAudioElement | HTMLVideoElement | null = null;

      // ✅ 核心修复：将事件处理函数直接定义在 create 的作用域内
      // 它们会捕获到被 devtools 包装过的 set 和 get
      const handlePlay = () => set({ isPlaying: true });
      const handlePause = () => set({ isPlaying: false });
      const handleEnded = () => set({ isPlaying: false });
      
      const handleLoadedMetadata = () => {
        if (_mediaElement) {
          set({ duration: _mediaElement.duration });
        }
      };

      const handleTimeUpdate = () => {
        if (_mediaElement) {
          const { loopA, loopB } = get();
          const newTime = _mediaElement.currentTime;
          
          if (loopA !== null && loopB !== null && newTime >= loopB) {
            _mediaElement.currentTime = loopA;
            // 确保循环时也更新状态
            set({ currentTime: loopA }); 
          } else {
            set({ currentTime: newTime });
          }
        }
      };

      return {
        // 初始状态
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        loopA: null,
        loopB: null,
        
        actions: {
          setMediaElement: (element) => {
            // 清理旧的监听器
            if (_mediaElement) {
              _mediaElement.removeEventListener('play', handlePlay);
              _mediaElement.removeEventListener('pause', handlePause);
              _mediaElement.removeEventListener('ended', handleEnded);
              _mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
              _mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
            }

            // 更新引用并重置状态
            _mediaElement = element;
            set({ isPlaying: false, currentTime: 0, duration: 0 });

            // 绑定新的监听器，使用在上面定义的、能访问正确`set`的函数
            if (element) {
              element.addEventListener('play', handlePlay);
              element.addEventListener('pause', handlePause);
              element.addEventListener('ended', handleEnded);
              element.addEventListener('loadedmetadata', handleLoadedMetadata);
              element.addEventListener('timeupdate', handleTimeUpdate);
            }
          },
          // 其他 actions 保持不变
          play: () => _mediaElement?.play(),
          pause: () => _mediaElement?.pause(),
          togglePlay: () => {
            if (!_mediaElement) return;
            get().isPlaying ? _mediaElement.pause() : _mediaElement.play();
          },
          seek: (time) => {
            if (_mediaElement) _mediaElement.currentTime = time;
          },
          setLoopA: () => set({ loopA: get().currentTime, loopB: null }),
          setLoopB: () => {
            const { currentTime, loopA } = get();
            if (loopA !== null && currentTime > loopA) {
              set({ loopB: currentTime });
            }
          },
          clearLoop: () => set({ loopA: null, loopB: null }),
        },
      };
    },
    { name: 'PlayerStore' }
  )
);

export default usePlayerStore;