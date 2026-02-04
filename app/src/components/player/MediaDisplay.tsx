import React, { useRef, useEffect } from 'react';
import usePlayerStore from '@/stores/usePlayerStore'; // Ensure usePlayerStore is imported
import { playerStoreActions } from '@/stores/usePlayerStore';
import cn from 'classnames';

interface Props {
  mediaType: string;
  mediaUrl?: string;
  coverUrl: string; // Cover URL is always provided, even if placeholder
}

const MediaDisplay: React.FC<Props> = ({ mediaType, mediaUrl, coverUrl }) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const { isPlaying } = usePlayerStore(); // Get isPlaying state

  useEffect(() => {
    if (mediaRef.current) {
      playerStoreActions.setMediaElement(mediaRef.current);
    } else {
      playerStoreActions.setMediaElement(null);
    }

    return () => {
      playerStoreActions.setMediaElement(null);
    };
  }, [mediaUrl]);

  // Define the rotation animation directly within the component
  const rotationStyle = `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  // 通用属性
  const commonProps = {
    ref: mediaRef,
    src: mediaUrl,
    controls: false, // 必须隐藏原生控件，否则状态会冲突
    preload: "metadata",
    className: "hidden" // Always hidden, as UI controls it
  };

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden group">
      <style>{rotationStyle}</style> {/* Inject rotation CSS */}

      {/* --- 视频模式 --- */}
      {mediaType === 'video' && mediaUrl ? (
        <video {...commonProps} className="w-full h-full object-contain !block" /> // Ensure video is block when visible
      ) : (
        /* --- 音频模式：旋转唱片效果 --- */
        <div className="relative flex items-center justify-center w-full h-full bg-gray-900">
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-gray-700">
            {coverUrl && (
              <img 
                src={coverUrl} 
                alt="Album Cover" 
                className={cn(
                  "w-full h-full object-cover rounded-full",
                  { 'animate-spin-slow': isPlaying } // Apply rotation based on isPlaying
                )}
                style={{ animationDuration: '10s' }} // Adjust speed if needed
              />
            )}
            {/* Vinyl record center hole */}
            <div className="absolute w-1/4 h-1/4 rounded-full bg-gray-900 flex items-center justify-center border-2 border-gray-600">
                <div className="w-1/2 h-1/2 rounded-full bg-blue-400"></div> {/* Inner label color */}
            </div>
          </div>
          
          {/* Audio 标签 (隐形，但负责发声) */}
          {mediaUrl && (
            <audio {...commonProps} />
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