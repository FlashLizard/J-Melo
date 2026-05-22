import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useTranslation from '@/hooks/useTranslation';
import useSettingsStore from '@/stores/useSettingsStore';
import { getJson } from '@/lib/backendClient';

interface TranscriptionTask {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    display_name: string;
    started_at: string;
    completed_at: string | null;
    error: string | null;
}

const getStatusPill = (status: string, t: (key: string) => string) => {
    switch (status) {
        case 'pending': return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">{t('transcriptionStatus.pending')}</span>;
        case 'processing': return <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-200 rounded-full">{t('transcriptionStatus.processing')}</span>;
        case 'completed': return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">{t('transcriptionStatus.completed')}</span>;
        case 'error': return <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full">{t('transcriptionStatus.error')}</span>;
        default: return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">{status}</span>;
    }
};

const TranscriptionStatusModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { settings, loadSettings } = useSettingsStore();
    const [tasks, setTasks] = useState<TranscriptionTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const backendUrl = settings.backendUrl;

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen, loadSettings]);

    const fetchTasks = useCallback(async () => {
        if (!backendUrl) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await getJson<{ tasks: TranscriptionTask[] }>(backendUrl, '/api/public/transcription-tasks');
            setTasks(data.tasks);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        if (isOpen && backendUrl) {
            fetchTasks();
        }
    }, [isOpen, backendUrl, fetchTasks]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-800 text-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-gray-200">{t('transcriptionStatus.modalTitle')}</h2>
                    <div className="flex items-center gap-2">
                         <button onClick={fetchTasks} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title={t('transcriptionStatus.refresh')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5" /><path d="M20 4L15 9M4 20l5-5" /><path d="M4 12a8 8 0 018-8v0a8 8 0 018 8v0a8 8 0 01-8 8v0a8 8 0 01-8-8v0z" /></svg>
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl">&times;</button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-grow pr-2 custom-scrollbar">
                    {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{t('error')}: {error}</p>}
                    
                    {tasks.length === 0 && !isLoading && (
                        <p className="text-center text-gray-500 py-8">{t('transcriptionStatus.noTasks')}</p>
                    )}

                    <ul className="space-y-3">
                        {tasks.map((task, index) => (
                            <li key={task.id} className="bg-gray-700/60 p-3 rounded-lg border border-gray-600/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-gray-300">
                                            <span className="text-gray-500 mr-2">#{index + 1}</span>
                                            {task.display_name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {t('transcriptionStatus.submitted')}: {new Date(task.started_at).toLocaleString()}
                                        </p>
                                        {task.completed_at && (
                                             <p className="text-xs text-gray-500">
                                                {t('transcriptionStatus.finished')}: {new Date(task.completed_at).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0">
                                        {getStatusPill(task.status, t)}
                                    </div>
                                </div>
                                {task.status === 'error' && task.error && (
                                    <div className="mt-2 p-2 bg-red-900/50 rounded text-red-300 text-xs whitespace-pre-wrap font-mono">
                                        {task.error}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TranscriptionStatusModal;
