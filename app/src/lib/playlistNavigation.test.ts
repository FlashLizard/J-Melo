import { getNeighborCandidateIds } from './playlistNavigation';

describe('playlistNavigation', () => {
  it('returns sequential next candidates without repeating the current song first', () => {
    expect(getNeighborCandidateIds({
      playlist: [1, 2, 3, 4],
      currentId: 2,
      playMode: 'sequential',
      direction: 'next',
    })).toEqual([3, 4, 1]);
  });

  it('returns sequential previous candidates with wraparound', () => {
    expect(getNeighborCandidateIds({
      playlist: [1, 2, 3, 4],
      currentId: 1,
      playMode: 'sequential',
      direction: 'prev',
    })).toEqual([4, 3, 2]);
  });

  it('treats manual next in loop-single mode as playlist navigation', () => {
    expect(getNeighborCandidateIds({
      playlist: [1, 2, 3],
      currentId: 3,
      playMode: 'loop-single',
      direction: 'next',
    })).toEqual([1, 2]);
  });

  it('excludes the current song in shuffle mode', () => {
    const candidates = getNeighborCandidateIds({
      playlist: [1, 2, 3],
      currentId: 2,
      playMode: 'shuffle',
      direction: 'next',
      random: () => 0.5,
    });

    expect(candidates).toHaveLength(2);
    expect(candidates).not.toContain(2);
    expect(new Set(candidates)).toEqual(new Set([1, 3]));
  });

  it('returns no candidates for missing current song or single-item playlists', () => {
    expect(getNeighborCandidateIds({
      playlist: [1],
      currentId: 1,
      playMode: 'sequential',
      direction: 'next',
    })).toEqual([]);
    expect(getNeighborCandidateIds({
      playlist: [1, 2],
      currentId: 3,
      playMode: 'sequential',
      direction: 'next',
    })).toEqual([]);
  });
});
