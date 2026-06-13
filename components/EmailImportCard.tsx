import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CheckCircle, Edit3, Calendar, Clock, Users, Hash } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

interface EmailImport {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: string;
  received_at: string;
}

interface Props {
  item: EmailImport;
  isConfirmed: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function EmailImportCard({ item, isConfirmed, onConfirm, onEdit }: Props) {
  const colors = useThemeColors();
  const confirmScale = useSharedValue(1);
  const editScale = useSharedValue(1);

  const confirmStyle = useAnimatedStyle(() => ({ transform: [{ scale: confirmScale.value }] }));
  const editStyle = useAnimatedStyle(() => ({ transform: [{ scale: editScale.value }] }));

  const fmt = (val: string | null, fallback: string) => val ?? fallback;
  const fmtDate = (d: string | null) => {
    if (!d) return 'TBD';
    try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  return (
    <Animated.View
      style={{
        backgroundColor: isConfirmed ? colors.positiveMuted : colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: isConfirmed ? colors.positive : colors.border,
        gap: 12,
        shadowColor: colors.shadow,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      {isConfirmed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={18} color={colors.positive} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.positive }}>Added to Itinerary</Text>
        </View>
      )}

      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text }}>
        {fmt(item.parsed_course_name, 'Unknown Course')}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>{fmtDate(item.parsed_tee_date)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>{fmt(item.parsed_tee_time, 'TBD')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>{(item.parsed_player_count ?? 0)} players</Text>
        </View>
        {item.parsed_confirmation_number && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Hash size={14} color={colors.textSecondary} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>{item.parsed_confirmation_number}</Text>
          </View>
        )}
      </View>

      {!isConfirmed && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Animated.View style={[editStyle, { flex: 1 }]}>
            <Pressable
              onPressIn={() => { editScale.value = withSpring(0.97, { damping: 15 }); }}
              onPressOut={() => { editScale.value = withSpring(1, { damping: 15 }); }}
              onPress={onEdit}
              accessibilityLabel="Edit before saving"
              accessibilityHint="Opens tee time editor prefilled with parsed details"
              style={{ flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Edit3 size={15} color={colors.primary} />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.primary }}>Edit</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[confirmStyle, { flex: 1 }]}>
            <Pressable
              onPressIn={() => { confirmScale.value = withSpring(0.97, { damping: 15 }); }}
              onPressOut={() => { confirmScale.value = withSpring(1, { damping: 15 }); }}
              onPress={onConfirm}
              accessibilityLabel="Confirm tee time"
              accessibilityHint="Adds this parsed tee time directly to the trip itinerary"
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <CheckCircle size={15} color={colors.textOnPrimary} />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textOnPrimary }}>Confirm</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}
