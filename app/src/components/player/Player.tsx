// src/components/player/Player.tsx
import React from 'react';
import MediaDisplay from './MediaDisplay';
import PlayerControls from './PlayerControls';
import { SongData } from '@/stores/useSongStore'; // Assuming SongData is exported from the store

interface Props {
  song: SongData | null;
}

const Player: React.FC<Props> = ({ song }) => {
  const BACKEND_URL = 'http://localhost:8000';

  return (
    <div className="flex flex-col h-full">
      <MediaDisplay
        mediaType={song?.media_type || 'audio'}
        mediaUrl={song ? `${BACKEND_URL}${song.media_url}` : undefined}
        coverUrl={song?.cover_url || 'https://via.placeholder.com/300'}
      />
      <PlayerControls />
    </div>
  );
};

export default Player;
