import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore';
import { db, blobToBase64 } from '@/lib/db';
import ImportConflictModal, { Conflict } from '@/components/common/ImportConflictModal';
import { SongRecord, WordRecord } from '@/lib/db';
import SongPreviewModal from '@/components/explore/SongPreviewModal';

interface CommunitySong {
    id: number;
    title: string;
    artist: string;
    cover_url: string;
    sharer_name: string;
    created_at: string;
}

interface ImportState {
  conflicts: Conflict[];
  nonConflictingSongs: SongRecord[];
  importedWords: WordRecord[];
}

const ExplorePage: React.FC = () => {
    const { t } = useTranslation();
    const [songs, setSongs] = useState<CommunitySong[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backendUrl, setBackendUrl] = useState('');
    const [myNickname, setMyNickname] = useState('');
    const [importState, setImportState] = useState<ImportState | null>(null);
    const [previewSong, setPreviewSong] = useState<CommunitySong | null>(null);

    const loadSettings = async () => {
        const settings = await db.settings.get(0);
        setBackendUrl(settings?.backendUrl || 'http://localhost:8000');
        setMyNickname(settings?.sharerNickname || '');
    };

    const fetchSongs = useCallback(async (query: string = '') => {
        if (!backendUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const url = new URL(`${backendUrl}/api/community/songs`);
            if (query) url.searchParams.append('q', query);
            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch community songs');
            const data = await res.json();
            setSongs(data.songs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (backendUrl) {
            fetchSongs();
        }
    }, [backendUrl, fetchSongs]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSongs(searchQuery);
    };

    const handleImport = async (songData: SongRecord, wordsData: WordRecord[]) => {
        try {
            const allExistingSongs = await db.songs.toArray();
            const existingUrlMap = new Map(allExistingSongs.map(s => [s.sourceUrl, s]));

            const foundConflicts: Conflict[] = [];
            const newSongs: SongRecord[] = [];

            const existingSong = existingUrlMap.get(songData.sourceUrl);
            if (existingSong) {
                foundConflicts.push({ existingSong, importedSong: songData });
            } else {
                newSongs.push(songData);
            }

            if (foundConflicts.length > 0) {
                setImportState({ 
                    conflicts: foundConflicts, 
                    nonConflictingSongs: newSongs, 
                    importedWords: wordsData 
                });
                setPreviewSong(null);
            } else {
                const { addManySongs } = useSongStore.getState();
                await addManySongs(newSongs, wordsData);
                alert(t('home.importSuccess'));
                setPreviewSong(null);
            }
        } catch (e) {
            alert(t('explore.downloadError', { error: (e as Error).message }));
        }
    };

    const handleUpdateCommunity = async (remoteSongData: SongRecord, wordsData: WordRecord[]) => {
        if (!previewSong || !myNickname) return;
        if (!window.confirm(t('toolPanel.communityUpdateConfirm'))) return;

        try {
            const localSongs = await db.songs.where('sourceUrl').equals(remoteSongData.sourceUrl).toArray();
            if (localSongs.length === 0) {
                throw new Error("Could not find this song in your local library. Please import it first.");
            }
            const localSong = localSongs[0];
            const localWords = await db.words.where('sourceSongId').equals(localSong.id!).toArray();

            const delRes = await fetch(`${backendUrl}/api/community/songs/${previewSong.id}?sharer_name=${encodeURIComponent(myNickname)}`, {
                method: 'DELETE'
            });
            if (!delRes.ok) throw new Error("Failed to delete old community version.");

            const { audioData, ...rest } = localSong;
            let coverImageBase64 = '';
            if (localSong.coverImageData) {
                coverImageBase64 = await blobToBase64(localSong.coverImageData);
            }
            const songPayload = { ...rest, coverImageData: coverImageBase64 };

            const payload = {
                title: localSong.title,
                artist: localSong.artist,
                cover_url: localSong.cover_url,
                sharer_name: myNickname,
                song_data: songPayload,
                words_data: localWords
            };

            const postRes = await fetch(`${backendUrl}/api/community/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!postRes.ok) throw new Error("Failed to upload new version.");

            alert("Community data updated successfully!");
            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            alert(`Update failed: ${(e as Error).message}`);
        }
    };

    const handleDeleteCommunity = async (songId: number) => {
        if (!myNickname) return;
        if (!window.confirm(t('toolPanel.communityDeleteConfirm'))) return;
        try {
            const delRes = await fetch(`${backendUrl}/api/community/songs/${songId}?sharer_name=${encodeURIComponent(myNickname)}`, {
                method: 'DELETE'
            });
            if (!delRes.ok) throw new Error("Failed to delete from community server.");
            alert(t('myShared.deleteSuccess'));
            setPreviewSong(null);
            fetchSongs(searchQuery);
        } catch (e) {
            alert(t('myShared.deleteError', { error: (e as Error).message }));
        }
    };

    return (
        <>
            <Head>
                <title>{`J-Melo - ${t('home.exploreButton')}`}</title>
            </Head>

            {previewSong && (
                <SongPreviewModal 
                    communitySong={previewSong}
                    backendUrl={backendUrl}
                    onClose={() => setPreviewSong(null)}
                    onImport={handleImport}
                    onUpdateCommunity={handleUpdateCommunity}
                    onDeleteCommunity={handleDeleteCommunity}
                    myNickname={myNickname}
                />
            )}

            {importState && (
                <ImportConflictModal
                    isOpen={!!importState}
                    onClose={() => setImportState(null)}
                    conflicts={importState.conflicts}
                    nonConflictingSongs={importState.nonConflictingSongs}
                    importedWords={importState.importedWords}
                    onImportComplete={() => setImportState(null)}
                />
            )}

            <main className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <img src="/logo.svg" alt="J-Melo Logo" className="w-10 h-10 drop-shadow-lg" />
                            <h1 className="text-3xl font-bold">{t('home.exploreButton')}</h1>
                        </div>
                        <Link href="/" className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 text-white w-full sm:w-auto text-center">
                            {t('settings.backToPlayer')}
                        </Link>
                    </header>

                    <form onSubmit={handleSearch} className="mb-8 flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('explore.searchPlaceholder')}
                            className="flex-grow p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-500 font-bold">
                            {t('explore.searchButton')}
                        </button>
                    </form>

                    {error && (
                        <div className="bg-red-800 p-4 rounded-lg mb-6 text-center">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-12 text-gray-400">
                            {t('home.loadingSongs')}
                        </div>
                    ) : songs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            {t('explore.noSongsFound')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {songs.map((song) => (
                                <div key={song.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col cursor-pointer hover:bg-gray-700 transition" onClick={() => setPreviewSong(song)}>
                                    <div className="h-48 bg-gray-700 relative">
                                        {song.cover_url ? (
                                            <img 
                                                src={song.cover_url.startsWith('/') ? `${backendUrl}${song.cover_url}` : song.cover_url} 
                                                alt={song.title} 
                                                className="w-full h-full object-cover" 
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full text-gray-500">No Cover</div>
                                        )}
                                    </div>
                                    <div className="p-4 flex-grow flex flex-col">
                                        <h2 className="text-lg font-bold truncate mb-1" title={song.title}>{song.title}</h2>
                                        <p className="text-sm text-gray-400 truncate mb-4" title={song.artist}>{song.artist || t('home.unknownArtist')}</p>
                                        
                                        <div className="mt-auto text-xs text-gray-500 flex justify-between items-center border-t border-gray-700 pt-2">
                                            <span>👤 {song.sharer_name}</span>
                                            <span>{new Date(song.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
};

export default ExplorePage;