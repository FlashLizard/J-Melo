// src/stores/useEditorStore.ts
import { create } from 'zustand';
import { LyricToken, LyricLine } from '@/lib/mock-data';

interface EditorState {
  editingToken: { token: LyricToken, line: LyricLine } | null;
}

const useEditorStore = create<EditorState>(() => ({
  editingToken: null,
}));

export const editorStoreActions = {
  setEditingToken: (token: LyricToken, line: LyricLine) => useEditorStore.setState({ editingToken: { token, line } }),
  clearEditingToken: () => useEditorStore.setState({ editingToken: null }),
};

export default useEditorStore;
