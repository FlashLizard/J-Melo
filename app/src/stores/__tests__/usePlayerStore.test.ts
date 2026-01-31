// src/stores/__tests__/usePlayerStore.test.ts
import usePlayerStore from '../usePlayerStore';
import { act } from 'zustand/vanilla';

describe('usePlayerStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    act(() => {
        usePlayerStore.setState({
            mediaElement: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            loopA: null,
            loopB: null,
        });
    });
  });

  it('should have correct initial state', () => {
    const state = usePlayerStore.getState();
    expect(state.mediaElement).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(0);
    expect(state.loopA).toBeNull();
    expect(state.loopB).toBeNull();
  });

  it('should set loop points correctly', () => {
    act(() => {
      usePlayerStore.setState({ currentTime: 10 });
      usePlayerStore.getState().actions.setLoopA();
    });

    let state = usePlayerStore.getState();
    expect(state.loopA).toBe(10);
    expect(state.loopB).toBeNull();

    act(() => {
      usePlayerStore.setState({ currentTime: 20 });
      usePlayerStore.getState().actions.setLoopB();
    });

    state = usePlayerStore.getState();
    expect(state.loopB).toBe(20);
  });

  it('should clear loop points', () => {
    act(() => {
      usePlayerStore.setState({ currentTime: 10 });
      usePlayerStore.getState().actions.setLoopA();
      usePlayerStore.setState({ currentTime: 20 });
      usePlayerStore.getState().actions.setLoopB();
    });

    let state = usePlayerStore.getState();
    expect(state.loopA).toBe(10);
    expect(state.loopB).toBe(20);

    act(() => {
      usePlayerStore.getState().actions.clearLoop();
    });

    state = usePlayerStore.getState();
    expect(state.loopA).toBeNull();
    expect(state.loopB).toBeNull();
  });
});
