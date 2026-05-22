import { LyricToken } from '@/interfaces/lyrics';

export const getTokenReadingText = (token: LyricToken) => {
  const reading = typeof token.reading === 'string' ? token.reading : '';
  return reading.length > 0 ? reading : token.surface;
};

export const getTokensReadingText = (tokens: LyricToken[]) => {
  return tokens.map(getTokenReadingText).join('');
};

export const getTokensSurfaceText = (tokens: LyricToken[]) => {
  return tokens.map(token => token.surface).join('');
};
