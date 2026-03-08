import React, { useRef, useEffect, RefObject } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';
import { playerStoreActions } from '@/stores/usePlayerStore';
import cn from 'classnames';
import Marquee from 'react-fast-marquee';

interface Props {
  mediaType: string;
  mediaUrl?: string;
  coverUrl: string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isPlaying } = usePlayerStore();

  // Sync isPlaying state to the actual media element
  useEffect(() => {
    const media = mediaType === 'video' ? videoRef.current : playerStoreActions.getGlobalAudio();
    if (!media) return;

    if (isPlaying && media.paused) {
        media.play().catch(e => {
            console.warn("MediaDisplay: Auto-play sync failed", e);
        });
    } else if (!isPlaying && !media.paused) {
        media.pause();
    }
  }, [isPlaying, mediaType]);

  useEffect(() => {
    if (mediaType === 'video') {
        if (videoRef.current) {
            playerStoreActions.setMediaElement(videoRef.current);
            if (mediaUrl) videoRef.current.src = mediaUrl;
        }
    } else {
        const audio = playerStoreActions.getGlobalAudio();
        if (audio) {
            playerStoreActions.setMediaElement(audio);
            if (mediaUrl) {
                const targetUrl = new URL(mediaUrl, window.location.href).href;
                if (audio.src !== targetUrl) {
                    audio.src = mediaUrl;
                    audio.load();
                    if (isPlaying) {
                        audio.play().catch(e => console.warn("Initial load play failed", e));
                    }
                }
            }
        }
    }
  }, [mediaType, mediaUrl]);

  const rotationStyle = `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden group">
      <style>{rotationStyle}</style>

      {mediaType === 'video' ? (
        <video 
            ref={videoRef}
            src={mediaUrl}
            controls={false}
            preload="auto"
            playsInline
            className="w-full h-full object-contain block" 
        />
      ) : (
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
            <div className="absolute w-1/4 h-1/4 rounded-full bg-gray-900 flex items-center justify-center border-2 border-gray-600">
                <div className="w-1/2 h-1/2 rounded-full bg-blue-400"></div>
            </div>
          </div>
        </div>
      )}

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

      {!mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No Media Loaded
        </div>
      )}
    </div>
  );
};

export default MediaDisplay;
