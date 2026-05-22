import { LyricLine } from '@/interfaces/lyrics';

export function extractJsonFromLlmOutput<T = unknown>(output: string): T {
  const fencedJson = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fencedJson?.[1] ?? output.trim();
  return JSON.parse(raw) as T;
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
