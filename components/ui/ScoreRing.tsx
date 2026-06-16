/**
 * GAS Template, ScoreRing
 *
 * Circular progress indicator with color-coded scoring.
 *
 * Features:
 * - SVG-based circle using react-native-svg
 * - 0-100 value range with animated stroke
 * - Color-coded: green >= 70, amber >= 50, grey < 50
 * - Configurable size, stroke width, and custom colors
 * - Optional center label (shows value by default)
 * - Theme-aware fallback colors
 *
 * Extracted from ThreadLift's trend/community score rings.
 *
 * Dependencies: react-native-svg, gasConfig (for color defaults)
 */

import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { gasConfig } from '../../gas.config';

interface ScoreRingProps {
  /** Score value from 0-100 */
  value: number;
  /** Outer size in pixels (default: 48) */
  size?: number;
  /** Stroke width in pixels (default: 4) */
  strokeWidth?: number;
  /** Override the auto-detected color */
  color?: string;
  /** Background ring color (default: border color from config) */
  bgColor?: string;
  /** Show the numeric value in the center (default: true) */
  showLabel?: boolean;
  /** Custom label text (overrides value display) */
  label?: string;
  /** Font size for the center label (default: auto-calculated from size) */
  fontSize?: number;
}

/**
 * getScoreColor, Returns a color based on score thresholds.
 *
 * Score thresholds (matching ThreadLift convention):
 * - >= 70: green (success)
 * - >= 50: amber (warning)
 * - < 50:  grey (muted)
 *
 * These thresholds are consistent across all GAS apps.
 */
export function getScoreColor(value: number): string {
  if (value >= 70) return gasConfig.design.colors.success;
  if (value >= 50) return gasConfig.design.colors.warning;
  return '#6B7280'; // neutral grey for low scores
}

/**
 * ScoreRing, Circular progress indicator.
 *
 * Usage:
 *   // Basic score ring
 *   <ScoreRing value={85} />
 *
 *   // Large score ring with custom size
 *   <ScoreRing value={42} size={72} strokeWidth={6} />
 *
 *   // Custom color override
 *   <ScoreRing value={100} color="#FF4500" />
 *
 *   // No label
 *   <ScoreRing value={65} showLabel={false} size={24} strokeWidth={3} />
 */
export function ScoreRing({
  value,
  size = 48,
  strokeWidth = 4,
  color,
  bgColor,
  showLabel = true,
  label,
  fontSize,
}: ScoreRingProps) {
  // Clamp value to 0-100
  const clamped = Math.max(0, Math.min(100, value ?? 0));

  // Calculate SVG circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  // Resolve colors
  const ringColor = color ?? getScoreColor(clamped);
  const ringBg = bgColor ?? gasConfig.design.colors.borderDark;

  // Auto-calculate font size based on ring size
  const resolvedFontSize = fontSize ?? Math.round(size * 0.28);

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`Score: ${clamped.toFixed(0)} out of 100`}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringBg}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center label */}
      {showLabel && (
        <Text
          style={{
            color: ringColor,
            fontSize: resolvedFontSize,
            fontWeight: '700',
          }}
        >
          {label ?? clamped.toFixed(0)}
        </Text>
      )}
    </View>
  );
}
