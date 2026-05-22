import {
  extractJsonFromLlmOutput,
  parseLyricsFromLlmOutput,
  parseLyricTranslationsFromLlmOutput,
} from './aiJson';

describe('aiJson', () => {
  it('parses fenced json output', () => {
    expect(extractJsonFromLlmOutput('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('parses raw json output', () => {
    expect(extractJsonFromLlmOutput('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses json embedded in prose', () => {
    expect(extractJsonFromLlmOutput('Here is the result:\n[{"ok":true}]\nDone.')).toEqual([{ ok: true }]);
  });

  it('skips non-json bracketed prose before the real payload', () => {
    expect(extractJsonFromLlmOutput('Translation draft [not json]\n[{"ok":true}]')).toEqual([{ ok: true }]);
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

  it('parses simplified translation lyric arrays without tokens', () => {
    const updates = parseLyricTranslationsFromLlmOutput(JSON.stringify([
      { startTime: 0, endTime: 1, text: '青い空', translation: 'Blue sky' },
      { startTime: 1, endTime: 2, text: '白い雲', translation: 'White clouds' },
    ]), 2);

    expect(updates).toEqual([
      { index: 0, translation: 'Blue sky', text: '青い空', startTime: 0, endTime: 1 },
      { index: 1, translation: 'White clouds', text: '白い雲', startTime: 1, endTime: 2 },
    ]);
  });

  it('parses wrapped translation arrays with one-based indexes', () => {
    const updates = parseLyricTranslationsFromLlmOutput(JSON.stringify({
      translations: [
        { lineNumber: 1, translation: 'Blue sky' },
        { lineNumber: 2, translation: 'White clouds' },
      ],
    }), 2);

    expect(updates).toEqual([
      { index: 0, translation: 'Blue sky', text: undefined, startTime: undefined, endTime: undefined },
      { index: 1, translation: 'White clouds', text: undefined, startTime: undefined, endTime: undefined },
    ]);
  });

  it('parses string array translations', () => {
    expect(parseLyricTranslationsFromLlmOutput('["Blue sky","White clouds"]', 2)).toEqual([
      { index: 0, translation: 'Blue sky' },
      { index: 1, translation: 'White clouds' },
    ]);
  });

  it('rejects position-mapped translation arrays with the wrong length', () => {
    expect(() => parseLyricTranslationsFromLlmOutput('[{"translation":"Only one"}]', 2)).toThrow(/2 lines/);
  });
});
