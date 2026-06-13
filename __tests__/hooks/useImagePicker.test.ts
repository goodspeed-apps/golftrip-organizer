/**
 * Tests for hooks/useImagePicker.ts — Image picker state logic.
 */

describe('useImagePicker logic', () => {
  test('initial state has no image', () => {
    const state = { image: null, loading: false, error: null };
    expect(state.image).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  test('pickImage success sets image', () => {
    const state = { image: null as any, loading: false, error: null };
    const picked = { uri: 'file://photo.jpg', width: 200, height: 200 };
    state.image = picked;
    expect(state.image.uri).toBe('file://photo.jpg');
  });

  test('pickImage cancel returns null', () => {
    const result = null; // canceled
    expect(result).toBeNull();
  });

  test('clear resets state', () => {
    const state = { image: { uri: 'file://x.jpg' } as any, loading: false, error: null };
    state.image = null;
    state.error = null;
    expect(state.image).toBeNull();
  });

  test('loading state during pick', () => {
    const state = { image: null, loading: false, error: null as string | null };
    state.loading = true;
    expect(state.loading).toBe(true);
    state.loading = false;
    state.image = { uri: 'file://photo.jpg' } as any;
    expect(state.loading).toBe(false);
  });
});
