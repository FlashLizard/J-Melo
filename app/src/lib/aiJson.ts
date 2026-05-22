import { LyricLine } from '@/interfaces/lyrics';

export type LyricTranslationUpdate = {
  index: number;
  translation: string;
  text?: string;
  startTime?: number;
  endTime?: number;
};

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonCandidate = <T = unknown>(raw: string): T =>
  JSON.parse(raw.replace(/^\uFEFF/, '').trim()) as T;

const getFencedCandidates = (output: string): string[] => {
  const candidates: string[] = [];
  const fencePattern = /```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(output)) !== null) {
    candidates.push(match[1]);
  }

  return candidates;
};

const findBalancedJsonCandidates = (text: string): string[] => {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    const firstChar = text[start];
    if (firstChar !== '{' && firstChar !== '[') continue;

    const stack: string[] = [firstChar === '{' ? '}' : ']'];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.pop() !== char) break;
        if (stack.length === 0) {
          candidates.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates;
};

export function extractJsonFromLlmOutput<T = unknown>(output: string): T {
  const trimmedOutput = output.trim();
  if (!trimmedOutput) {
    throw new Error('LLM response is empty.');
  }

  const candidates = [
    ...getFencedCandidates(trimmedOutput),
    trimmedOutput,
    ...findBalancedJsonCandidates(trimmedOutput),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  const seen = new Set<string>();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    try {
      return parseJsonCandidate<T>(normalized);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(`Unable to parse JSON from LLM output. ${lastError?.message ?? ''}`.trim());
}

export function parseLyricsFromLlmOutput(output: string): LyricLine[] {
  const parsed = extractJsonFromLlmOutput<unknown>(output);
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response JSON must be an array of lyric lines.');
  }
  parsed.forEach((line, index) => {
    if (!line || typeof line !== 'object') {
      throw new Error(`Lyric line ${index + 1} is not an object.`);
    }
    const candidate = line as Partial<LyricLine>;
    if (typeof candidate.text !== 'string' || !Array.isArray(candidate.tokens)) {
      throw new Error(`Lyric line ${index + 1} is missing text or tokens.`);
    }
  });
  return parsed as LyricLine[];
}

const TRANSLATION_ARRAY_KEYS = [
  'translations',
  'lyrics',
  'lines',
  'lyrics_data',
  'lyricsData',
  'items',
  'data',
  'result',
];

const TRANSLATION_TEXT_KEYS = [
  'translation',
  'translatedText',
  'translated_text',
  'translated',
  'targetText',
  'target_text',
];

const TRANSLATION_INDEX_KEYS = [
  'index',
  'lineIndex',
  'line_index',
  'lineNumber',
  'line_number',
];

const getTranslationItems = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;

  if (isJsonObject(parsed)) {
    for (const key of TRANSLATION_ARRAY_KEYS) {
      const value = parsed[key];
      if (Array.isArray(value)) return value;
    }
  }

  throw new Error('Translation JSON must be an array, or an object containing a translations/lyrics/lines array.');
};

const getOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const getExplicitIndex = (item: JsonObject): number | undefined => {
  for (const key of TRANSLATION_INDEX_KEYS) {
    const value = item[key];
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  }
  return undefined;
};

const getTranslationText = (item: JsonObject): string | undefined => {
  for (const key of TRANSLATION_TEXT_KEYS) {
    const value = item[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
};

export function parseLyricTranslationsFromLlmOutput(
  output: string,
  expectedLineCount?: number
): LyricTranslationUpdate[] {
  const parsed = extractJsonFromLlmOutput<unknown>(output);
  const items = getTranslationItems(parsed);

  if (items.length === 0) {
    throw new Error('Translation JSON contains no lines.');
  }

  const provisional = items.map((item, arrayIndex) => {
    if (typeof item === 'string') {
      return {
        hasExplicitIndex: false,
        index: arrayIndex,
        update: { index: arrayIndex, translation: item },
      };
    }

    if (!isJsonObject(item)) {
      throw new Error(`Translation line ${arrayIndex + 1} must be an object or string.`);
    }

    const translation = getTranslationText(item);
    if (translation === undefined) {
      throw new Error(`Translation line ${arrayIndex + 1} is missing a translation field.`);
    }

    const explicitIndex = getExplicitIndex(item);
    const index = explicitIndex ?? arrayIndex;

    return {
      hasExplicitIndex: explicitIndex !== undefined,
      index,
      update: {
        index,
        translation,
        text: getOptionalString(item.text),
        startTime: getOptionalNumber(item.startTime),
        endTime: getOptionalNumber(item.endTime),
      },
    };
  });

  const hasExplicitIndexes = provisional.some(item => item.hasExplicitIndex);

  if (!hasExplicitIndexes && expectedLineCount !== undefined && items.length !== expectedLineCount) {
    throw new Error(
      `Translation JSON contains ${items.length} lines, but the current lyrics contain ${expectedLineCount} lines. ` +
      'Return the same number of lines, or include explicit index fields for partial updates.'
    );
  }

  const explicitIndexes = provisional
    .filter(item => item.hasExplicitIndex)
    .map(item => item.index);
  const shouldNormalizeOneBasedIndexes =
    expectedLineCount !== undefined &&
    explicitIndexes.length > 0 &&
    !explicitIndexes.includes(0) &&
    explicitIndexes.every(index => index >= 1 && index <= expectedLineCount);

  const updates = provisional.map(item => ({
    ...item.update,
    index: item.hasExplicitIndex && shouldNormalizeOneBasedIndexes ? item.index - 1 : item.index,
  }));

  updates.forEach((update) => {
    if (update.index < 0 || !Number.isInteger(update.index)) {
      throw new Error(`Translation line index ${update.index} is invalid.`);
    }
    if (expectedLineCount !== undefined && update.index >= expectedLineCount) {
      throw new Error(`Translation line index ${update.index} is outside the current lyric range.`);
    }
  });

  return updates;
}
