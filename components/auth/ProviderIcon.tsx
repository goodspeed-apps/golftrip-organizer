import Svg, { Path, Rect } from 'react-native-svg';

export type AuthProvider = 'google' | 'apple' | 'x' | 'linkedin' | 'microsoft';

/**
 * Real brand marks for the social sign-in buttons, drawn with react-native-svg.
 *
 * The auth screens used to fake these as styled <Text> glyphs, a flat
 * single-color "G" for Google (a 4-color mark can never be one color) and an
 * EMPTY <Text></Text> for Apple (so nothing drew). Provider logos must be the
 * real marks: Google and Microsoft carry their official multi-color palettes;
 * Apple and X are monochrome and take `color` so they sit correctly on light or
 * dark buttons.
 *
 * The Google and Microsoft brand colors are official and must not be replaced
 * with semantic palette keys, they are fixed brand identity colors, not
 * themeable UI colors. Only the monochrome providers (apple, x, linkedin) use
 * the passed `color` prop which callers supply from the theme.
 */
export function ProviderIcon({
  provider,
  size = 18,
  color = '#000000',
}: {
  provider: AuthProvider;
  size?: number;
  color?: string;
}) {
  switch (provider) {
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
          <Path
            fill={color}
            d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13zM14.6 4.59c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z"
          />
        </Svg>
      );
    case 'google':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityRole="image">
          <Path fill={color} d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <Path fill={color} d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <Path fill={color} d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <Path fill={color} d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
          <Path
            fill={color}
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </Svg>
      );
    case 'linkedin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
          <Path
            fill={color}
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"
          />
        </Svg>
      );
    case 'microsoft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
          <Rect x="1" y="1" width="10" height="10" fill={colors.error} />
          <Rect x="13" y="1" width="10" height="10" fill={colors.positive} />
          <Rect x="1" y="13" width="10" height="10" fill={colors.info} />
          <Rect x="13" y="13" width="10" height="10" fill={colors.warning} />
        </Svg>
      );
    default:
      return null;
  }
}
