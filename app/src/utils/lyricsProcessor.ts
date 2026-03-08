// app/src/utils/lyricsProcessor.ts
import { WhisperXOutput, LyricLine, LyricToken } from '@/interfaces/lyrics';

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
            const startIdx = i;
            
            const firstChar = line[i];
            const firstType = getScriptType(firstChar);

            if (firstType === 'kanji') {
                // Potential word start. Search forward for a bracket.
                // We allow Kanji, Hiragana (okurigana), and Katakana to be part of the surface before a bracket.
                let j = i;
                let foundBracket = -1;
                while (j < line.length) {
                    const char = line[j];
                    const type = getScriptType(char);
                    if (char === '[') {
                        foundBracket = j;
                        break;
                    }
                    // Stop searching if we hit something that clearly isn't part of this word
                    if (type === 'space' || type === 'other') break;
                    j++;
                }

                if (foundBracket !== -1) {
                    // We found a bracket! The surface is everything from i to foundBracket.
                    surface = line.substring(i, foundBracket);
                    let k = foundBracket + 1;
                    let bracketContent = "";
                    while (k < line.length && line[k] !== ']') {
                        bracketContent += line[k];
                        k++;
                    }
                    reading = bracketContent;
                    i = k + (k < line.length ? 1 : 0); // Move past ']'
                } else {
                    // No bracket found for this Kanji block. Group same type.
                    let j = i;
                    while (j < line.length && getScriptType(line[j]) === 'kanji') {
                        surface += line[j];
                        j++;
                    }
                    reading = surface;
                    i = j;
                }
            } else {
                // Not starting with Kanji. Group same script type.
                let j = i;
                while (j < line.length) {
                    const char = line[j];
                    const type = getScriptType(char);
                    // Stop if script type changes or we hit a bracket
                    if (type !== firstType || char === '[' || char === ']') break;
                    surface += char;
                    j++;
                }
                
                // Check if this non-kanji block is immediately followed by a bracket (uncommon but possible)
                if (j < line.length && line[j] === '[') {
                    let k = j + 1;
                    let bracketContent = "";
                    while (k < line.length && line[k] !== ']') {
                        bracketContent += line[k];
                        k++;
                    }
                    reading = bracketContent;
                    i = k + (k < line.length ? 1 : 0);
                } else {
                    reading = surface;
                    i = j;
                }
            }

            if (surface) {
                tokens.push({
                    surface,
                    reading,
                    startTime: 0,
                    endTime: 0
                });
            } else if (i === startIdx && i < line.length) {
                // Safety fallback for stray brackets or unhandled chars
                const fallback = line[i];
                tokens.push({ surface: fallback, reading: fallback, startTime: 0, endTime: 0 });
                i++;
            }
        }
        
        return {
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
