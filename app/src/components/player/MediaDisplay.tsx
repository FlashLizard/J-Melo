import React, { useRef, useEffect } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';

interface Props {
  mediaType: 'video' | 'audio';
  mediaUrl?: string;
  coverUrl?: string;
}

const MediaDisplay: React.FC<Props> = ({ mediaType, mediaUrl, coverUrl }) => {
  // 使用 Ref 获取真实的 DOM 节点
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  
  // 从 Store 中只取 setMediaElement
  // 因为事件监听、播放状态改变、时间更新逻辑全都在 Store 的 setMediaElement 里定义好了
  const setMediaElement = usePlayerStore((state) => state.actions.setMediaElement);

  useEffect(() => {
    const element = mediaRef.current;
    
    // 1. 将 DOM 元素交给 Store
    // Store 会自动绑定 timeupdate, play, pause, ended 等事件
    // 并将 isPlaying 重置为 false
    if (element) {
      setMediaElement(element);
    }

    // 2. 清理函数
    return () => {
      // 组件卸载或 mediaUrl 改变时，告诉 Store 元素没了
      // Store 会自动移除 event listeners
      // 这里的 setMediaElement(null) 不会触碰 src 或 pause()，完美避开 AbortError
      setMediaElement(null);
    };
  }, [mediaUrl, mediaType, setMediaElement]); 
  // 注意：mediaUrl 变化时，React 会重新渲染，Ref 指向的元素 src 改变，
  // 触发 useEffect 重新注册，Store 会重置状态 (isPlaying: false, currentTime: 0)

  // 通用属性
  const commonProps = {
    ref: mediaRef,
    src: mediaUrl,
    controls: false, // 必须隐藏原生控件，否则状态会冲突
    preload: "metadata",
    className: mediaType === 'video' ? "w-full h-full object-contain" : "hidden" 
  };

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden group">
      {/* --- 视频模式 --- */}
      {mediaType === 'video' && mediaUrl ? (
        <video {...commonProps} className="w-full h-full" />
      ) : (
        /* --- 音频模式 --- */
        <div className="w-full h-full relative">
          {/* 封面图 */}
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className="w-full h-full object-cover opacity-80" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-900">
              <span className="text-sm">No Cover</span>
            </div>
          )}
          
          {/* Audio 标签 (隐形，但负责发声) */}
          {mediaUrl && (
            <audio {...commonProps} className="hidden" />
          )}
        </div>
      )}

      {/* 空状态提示 */}
      {!mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No Media Loaded
        </div>
      )}
    </div>
  );
};

export default MediaDisplay;