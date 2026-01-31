// src/hooks/useLyricsProcessor.ts
import { useState, useCallback, useEffect } from 'react';
import Kuroshiro from 'kuroshiro';
import KuroshiroManager from '@/lib/kuroshiro';
import { LyricLine, LyricToken } from '@/lib/mock-data';

// This is a simplified type for the WhisperX output
// Based on the whisperx documentation
interface WhisperXWord {
  word: string;
  start: number;
  end: number;
  score: number;
}

interface WhisperXSegment {
  start: number;
  end: number;
  text: string;
  words: WhisperXWord[];
}

export interface WhisperXOutput {
  segments: WhisperXSegment[];
  language: string;
}

const useLyricsProcessor = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kuroshiroInstance, setKuroshiroInstance] = useState<Kuroshiro | null>(null);

  useEffect(() => {
    // Initialize Kuroshiro only on the client side
    if (typeof window !== 'undefined' && !kuroshiroInstance) {
      KuroshiroManager.getInstance().then(instance => {
        setKuroshiroInstance(instance);
      }).catch(err => {
        console.error("Failed to initialize Kuroshiro:", err);
        setError("Failed to load Japanese text processor.");
      });
    }
  }, [kuroshiroInstance]);

  const processLyrics = useCallback(async (whisperData: WhisperXOutput): Promise<LyricLine[]> => {
    if (!kuroshiroInstance) {
      setError("Japanese text processor not initialized.");
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const lyricLines: LyricLine[] = [];

      for (const segment of whisperData.segments) {
        const tokens: LyricToken[] = [];
        
        // Use Promise.all to process tokens in parallel for each line
        await Promise.all(segment.words.map(async (word) => {
          const romaji = await kuroshiroInstance.convert(word.word, { to: 'romaji', mode: 'spaced' });
          const reading = await kuroshiroInstance.convert(word.word, { to: 'hiragana', mode: 'spaced' });

          tokens.push({
            surface: word.word,
            reading: reading,
            romaji: romaji,
            startTime: word.start,
            endTime: word.end,
            partOfSpeech: '', // WhisperX doesn't provide this, so it's left empty
          });
        }));
        
        // Sort tokens by start time as they might finish processing out of order
        tokens.sort((a, b) => a.startTime - b.startTime);

        lyricLines.push({
          id: `line-${segment.start}`,
          startTime: segment.start,
          endTime: segment.end,
          text: segment.text,
          tokens: tokens,
        });
      }

      setIsLoading(false);
      return lyricLines;
    } catch (err) {
      console.error("Error processing lyrics:", err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      setIsLoading(false);
      return [];
    }
  }, [kuroshiroInstance]);

  return { processLyrics, isLoading, error };
};

export default useLyricsProcessor;
