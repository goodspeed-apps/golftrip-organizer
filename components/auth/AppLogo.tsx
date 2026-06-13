/**
 * GAS Template, AppLogo
 *
 * Placeholder logo component that reads the primary color from gasConfig.
 *
 * Features:
 * - Parameterizable size prop (default: 100)
 * - Uses gasConfig.design.colors.primary for the background
 * - Simple geometric design: rounded square with abstract diamond shape
 * - Shadow glow matching the primary color
 * - All dimensions scale proportionally with the size prop
 *
 * The DevAgent replaces this with a custom app-specific logo design during
 * the development pipeline. This placeholder is functional out of the box
 * for auth screens, settings profile cards, and onboarding.
 *
 * Extracted from ThreadLift's AppLogo pattern, made generic and config-driven.
 *
 * Dependencies: gasConfig
 */

import { View } from 'react-native';
import { gasConfig } from '../../gas.config';

interface AppLogoProps {
  /** Logo size in pixels (default: 100) */
  size?: number;
}

/**
 * AppLogo, Placeholder logo for the app.
 *
 * Usage:
 *   // Default size (100px)
 *   <AppLogo />
 *
 *   // Custom size
 *   <AppLogo size={64} />
 *
 *   // In auth/welcome screen
 *   <View style={{ alignItems: 'center' }}>
 *     <AppLogo size={120} />
 *     <Text>{gasConfig.app.name}</Text>
 *   </View>
 */
export function AppLogo({ size = 100 }: AppLogoProps) {
  const s = size / 100; // Scale factor
  const primary = gasConfig.design.colors.primary;
  const r = Math.round(26 * s); // Corner radius scales with size

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: primary,
        borderRadius: r,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: primary,
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      {/* Abstract diamond/gem shape, replaced per-app by DevAgent */}
      <View
        style={{
          width: Math.round(36 * s),
          height: Math.round(36 * s),
          transform: [{ rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer diamond */}
        <View
          style={{
            width: Math.round(32 * s),
            height: Math.round(32 * s),
            borderRadius: Math.round(6 * s),
            borderWidth: Math.round(3 * s),
            borderColor: 'rgba(255, 255, 255, 0.45)',
          }}
        />
        {/* Inner diamond */}
        <View
          style={{
            position: 'absolute',
            width: Math.round(16 * s),
            height: Math.round(16 * s),
            borderRadius: Math.round(3 * s),
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
          }}
        />
      </View>
    </View>
  );
}
