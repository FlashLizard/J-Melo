// src/hooks/useLyricsProcessor.ts
import { useState, useEffect } from 'react';
import { WhisperXOutput } from '@/interfaces/lyrics';
import KuroshiroManager from '@/lib/kuroshiro';
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
        const kuroshiro = await KuroshiroManager.getInstance();
        const processed = await processWhisperXOutput(whisperData, kuroshiro);
        onProcessed(processed);
      } catch (error) {
        console.error("Failed to process lyrics:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    process();
  }, [whisperData, onProcessed]);

  return { isProcessing };
};

export default useLyricsProcessor;
