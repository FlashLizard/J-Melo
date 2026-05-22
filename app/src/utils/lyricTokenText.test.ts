import { getTokensReadingText, getTokensSurfaceText } from './lyricTokenText';
import { LyricToken } from '@/interfaces/lyrics';

const token = (surface: string, reading = ''): LyricToken => ({
  surface,
  reading,
  startTime: 0,
  endTime: 0,
});

describe('lyricTokenText', () => {
  it('keeps kana tokens in the composed reading when token reading is empty', () => {
    const tokens = [
      token('取', 'と'),
      token('り'),
      token('戻', 'もど'),
      token('す'),
    ];

    expect(getTokensSurfaceText(tokens)).toBe('取り戻す');
    expect(getTokensReadingText(tokens)).toBe('とりもどす');
  });
});
