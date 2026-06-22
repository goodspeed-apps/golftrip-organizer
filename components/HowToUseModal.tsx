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
 * - Theme-aware colors via ThemeContext (useThemeColors)
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
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../gas.config';

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
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 64,
            paddingBottom: 8,
          }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
              How to Use {gasConfig.app.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel="Close tutorial"
              accessibilityRole="button"
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 14, paddingHorizontal: 24, marginBottom: 24 }}>
            Choose a workflow to learn step by step
          </Text>

          {/* Workflow tiles */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
          >
            {tiles.map(tile => {
              const Icon = tile.icon;
              return (
                <TouchableOpacity
                  key={tile.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={() => handleTileTap(tile)}
                  accessibilityLabel={tile.title}
                  accessibilityHint={`Learn: ${tile.description}`}
                  accessibilityRole="button"
                >
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: tile.color + '18',
                    borderWidth: 1,
                    borderColor: tile.color + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}>
                    <Icon size={24} color={tile.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 3 }}>
                      {tile.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {tile.description}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 22, marginLeft: 8 }} accessible={false}>›</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Walkthrough for the active workflow */}
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
