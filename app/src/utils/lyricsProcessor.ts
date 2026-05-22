// app/src/utils/lyricsProcessor.ts
import { WhisperXOutput, LyricLine, LyricRubySegment, LyricToken } from '@/interfaces/lyrics';

const MIN_TOKEN_DURATION = 0.03;

export const katakanaToHiragana = (src: string = '') => {
    return src.replace(/[\u30a1-\u30f6]/g, (match) => {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
};

const roundTime = (value: number) => Number(value.toFixed(2));

const toFiniteTime = (value: unknown, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
};

const hasTimedRange = (startTime: number, endTime: number) => endTime > startTime;

export const processWhisperXOutput = async (data: WhisperXOutput): Promise<LyricLine[]> => {
    if (!data || !data.segments) return [];

    const lines: LyricLine[] = data.segments.map((segment) => {
        const tokens: LyricToken[] = segment.words.map((word) => {
            const surface = word.word;
            const reading = (word as any).reading || surface;
            return {
                surface,
                reading, // Use backend reading if available
                startTime: toFiniteTime(word.start),
                endTime: toFiniteTime(word.end),
                rubySegments: buildRubySegments(surface, reading),
            };
        });

        return {
            startTime: toFiniteTime(segment.start),
            endTime: toFiniteTime(segment.end),
            text: segment.text.trim(),
            tokens: tokens,
            translation: '',
        };
    });

    return formatLyricTimings(lines);
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

const containsKanji = (value: string) => Array.from(value).some(char => getScriptType(char) === 'kanji');

const getSurfaceWeight = (surface: string) => {
    const visibleChars = Array.from(surface || '').filter(char => getScriptType(char) !== 'space').length;
    return Math.max(1, visibleChars);
};

const splitSurfaceRuns = (surface: string): Array<{ type: 'kanji' | 'literal'; text: string }> => {
    const runs: Array<{ type: 'kanji' | 'literal'; text: string }> = [];
    for (const char of Array.from(surface)) {
        const type = getScriptType(char) === 'kanji' ? 'kanji' : 'literal';
        const last = runs[runs.length - 1];
        if (last && last.type === type) {
            last.text += char;
        } else {
            runs.push({ type, text: char });
        }
    }
    return runs;
};

const hasVisibleRuby = (segments?: LyricRubySegment[]) => Boolean(segments?.some(segment => segment.reading));

/**
 * Splits a mixed surface such as "僕ら" + "ぼくら" into ruby-aware segments:
 * [{ text: "僕", reading: "ぼく" }, { text: "ら" }].
 */
export const buildRubySegments = (surface: string = '', reading: string = ''): LyricRubySegment[] | undefined => {
    if (!surface || !reading) return undefined;

    const normalizedSurface = katakanaToHiragana(surface);
    const normalizedReading = katakanaToHiragana(reading);
    if (!containsKanji(surface) || normalizedSurface === normalizedReading) return undefined;

    const runs = splitSurfaceRuns(surface);
    const segments: LyricRubySegment[] = [];
    let readingCursor = 0;
    let pendingKanjiIndex: number | null = null;

    for (const run of runs) {
        if (run.type === 'kanji') {
            pendingKanjiIndex = segments.length;
            segments.push({ text: run.text });
            continue;
        }

        const literalReading = katakanaToHiragana(run.text);
        if (pendingKanjiIndex !== null) {
            const anchorIndex = literalReading ? normalizedReading.indexOf(literalReading, readingCursor) : -1;
            if (anchorIndex < readingCursor) {
                return [{ text: surface, reading }];
            }

            const ruby = normalizedReading.slice(readingCursor, anchorIndex);
            if (ruby) segments[pendingKanjiIndex].reading = ruby;
            readingCursor = anchorIndex + literalReading.length;
            pendingKanjiIndex = null;
        } else if (literalReading && normalizedReading.startsWith(literalReading, readingCursor)) {
            readingCursor += literalReading.length;
        }

        segments.push({ text: run.text });
    }

    if (pendingKanjiIndex !== null) {
        const ruby = normalizedReading.slice(readingCursor);
        if (ruby) segments[pendingKanjiIndex].reading = ruby;
    }

    const cleaned = segments.map(segment => {
        if (!segment.reading) return segment;
        return katakanaToHiragana(segment.reading) === katakanaToHiragana(segment.text)
            ? { text: segment.text }
            : segment;
    });

    return hasVisibleRuby(cleaned) ? cleaned : [{ text: surface, reading }];
};

const withRubySegments = (token: LyricToken): LyricToken => {
    const rubySegments = buildRubySegments(token.surface, token.reading);
    const nextToken = { ...token };
    if (hasVisibleRuby(rubySegments)) {
        nextToken.rubySegments = rubySegments;
    } else {
        delete nextToken.rubySegments;
    }
    return nextToken;
};

const normalizeTokenBasics = (token: LyricToken): LyricToken => {
    const surface = String(token?.surface ?? '');
    const reading = String(token?.reading ?? surface);
    return withRubySegments({
        ...token,
        surface,
        reading,
        startTime: roundTime(toFiniteTime(token?.startTime)),
        endTime: roundTime(toFiniteTime(token?.endTime)),
    });
};

const distributeTokenTimings = (tokens: LyricToken[], lineStart: number, lineEnd: number) => {
    if (!tokens.length || !hasTimedRange(lineStart, lineEnd)) return tokens;

    const duration = lineEnd - lineStart;
    const totalWeight = tokens.reduce((sum, token) => sum + getSurfaceWeight(token.surface), 0);
    let cursor = lineStart;

    return tokens.map((token, index) => {
        const nextCursor = index === tokens.length - 1
            ? lineEnd
            : cursor + duration * (getSurfaceWeight(token.surface) / totalWeight);
        const timedToken = {
            ...token,
            startTime: roundTime(cursor),
            endTime: roundTime(Math.max(nextCursor, cursor + MIN_TOKEN_DURATION)),
        };
        cursor = nextCursor;
        return timedToken;
    });
};

const enforceMonotonicTimedTokens = (tokens: LyricToken[], lineStart: number) => {
    let cursor = lineStart;
    return tokens.map(token => {
        if (!hasTimedRange(token.startTime, token.endTime)) return token;

        const startTime = Math.max(token.startTime, cursor);
        const endTime = Math.max(token.endTime, startTime + MIN_TOKEN_DURATION);
        cursor = endTime;

        return {
            ...token,
            startTime: roundTime(startTime),
            endTime: roundTime(endTime),
        };
    });
};

const normalizeLineTiming = (line: LyricLine, nextLine?: LyricLine): LyricLine => {
    let tokens = (line.tokens || [])
        .filter(token => token && typeof token.surface !== 'undefined')
        .map(normalizeTokenBasics);

    let startTime = toFiniteTime(line.startTime);
    let endTime = toFiniteTime(line.endTime);
    const nextStartTime = nextLine ? toFiniteTime(nextLine.startTime, -1) : -1;

    const timedTokens = tokens.filter(token => hasTimedRange(token.startTime, token.endTime));
    if (timedTokens.length > 0) {
        const tokenStart = Math.min(...timedTokens.map(token => token.startTime));
        const tokenEnd = Math.max(...timedTokens.map(token => token.endTime));
        if (!hasTimedRange(startTime, endTime)) {
            startTime = tokenStart;
            endTime = tokenEnd;
        } else {
            startTime = Math.min(startTime, tokenStart);
            endTime = Math.max(endTime, tokenEnd);
        }
    }

    if (!hasTimedRange(startTime, endTime) && nextStartTime > startTime) {
        endTime = nextStartTime;
    }

    if (hasTimedRange(startTime, endTime)) {
        if (timedTokens.length === 0) {
            tokens = distributeTokenTimings(tokens, startTime, endTime);
            const tokenEnd = Math.max(...tokens.map(token => token.endTime));
            if (Number.isFinite(tokenEnd)) endTime = Math.max(endTime, tokenEnd);
        } else {
            tokens = enforceMonotonicTimedTokens(tokens, startTime);
            const tokenEnd = Math.max(...tokens.map(token => token.endTime));
            if (Number.isFinite(tokenEnd)) endTime = Math.max(endTime, tokenEnd);
        }
    }

    return {
        ...line,
        startTime: roundTime(startTime),
        endTime: roundTime(endTime),
        text: typeof line.text === 'string' ? line.text : tokens.map(token => token.surface).join(''),
        tokens,
    };
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
                    rubySegments: buildRubySegments(surface, reading),
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
 * Normalizes lyric timings and ruby metadata while preserving the existing lyric shape.
 */
export const formatLyricTimings = (lines: LyricLine[]): LyricLine[] => {
    if (!lines) return [];
    return lines.map((line, index) => normalizeLineTiming(line, lines[index + 1]));
};
