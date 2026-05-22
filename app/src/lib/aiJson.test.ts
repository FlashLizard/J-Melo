import { extractJsonFromLlmOutput, parseLyricsFromLlmOutput } from './aiJson';

describe('aiJson', () => {
  it('parses fenced json output', () => {
    expect(extractJsonFromLlmOutput('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('parses raw json output', () => {
    expect(extractJsonFromLlmOutput('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('validates lyric arrays', () => {
    const lyrics = parseLyricsFromLlmOutput(JSON.stringify([
      { startTime: 0, endTime: 1, text: '青い空', translation: '', tokens: [{ surface: '青い', reading: 'あおい', startTime: 0, endTime: 1 }] },
    ]));
    expect(lyrics[0].text).toBe('青い空');
  });

  it('rejects non lyric json', () => {
    expect(() => parseLyricsFromLlmOutput('{"text":"bad"}')).toThrow(/array/);
  });
});
