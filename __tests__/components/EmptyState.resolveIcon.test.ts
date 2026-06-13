/**
 * EmptyState icon resolution must never hand React a non-renderable value.
 *
 * The lucide-react-native namespace holds non-component exports alongside icons,
 * so a kebab-name lookup (icon="alarm-clock") can return a plain object. Passing
 * that to <Icon /> throws "Element type is invalid: … but got: object" and takes
 * down the whole screen (observed crashing a generated app's hub). resolveIcon
 * must degrade an unknown/non-renderable name to null (no icon) instead.
 */

// A forwardRef-like icon (what a real lucide icon is) and a function icon are
// renderable; a plain object (the crash case) and a missing name are not.
const fwdRefIcon = { $$typeof: Symbol.for('react.forward_ref'), render: () => null };
const fnIcon = () => null;
jest.mock('lucide-react-native', () => ({
  Inbox: fwdRefIcon,
  Bell: fnIcon,
  AlarmClock: { notAComponent: true }, // plain object → would crash if rendered
}));
jest.mock('../../context/ThemeContext', () => ({ useThemeColors: () => ({ colors: {} }) }));
jest.mock('../../gas.config', () => ({ gasConfig: { design: { colors: { primary: '#000' } } } }));

import { resolveIcon, isRenderableComponent } from '../../components/ui/EmptyState';

describe('isRenderableComponent', () => {
  it('accepts functions and forwardRef/memo objects, rejects plain objects and nullish', () => {
    expect(isRenderableComponent(() => null)).toBe(true);
    expect(isRenderableComponent(fwdRefIcon)).toBe(true);
    expect(isRenderableComponent({ a: 1 })).toBe(false);
    expect(isRenderableComponent(undefined)).toBe(false);
    expect(isRenderableComponent(null)).toBe(false);
    expect(isRenderableComponent('Inbox')).toBe(false);
  });
});

describe('resolveIcon', () => {
  it('resolves a known kebab name to its renderable lucide component', () => {
    expect(resolveIcon('inbox')).toBe(fwdRefIcon);
    expect(resolveIcon('bell')).toBe(fnIcon);
  });

  it('returns null for a name that resolves to a non-renderable object (the crash case)', () => {
    expect(resolveIcon('alarm-clock')).toBeNull();
  });

  it('returns null for an unknown name and for nullish input', () => {
    expect(resolveIcon('totally-not-an-icon')).toBeNull();
    expect(resolveIcon(undefined)).toBeNull();
  });

  it('passes a component reference through unchanged', () => {
    expect(resolveIcon(fnIcon)).toBe(fnIcon);
  });
});
