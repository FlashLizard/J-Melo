// src/stores/useEditorStore.ts
import { create } from 'zustand';
import { LyricLine } from '@/interfaces/lyrics';

interface EditorState {
  editingLineIndex: number | null;
  editingLine: LyricLine | null;
  isTimeSyncMode: boolean;
}

const useEditorStore = create<EditorState>(() => ({
  editingLineIndex: null,
  editingLine: null,
  isTimeSyncMode: false,
}));

export const editorStoreActions = {
  setEditingLine: (line: LyricLine, index: number) => useEditorStore.setState({ editingLine: line, editingLineIndex: index }),
  clearEditingLine: () => useEditorStore.setState({ editingLine: null, editingLineIndex: null }),
  setTimeSyncMode: (isActive: boolean) => useEditorStore.setState({ isTimeSyncMode: isActive }),
};

export default useEditorStore;
