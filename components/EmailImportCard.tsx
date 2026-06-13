import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Calendar, Clock, Users, Hash, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';

type EmailImport = {
  id: string;
  parsed_course_name: string | null;
  parsed_tee_date: string | null;
  parsed_tee_time: string | null;
  parsed_player_count: number | null;
  parsed_confirmation_number: string | null;
  parse_status: string;
  received_at: string;
};

type Props = {
  item: EmailImport;
  confirming: boolean;
  onConfirm: () => void;
  onEdit: () => void;
};

export function EmailImportCard({ item, confirming, onConfirm, onEdit }: Props) {
  const colors = useThemeColors();

  const formatDate = (d: string | null) => {
    if (!d) return ', ';
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (t: string | null) => {
    if (!t) return ', ';
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }}>
      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 10 }} numberOfLines={1}>
        {item.parsed_course_name ?? 'Unknown Course'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Calendar size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{formatDate(item.parsed_tee_date)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Clock size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{formatTime(item.parsed_tee_time)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Users size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{(item.parsed_player_count ?? 0)} players</Text>
        </View>
        {item.parsed_confirmation_number ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Hash size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>{item.parsed_confirmation_number}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onEdit}
          accessibilityLabel="Edit tee time before saving"
          accessibilityHint="Opens the add tee time form prefilled with parsed details"
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingVertical: 10,
            minHeight: 44,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ChevronRight size={16} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>Edit</Text>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          disabled={confirming}
          accessibilityLabel="Confirm and add tee time to itinerary"
          accessibilityHint="Saves this parsed tee time directly to your trip itinerary"
          style={({ pressed }) => ({
            flex: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingVertical: 10,
            minHeight: 44,
            opacity: pressed || confirming ? 0.75 : 1,
          })}
        >
          {confirming
            ? <ActivityIndicator size="small" color={colors.textOnPrimary} />
            : (
              <>
                <CheckCircle2 size={16} color={colors.textOnPrimary} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textOnPrimary }}>Confirm & Add</Text>
              </>
            )}
        </Pressable>
      </View>
    </View>
  );
}
