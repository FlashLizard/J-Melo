// src/stores/useEditorStore.ts
import { create } from 'zustand';
import { LyricLine, LyricToken } from '@/interfaces/lyrics';

interface EditorState {
  editingLine: LyricLine | null;
}

const useEditorStore = create<EditorState>(() => ({
  editingLine: null,
}));

export const editorStoreActions = {
  setEditingLine: (line: LyricLine) => useEditorStore.setState({ editingLine: line }),
  clearEditingLine: () => useEditorStore.setState({ editingLine: null }),
};

export default useEditorStore;
