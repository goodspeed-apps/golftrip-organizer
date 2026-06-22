/**
 * GAS Template, ChangelogModal
 *
 * "What's New" modal shown once per app version.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { getItem, setItem } from '../lib/storage';
import { appVersion } from '../lib/platform';
import { useThemeColors } from '../context/ThemeContext';
import { gasConfig } from '../gas.config';

export interface ChangelogEntry {
  title: string;
  description: string;
}

export interface ChangelogModalProps {
  entries: ChangelogEntry[];
  /** Override version check (force show). */
  forceShow?: boolean;
  onDismiss?: () => void;
}

const STORAGE_KEY = 'changelog_seen_version';

export function ChangelogModal({ entries, forceShow = false, onDismiss }: ChangelogModalProps) {
  const { colors } = useThemeColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceShow) { setVisible(true); return; }
    getItem<string>(STORAGE_KEY).then(seen => {
      if (seen !== appVersion) setVisible(true);
    });
  }, [forceShow]);

  const dismiss = useCallback(() => {
    setItem(STORAGE_KEY, appVersion);
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible || entries.length === 0) return null;

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center',
      padding: 24, zIndex: 9999,
    }}>
      <View style={{
        backgroundColor: colors.surface, borderRadius: 24, padding: 28,
        width: '100%', maxWidth: 360, maxHeight: '80%',
      }}>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Sparkles size={28} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 8 }}>
            What's New
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            v{appVersion}
          </Text>
        </View>

        <ScrollView style={{ maxHeight: 300 }}>
          {entries.map((entry, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                {entry.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                {entry.description}
              </Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          onPress={dismiss}
          style={{
            backgroundColor: colors.primary, borderRadius: 14,
            paddingVertical: 14, alignItems: 'center', marginTop: 16,
          }}
          accessibilityLabel="Dismiss changelog"
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
