// src/hooks/useLyricsProcessor.ts
import { useState, useEffect } from 'react';
import Kuroshiro from 'kuroshiro';
import KuroshiroManager from '@/lib/kuroshiro';
import { LyricLine, LyricToken } from '@/lib/mock-data';

export interface WhisperXWord {
  word: string;
  start: number;
  end: number;
  score: number;
}
export interface WhisperXSegment {
  start: number;
  end: number;
  text: string;
  words: WhisperXWord[];
}
export interface WhisperXOutput {
  segments: WhisperXSegment[];
  language: string;
}

interface LyricsProcessorProps {
  whisperData: WhisperXOutput | null;
  onProcessed: (lyrics: LyricLine[]) => void;
}

const useLyricsProcessor = ({ whisperData, onProcessed }: LyricsProcessorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kuroshiro, setKuroshiro] = useState<Kuroshiro | null>(null);

  useEffect(() => {
    KuroshiroManager.getInstance().then(setKuroshiro).catch(() => setError("Failed to load processor."));
  }, []);

  useEffect(() => {
    if (!whisperData || !kuroshiro) return;

    const process = async () => {
      setIsProcessing(true);
      setError(null);
      try {
        const lyricLines: LyricLine[] = await Promise.all(whisperData.segments.map(async (segment) => {
          const tokens: LyricToken[] = await Promise.all(segment.words.map(async (word) => {
            const romaji = await kuroshiro.convert(word.word, { to: 'romaji', mode: 'spaced' });
            const reading = await kuroshiro.convert(word.word, { to: 'hiragana', mode: 'spaced' });
            return {
              surface: word.word,
              reading,
              romaji,
              startTime: word.start,
              endTime: word.end,
              partOfSpeech: '',
            };
          }));
          tokens.sort((a, b) => a.startTime - b.startTime);
          return {
            id: `line-${segment.start}`,
            startTime: segment.start,
            endTime: segment.end,
            text: segment.text,
            tokens,
          };
        }));
        onProcessed(lyricLines);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred during processing.");
      } finally {
        setIsProcessing(false);
      }
    };

    process();
  }, [whisperData, kuroshiro, onProcessed]);

  return { isProcessing, error };
};

export default useLyricsProcessor;
