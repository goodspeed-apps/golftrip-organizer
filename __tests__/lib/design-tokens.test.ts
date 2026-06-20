import { radius, densityScale, pad, cardShadow } from '../../lib/design-tokens';

describe('design-tokens resolvers', () => {
  it('radius maps known tokens and falls back to lg', () => {
    expect(radius('sm')).toBe(6);
    expect(radius('full')).toBe(999);
    expect(radius('nonsense')).toBe(14); // lg fallback
  });
  it('densityScale maps tokens and falls back to 1', () => {
    expect(densityScale('compact')).toBe(0.8);
    expect(densityScale('spacious')).toBe(1.25);
    expect(densityScale('nope')).toBe(1);
  });
  it('pad scales a base value by density', () => {
    expect(pad(10)).toBe(Math.round(10 * densityScale()));
  });
  it('cardShadow returns heavier elevation for bold and flatter for minimal', () => {
    expect(cardShadow('bold').elevation).toBeGreaterThan(cardShadow('professional').elevation);
    expect(cardShadow('minimal').elevation).toBeLessThan(cardShadow('professional').elevation);
  });
});
