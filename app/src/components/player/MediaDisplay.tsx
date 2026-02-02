import React, { useRef, useEffect } from 'react';
import usePlayerStore, { playerStoreActions } from '@/stores/usePlayerStore';

// ...

const MediaDisplay: React.FC<Props> = ({ mediaType, mediaUrl, coverUrl }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    console.log("MediaDisplay effect RUN. mediaUrl:", mediaUrl);
    if (mediaRef.current) {
      console.log("-> Setting media element:", mediaRef.current);
      playerStoreActions.setMediaElement(mediaRef.current);
    } else {
      // This might happen on the first render before the ref is attached
      console.log("-> mediaRef.current is null, setting store element to null.");
      playerStoreActions.setMediaElement(null);
    }

    return () => {
      console.log("MediaDisplay effect CLEANUP. Setting media element to null.");
      playerStoreActions.setMediaElement(null);
    };
  }, [mediaUrl]);

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