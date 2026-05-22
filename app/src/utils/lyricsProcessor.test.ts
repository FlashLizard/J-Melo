import { buildRubySegments, formatLyricTimings, parseFuriganaText, processWhisperXOutput } from './lyricsProcessor';

describe('lyricsProcessor', () => {
  it('rounds line and token timings', () => {
    const formatted = formatLyricTimings([
      {
        startTime: 1.234,
        endTime: 2.345,
        text: 'test',
        translation: '',
        tokens: [{ surface: 't', reading: 't', startTime: 1.236, endTime: 1.999 }],
      },
    ]);
    expect(formatted[0].startTime).toBe(1.23);
    expect(formatted[0].tokens[0].endTime).toBe(2);
  });

  it('derives missing token timings from a timed line', () => {
    const formatted = formatLyricTimings([
      {
        startTime: 0,
        endTime: 4,
        text: '青い空',
        translation: '',
        tokens: [
          { surface: '青い', reading: 'あおい', startTime: 0, endTime: 0 },
          { surface: '空', reading: 'そら', startTime: 0, endTime: 0 },
        ],
      },
    ]);

    expect(formatted[0].tokens[0].startTime).toBe(0);
    expect(formatted[0].tokens[1].endTime).toBe(4);
    expect(formatted[0].tokens[0].endTime).toBeLessThanOrEqual(formatted[0].tokens[1].startTime);
  });

  it('expands a line window to cover token timings', () => {
    const formatted = formatLyricTimings([
      {
        startTime: 1,
        endTime: 2,
        text: 'test',
        translation: '',
        tokens: [{ surface: 'late', reading: 'late', startTime: 2.2, endTime: 2.8 }],
      },
    ]);

    expect(formatted[0].endTime).toBe(2.8);
  });

  it('parses bracketed furigana text', () => {
    const lyrics = parseFuriganaText('君[きみ]の名[な]');
    expect(lyrics[0].text).toBe('君の名');
    expect(lyrics[0].tokens[0]).toMatchObject({ surface: '君', reading: 'きみ' });
  });

  it('places furigana above only the kanji part of a mixed token', () => {
    expect(buildRubySegments('僕ら', 'ぼくら')).toEqual([
      { text: '僕', reading: 'ぼく' },
      { text: 'ら' },
    ]);

    const lyrics = parseFuriganaText('僕ら[ぼくら]は取り戻す[とりもどす]');
    expect(lyrics[0].tokens[0].rubySegments).toEqual([
      { text: '僕', reading: 'ぼく' },
      { text: 'ら' },
    ]);
    expect(lyrics[0].tokens[2].rubySegments).toEqual([
      { text: '取', reading: 'と' },
      { text: 'り' },
      { text: '戻', reading: 'もど' },
      { text: 'す' },
    ]);
  });

  it('maps whisper output to lyric lines', async () => {
    const lyrics = await processWhisperXOutput({
      language: 'ja',
      segments: [{ start: 0, end: 1.111, text: 'hello', words: [{ word: 'hello', start: 0, end: 1.111, score: 1 }] }],
    });
    expect(lyrics[0].endTime).toBe(1.11);
    expect(lyrics[0].tokens[0].surface).toBe('hello');
  });

  it('adds ruby segment metadata to whisper tokens when readings are present', async () => {
    const lyrics = await processWhisperXOutput({
      language: 'ja',
      segments: [{ start: 0, end: 1, text: '僕ら', words: [{ word: '僕ら', reading: 'ぼくら', start: 0, end: 1, score: 1 } as any] }],
    });

    expect(lyrics[0].tokens[0].rubySegments).toEqual([
      { text: '僕', reading: 'ぼく' },
      { text: 'ら' },
    ]);
  });
});
