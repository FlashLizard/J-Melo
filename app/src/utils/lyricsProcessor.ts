// app/src/utils/lyricsProcessor.ts
import { WhisperXOutput, LyricLine, LyricToken } from '@/interfaces/lyrics';
import { v4 as uuidv4 } from 'uuid';

export const processWhisperXOutput = async (data: WhisperXOutput): Promise<LyricLine[]> => {
    if (!data || !data.segments) return [];

    const lines: LyricLine[] = data.segments.map((segment) => {
        const tokens: LyricToken[] = segment.words.map((word) => {
            return {
                surface: word.word,
                reading: (word as any).reading || word.word, // Use backend reading if available
                startTime: Number(word.start.toFixed(2)),
                endTime: Number(word.end.toFixed(2)),
            };
        });

        return {
            id: uuidv4(),
            startTime: Number(segment.start.toFixed(2)),
            endTime: Number(segment.end.toFixed(2)),
            text: segment.text.trim(),
            tokens: tokens,
            translation: '',
        };
    });

    return lines;
};

/**
 * Helper to identify the script type of a character.
 */
const getScriptType = (char: string) => {
    const code = char.charCodeAt(0);
    // Kanji (Han Ideographs) and iteration marks
    if ((code >= 0x4e00 && code <= 0x9faf) || code === 0x3005) return 'kanji';
    // Hiragana
    if (code >= 0x3040 && code <= 0x309f) return 'hiragana';
    // Katakana and long vowel marks
    if ((code >= 0x30a0 && code <= 0x30ff) || code === 0x30fc) return 'katakana';
    // Latin letters and numbers
    if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a) || (code >= 0x0030 && code <= 0x0039)) return 'romaji-num';
    // Whitespace
    if (code === 0x0020 || code === 0x3000 || code === 0x0009) return 'space';
    return 'other';
};

/**
 * Parses plain text with furigana in the format "Kanji[reading]" into LyricLine array.
 * This is particularly useful for Utaten lyrics.
 * Splits tokens by character type to prevent merging (e.g., "あの日[ひ]" -> "あの", "日[ひ]").
 */
export const parseFuriganaText = (text: string): LyricLine[] => {
    if (!text) return [];
    
    const lines = text.split('\n');
    return lines.map(line => {
        const tokens: LyricToken[] = [];
        let i = 0;
        
        while (i < line.length) {
            let surface = "";
            let reading = "";
            
            const firstChar = line[i];
            const currentType = getScriptType(firstChar);

            // 1. Build a segment of the same character type
            let j = i;
            while (j < line.length) {
                const char = line[j];
                // Stop if we hit a bracket or a change in script type
                if (char === '[' || char === ']' || getScriptType(char) !== currentType) {
                    break;
                }
                surface += char;
                j++;
            }

            // 2. Check if a furigana bracket immediately follows this segment
            if (j < line.length && line[j] === '[') {
                let k = j + 1;
                let bracketContent = "";
                while (k < line.length && line[k] !== ']') {
                    bracketContent += line[k];
                    k++;
                }
                
                if (k < line.length && line[k] === ']') {
                    // Valid bracket!
                    reading = bracketContent;
                    i = k + 1; // Move pointer past the ']'
                } else {
                    // Malformed bracket, treat '[' as a normal char in the next loop
                    reading = surface;
                    i = j; 
                }
            } else {
                // No bracket follows, reading is the same as surface
                reading = surface;
                i = j;
            }

            if (surface) {
                tokens.push({
                    surface,
                    reading,
                    startTime: 0,
                    endTime: 0
                });
            } else if (i < line.length && (line[i] === '[' || line[i] === ']')) {
                // Handle stray brackets as their own tokens or skip
                tokens.push({
                    surface: line[i],
                    reading: line[i],
                    startTime: 0,
                    endTime: 0
                });
                i++;
            } else if (i < line.length) {
                // Fallback for any unhandled characters
                i++;
            }
        }
        
        return {
            id: uuidv4(),
            startTime: 0,
            endTime: 0,
            text: line.replace(/\[[^\]]+\]/g, ''),
            tokens,
            translation: ''
        };
    }).filter(line => line.tokens.length > 0);
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
