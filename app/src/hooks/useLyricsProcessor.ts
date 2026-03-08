// src/hooks/useLyricsProcessor.ts
import { useState, useEffect } from 'react';
import { WhisperXOutput } from '@/interfaces/lyrics';
import { processWhisperXOutput } from '@/utils/lyricsProcessor';

interface LyricsProcessorProps {
  whisperData: WhisperXOutput | null;
  onProcessed: (lyrics: any) => void;
}

const useLyricsProcessor = ({ whisperData, onProcessed }: LyricsProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!whisperData) return;

    const process = async () => {
      setIsProcessing(true);
      try {
        const processed = await processWhisperXOutput(whisperData);
        onProcessed(processed);
      } catch (error) {
        console.error("Failed to process lyrics:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    process();
  }, [whisperData]); // Removed onProcessed from dependencies to prevent infinite loops if not memoized

  return { isProcessing };
};

export default useLyricsProcessor;
