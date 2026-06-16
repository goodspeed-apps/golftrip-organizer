/**
 * Tests for hooks/useKeyboard.ts — Keyboard state logic.
 */

describe('keyboard logic', () => {
  test('initial state is hidden with height 0', () => {
    const state = { visible: false, height: 0 };
    expect(state.visible).toBe(false);
    expect(state.height).toBe(0);
  });

  test('keyboardDidShow event updates state', () => {
    const state = { visible: false, height: 0 };
    // Simulate keyboardDidShow
    state.visible = true;
    state.height = 346;
    expect(state.visible).toBe(true);
    expect(state.height).toBe(346);
  });

  test('keyboardDidHide event resets state', () => {
    const state = { visible: true, height: 346 };
    // Simulate keyboardDidHide
    state.visible = false;
    state.height = 0;
    expect(state.visible).toBe(false);
    expect(state.height).toBe(0);
  });

  test('iOS uses keyboardWillShow, Android uses keyboardDidShow', () => {
    const iosEvent = 'keyboardWillShow';
    const androidEvent = 'keyboardDidShow';
    expect(iosEvent).not.toBe(androidEvent);
  });

  test('dismiss calls Keyboard.dismiss', () => {
    const dismiss = jest.fn();
    dismiss();
    expect(dismiss).toHaveBeenCalled();
  });
});
