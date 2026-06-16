import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutRight } from 'react-native-reanimated';
import { CheckCircle, AlertCircle, Edit3, Calendar, Clock, Users, Hash } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type ParseStatus = 'awaiting_email' | 'parsing' | 'parsed_preview' | 'confirmed' | 'parse_failed_manual_fallback';

interface EmailImport {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: ParseStatus;
  sender_email: string | null;
  received_at: string;
  tee_time_id: string | null;
}

interface Props {
  item: EmailImport;
  index: number;
  isConfirmed: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function ImportEntryCard({ item, index, isConfirmed, onConfirm, onEdit }: Props) {
  const colors = useThemeColors();
  const failed = item.parse_status === 'parse_failed_manual_fallback';

  return (
    <Animated.View
      entering={FadeInDown.delay(50 * index).duration(350)}
      exiting={FadeOutRight.duration(300)}
      style={{
        backgroundColor: colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: isConfirmed ? colors.success : failed ? colors.warning : colors.border,
        padding: 16, marginBottom: 12, overflow: 'hidden',
      }}
    >
      {failed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <AlertCircle size={14} color={colors.warning} />
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.warning, marginLeft: 6 }}>
            Parsing incomplete, please review manually
          </Text>
        </View>
      )}

      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
        {item.parsed_course_name ?? 'Unknown Course'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {[
          { Icon: Calendar, label: item.parsed_tee_date ?? ', ' },
          { Icon: Clock, label: item.parsed_tee_time ?? ', ' },
          { Icon: Users, label: `${item.parsed_player_count ?? 0} players` },
          { Icon: Hash, label: item.parsed_confirmation_number ?? ', ' },
        ].map(({ Icon, label }, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.surfaceSecondary, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 5,
          }}>
            <Icon size={12} color={colors.textSecondary} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginLeft: 5 }}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onEdit}
          accessibilityLabel="Edit tee time before saving"
          accessibilityHint="Opens the add tee time form prefilled with parsed details"
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
            paddingVertical: 10,
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Edit3 size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary, marginLeft: 6 }}>
            Edit
          </Text>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          accessibilityLabel="Confirm and add tee time to itinerary"
          accessibilityHint="Saves this parsed tee time directly to your trip itinerary"
          style={({ pressed }) => ({
            flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isConfirmed ? colors.success : colors.primary,
            borderRadius: 12, paddingVertical: 10,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <CheckCircle size={14} color={colors.textOnPrimary} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textOnPrimary, marginLeft: 6 }}>
            {isConfirmed ? 'Added ✓' : 'Confirm & Add'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
