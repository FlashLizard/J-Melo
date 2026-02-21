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
                startTime: word.start,
                endTime: word.end,
            };
        }));

        return {
            id: uuidv4(),
            startTime: segment.start,
            endTime: segment.end,
            text: segment.text.trim(),
            tokens: tokens,
            translation: '',
        };
    }));

    return lines;
};
