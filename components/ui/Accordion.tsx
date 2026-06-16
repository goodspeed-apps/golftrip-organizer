/**
 * GAS Template, Accordion
 *
 * Collapsible content sections with animated expand/collapse.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import { useThemeColors } from '../../context/ThemeContext';

export interface AccordionSection {
  key: string;
  title: string;
  content: React.ReactNode;
}

export interface AccordionProps {
  sections: AccordionSection[];
  /** Allow multiple sections open at once (default: false) */
  multiExpand?: boolean;
}

export function Accordion({ sections, multiExpand = false }: AccordionProps) {
  const { colors } = useThemeColors();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(multiExpand ? prev : []);
      if (prev.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [multiExpand]);

  return (
    <Animated.View layout={LinearTransition} style={{ gap: 2 }}>
      {sections.map(section => {
        const isOpen = expanded.has(section.key);
        return (
          <View key={section.key}>
            <TouchableOpacity
              onPress={() => toggle(section.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 12,
              }}
              accessibilityLabel={section.title}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                {section.title}
              </Text>
              <Animated.View
                style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <ChevronDown size={18} color={colors.textSecondary} />
              </Animated.View>
            </TouchableOpacity>

            {isOpen && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={{ paddingHorizontal: 16, paddingBottom: 12 }}
              >
                {section.content}
              </Animated.View>
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}
