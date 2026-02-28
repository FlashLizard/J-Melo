import React, { useRef, useEffect, RefObject } from 'react';
import usePlayerStore from '@/stores/usePlayerStore'; // Ensure usePlayerStore is imported
import { playerStoreActions } from '@/stores/usePlayerStore';
import cn from 'classnames';
import Marquee from 'react-fast-marquee';

interface Props {
  mediaType: string;
  mediaUrl?: string;
  coverUrl: string; // Cover URL is always provided, even if placeholder
  title?: string;
  artist?: string | null;
}

const ScrollingText: React.FC<{ text: string, className?: string }> = ({ text, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [text]);

    return (
        <div ref={containerRef} className={cn("overflow-hidden whitespace-nowrap w-full", className)}>
            {isOverflowing ? (
                <Marquee speed={30} gradient={false} pauseOnHover>
                    <span className="pr-8">{text}</span>
                </Marquee>
            ) : (
                <span ref={textRef} className="inline-block truncate w-full">{text}</span>
            )}
        </div>
    );
};

const MediaDisplay: React.FC<Props> = ({ mediaType, mediaUrl, coverUrl, title, artist }) => {
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
        <video {...commonProps} ref={mediaRef as RefObject<HTMLVideoElement>} className="w-full h-full object-contain !block" /> // Ensure video is block when visible
      ) : (
        /* --- 音频模式：旋转唱片效果 --- */
        <div className="relative flex items-center justify-center w-full h-full bg-gray-900">
          <div className="relative w-[85vw] h-[85vw] max-w-[450px] max-h-[450px] sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full overflow-hidden shadow-lg flex items-center justify-center bg-gray-700">
            {coverUrl && (
              <img 
                src={coverUrl} 
                alt="Album Cover" 
                className="w-full h-full object-cover rounded-full"
                style={{ 
                    animation: isPlaying ? 'rotate 10s linear infinite' : 'none' 
                }}
              />
            )}
            {/* Vinyl record center hole */}
            <div className="absolute w-1/4 h-1/4 rounded-full bg-gray-900 flex items-center justify-center border-2 border-gray-600">
                <div className="w-1/2 h-1/2 rounded-full bg-blue-400"></div> {/* Inner label color */}
            </div>
          </div>
          
          {/* Audio 标签 (隐形，但负责发声) */}
          {mediaUrl && (
            <audio {...commonProps} ref={mediaRef as RefObject<HTMLAudioElement>} />
          )}
        </div>
      )}

      {/* Song Info Overlay - Visible in both modes */}
      {mediaUrl && (
        <div className="absolute bottom-8 left-0 right-0 text-center px-4 pointer-events-none z-10 w-full max-w-sm mx-auto flex flex-col items-center">
          <ScrollingText 
             text={title || "Unknown Title"} 
             className="text-xl font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" 
          />
          <ScrollingText 
             text={artist || "Unknown Artist"} 
             className="text-sm text-gray-300 mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" 
          />
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