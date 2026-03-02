// app/src/utils/lyricsProcessor.ts
import { WhisperXOutput, LyricLine, LyricToken } from '@/interfaces/lyrics';
import Kuroshiro from 'kuroshiro';
import { v4 as uuidv4 } from 'uuid';

export const processWhisperXOutput = async (data: WhisperXOutput, kuroshiro: Kuroshiro): Promise<LyricLine[]> => {
    if (!data || !data.segments) return [];

    const lines: LyricLine[] = await Promise.all(data.segments.map(async (segment) => {
        const tokens: LyricToken[] = await Promise.all(segment.words.map(async (word) => {
            const reading = await kuroshiro.convert(word.word, { to: 'hiragana', mode: 'spaced' });
            return {
                surface: word.word,
                reading: reading,
                startTime: Number(word.start.toFixed(2)),
                endTime: Number(word.end.toFixed(2)),
            };
        }));

        return {
            id: uuidv4(),
            startTime: Number(segment.start.toFixed(2)),
            endTime: Number(segment.end.toFixed(2)),
            text: segment.text.trim(),
            tokens: tokens,
            translation: '',
        };
    }));

    return lines;
};

/**
 * Ensures all time-related fields in the lyrics array are rounded to 2 decimal places.
 */
export const formatLyricTimings = (lines: LyricLine[]): LyricLine[] => {
    if (!lines) return [];
    return lines.map(line => ({
        ...line,
        startTime: typeof line.startTime === 'number' ? Number(line.startTime.toFixed(2)) : line.startTime,
        endTime: typeof line.endTime === 'number' ? Number(line.endTime.toFixed(2)) : line.endTime,
        tokens: line.tokens ? line.tokens.map(token => ({
            ...token,
            startTime: typeof token.startTime === 'number' ? Number(token.startTime.toFixed(2)) : token.startTime,
            endTime: typeof token.endTime === 'number' ? Number(token.endTime.toFixed(2)) : token.endTime,
        })) : []
    }));
};
