// src/components/player/Player.tsx
import React from 'react';
import MediaDisplay from './MediaDisplay';
import PlayerControls from './PlayerControls';
import { SongData } from '@/stores/useSongStore';

interface Props {
  song: SongData | null;
}

const Player: React.FC<Props> = ({ song }) => {
  return (
    <div className="flex flex-col h-full">
      <MediaDisplay
        mediaType={song?.media_type || 'audio'}
        mediaUrl={song?.media_url} // Pass the URL directly
        coverUrl={song?.cover_url || 'https://via.placeholder.com/300'}
      />
      <PlayerControls />
    </div>
  );
};

export default Player;