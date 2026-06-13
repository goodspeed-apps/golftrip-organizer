/**
 * GAS Template, HowToUseModal
 *
 * Tutorial modal with configurable workflow tiles. Each tile opens
 * a WalkthroughModal for step-by-step guided instruction.
 *
 * Features:
 * - Data-driven workflow tiles via props (icon, title, description, color)
 * - Connects to WalkthroughModal for step-by-step walkthroughs
 * - Scroll view for variable number of tiles
 * - Config-driven app name in header
 * - Theme-aware colors from gasConfig
 * - Analytics: tracks modal open, tile taps
 * - Sentry breadcrumb on open
 * - Accessibility labels on all interactive elements
 *
 * Extracted from ThreadLift's HowToUseModal, made generic and data-driven.
 *
 * Dependencies: WalkthroughModal, gasConfig, lib/posthog, lib/sentry, lucide-react-native
 */

import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { WalkthroughModal, type WalkthroughStep } from './WalkthroughModal';
import { captureEvent } from '@/lib/posthog';
import { addBreadcrumb } from '@/lib/sentry';
import { gasConfig } from '../gas.config';
import { useThemeColors } from '@/context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowTile {
  /** Unique identifier for this workflow */
  id: string;
  /** Lucide icon component to display */
  icon: React.ElementType;
  /** Accent color for the icon circle and walkthrough theme */
  color: string;
  /** Short workflow title */
  title: string;
  /** One-line description of what the user will learn */
  description: string;
  /** Steps shown in the WalkthroughModal when this tile is tapped */
  steps: WalkthroughStep[];
}

interface HowToUseModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Array of workflow tiles to display */
  tiles: WorkflowTile[];
}

// ─── Component ───────────────────────────────────────────────────────────────

const bgDark = gasConfig.design.colors.backgroundDark;
const surfaceDark = gasConfig.design.colors.surfaceDark;
const borderDark = gasConfig.design.colors.borderDark;

/**
 * HowToUseModal, Tutorial modal with configurable workflow tiles.
 *
 * Usage:
 *   const WORKFLOWS: WorkflowTile[] = [
 *     { id: 'track', icon: TrendingUp, color: '#FF4500', title: 'Track Trends',
 *       description: 'Learn to spot viral content early',
 *       steps: [{ icon: TrendingUp, iconColor: '#FF4500', title: 'Open Feed', description: '...' }]
 *     },
 *   ];
 *
 *   <HowToUseModal visible={showHelp} onClose={() => setShowHelp(false)} tiles={WORKFLOWS} />
 */
export function HowToUseModal({ visible, onClose, tiles }: HowToUseModalProps) {
  const { colors } = useThemeColors();
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowTile | null>(null);

  const handleOpen = () => {
    captureEvent('how_to_use_opened');
    addBreadcrumb('ui', 'HowToUseModal opened');
  };

  const handleTileTap = (tile: WorkflowTile) => {
    captureEvent('how_to_use_tile_tapped', { tile: tile.id, title: tile.title });
    setActiveWorkflow(tile);
  };

  const handleWalkthroughClose = () => {
    setActiveWorkflow(null);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={onClose}
        onShow={handleOpen}
      >
        <View style={{ flex: 1, backgroundColor: bgDark }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 64,
            paddingBottom: 8,
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '700' }}>
              How to Use {gasConfig.app.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 8 }}
              accessibilityLabel="Close tutorial"
            >
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tiles */}
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            {tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <TouchableOpacity
                  key={tile.id}
                  onPress={() => handleTileTap(tile)}
                  style={{
                    backgroundColor: surfaceDark,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    borderWidth: 1,
                    borderColor: borderDark,
                  }}
                  accessibilityLabel={`${tile.title}: ${tile.description}`}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: tile.color + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={24} color={tile.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                      {tile.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                      {tile.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {activeWorkflow && (
        <WalkthroughModal
          visible={!!activeWorkflow}
          onClose={handleWalkthroughClose}
          title={activeWorkflow.title}
          color={activeWorkflow.color}
          steps={activeWorkflow.steps}
        />
      )}
    </>
  );
}
