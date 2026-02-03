// src/lib/mock-data.ts

// Based on the data structure from docs/smart_lyrics_system.md
import { LyricToken, LyricLine } from '@/interfaces/lyrics';

export const mockLyrics: LyricLine[] = [
  {
    id: 'line-1',
    startTime: 10.5,
    endTime: 16.2,
    text: '夢ならばどれほどよかったでしょう',
    translation: '如果这是梦该有多好',
    tokens: [
      { surface: '夢', reading: 'ゆめ', romaji: 'yume', startTime: 10.5, endTime: 11.0, partOfSpeech: '名詞' },
      { surface: 'ならば', reading: 'ならば', romaji: 'naraba', startTime: 11.0, endTime: 11.8, partOfSpeech: '助詞' },
      { surface: 'どれほど', reading: 'どれほど', romaji: 'dorehodo', startTime: 11.8, endTime: 12.8, partOfSpeech: '副詞' },
      { surface: 'よかった', reading: 'よかった', romaji: 'yokatta', startTime: 12.8, endTime: 13.8, partOfSpeech: '形容詞' },
      { surface: 'でしょう', reading: 'でしょう', romaji: 'deshou', startTime: 13.8, endTime: 14.5, partOfSpeech: '助動詞' },
    ],
  },
  {
    id: 'line-2',
    startTime: 16.3,
    endTime: 21.8,
    text: '未だにあなたのことを夢にみる',
    translation: '至今仍能梦见你的身影',
    tokens: [
      { surface: '未だに', reading: 'いまだに', romaji: 'imada ni', startTime: 16.3, endTime: 17.2, partOfSpeech: '副詞' },
      { surface: 'あなた', reading: 'あなた', romaji: 'anata', startTime: 17.2, endTime: 18.0, partOfSpeech: '代名詞' },
      { surface: 'のこと', reading: 'のこと', romaji: 'no koto', startTime: 18.0, endTime: 18.6, partOfSpeech: '名詞' },
      { surface: 'を', reading: 'を', romaji: 'wo', startTime: 18.6, endTime: 18.8, partOfSpeech: '助詞' },
      { surface: '夢', reading: 'ゆめ', romaji: 'yume', startTime: 18.8, endTime: 19.4, partOfSpeech: '名詞' },
      { surface: 'に', reading: 'に', romaji: 'ni', startTime: 19.4, endTime: 19.6, partOfSpeech: '助詞' },
      { surface: 'みる', reading: 'みる', romaji: 'miru', startTime: 19.6, endTime: 20.1, partOfSpeech: '動詞' },
    ],
  },
  {
    id: 'line-3',
    startTime: 21.9,
    endTime: 27.5,
    text: '忘れた物を取りに帰るように',
    translation: '如同回去取遗忘的东西一般',
    tokens: [
        { surface: '忘れ', reading: 'わすれ', romaji: 'wasure', startTime: 21.9, endTime: 22.8, partOfSpeech: '動詞' },
        { surface: 'た', reading: 'た', romaji: 'ta', startTime: 22.8, endTime: 23.0, partOfSpeech: '助動詞' },
        { surface: '物', reading: 'もの', romaji: 'mono', startTime: 23.0, endTime: 23.6, partOfSpeech: '名詞' },
        { surface: 'を', reading: 'を', romaji: 'wo', startTime: 23.6, endTime: 23.8, partOfSpeech: '助詞' },
        { surface: '取り', reading: 'とり', romaji: 'tori', startTime: 23.8, endTime: 24.4, partOfSpeech: '動詞' },
        { surface: 'に', reading: 'に', romaji: 'ni', startTime: 24.4, endTime: 24.6, partOfSpeech: '助詞' },
        { surface: '帰る', reading: 'かえる', romaji: 'kaeru', startTime: 24.6, endTime: 25.4, partOfSpeech: '動詞' },
        { surface: 'よう', reading: 'よう', romaji: 'you', startTime: 25.4, endTime: 25.8, partOfSpeech: '助動詞' },
        { surface: 'に', reading: 'に', romaji: 'ni', startTime: 25.8, endTime: 26.0, partOfSpeech: '助詞' },
    ]
  },
];
