import type { PlayMode } from '@/stores/usePlayerStore';

export type TrackDirection = 'next' | 'prev';

interface NeighborCandidateOptions {
  playlist: number[];
  currentId: number | null;
  playMode: PlayMode;
  direction: TrackDirection;
  random?: () => number;
}

export const getNeighborCandidateIds = ({
  playlist,
  currentId,
  playMode,
  direction,
  random = Math.random,
}: NeighborCandidateOptions) => {
  if (currentId === null || playlist.length <= 1) return [];
  const currentIndex = playlist.indexOf(currentId);
  if (currentIndex === -1) return [];

  if (playMode === 'shuffle') {
    return playlist
      .filter((id) => id !== currentId)
      .map((id) => ({ id, sort: random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((item) => item.id);
  }

  const candidates: number[] = [];
  for (let offset = 1; offset < playlist.length; offset++) {
    const index = direction === 'next'
      ? (currentIndex + offset) % playlist.length
      : (currentIndex - offset + playlist.length) % playlist.length;
    candidates.push(playlist[index]);
  }
  return candidates;
};
