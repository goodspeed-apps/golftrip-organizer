import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';

interface Member { id: string; display_name: string | null; guest_name: string | null; }
interface Props {
  tripId: string; paidBy: string; onPaidByChange: (id: string) => void;
  splitType: 'all' | 'day' | 'people'; onSplitTypeChange: (t: 'all' | 'day' | 'people') => void;
  splitDate: string; onSplitDateChange: (d: string) => void;
  splitMemberIds: string[]; onSplitMemberIdsChange: (ids: string[]) => void;
}

const SPLITS: { key: 'all' | 'day' | 'people'; label: string }[] = [
  { key: 'all', label: 'All Players' }, { key: 'day', label: 'By Day' }, { key: 'people', label: 'Select People' },
];

export function SplitSelector({ tripId, paidBy, onPaidByChange, splitType, onSplitTypeChange, splitDate, onSplitDateChange, splitMemberIds, onSplitMemberIdsChange }: Props) {
  const colors = useThemeColors();
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!tripId) return;
    supabase.from('trip_members').select('id, guest_name, users(display_name)').eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (error) { captureException(error, { screen: 'SplitSelector', action: 'fetchMembers' }); return; }
        setMembers((data ?? []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          display_name: (m.users as { display_name: string } | null)?.display_name ?? null,
          guest_name: m.guest_name as string | null,
        })));
      });
  }, [tripId]);

  const toggleMember = (id: string) => {
    onSplitMemberIdsChange(splitMemberIds.includes(id) ? splitMemberIds.filter(x => x !== id) : [...splitMemberIds, id]);
  };

  const nameOf = (m: Member) => m.display_name ?? m.guest_name ?? 'Member';

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>PAID BY</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {members.map(m => (
          <Pressable key={m.id} onPress={() => onPaidByChange(m.id)} accessibilityLabel={`Paid by ${nameOf(m)}`} accessibilityHint="Select who paid for this expense"
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: paidBy === m.id ? colors.primary : colors.border, backgroundColor: paidBy === m.id ? colors.primaryMuted : colors.surface }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: paidBy === m.id ? colors.primary : colors.text }}>{nameOf(m)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>SPLIT TYPE</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SPLITS.map(s => (
          <Pressable key={s.key} onPress={() => onSplitTypeChange(s.key)} accessibilityLabel={s.label} accessibilityHint={`Split expense among ${s.label}`}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: splitType === s.key ? colors.primary : colors.border, backgroundColor: splitType === s.key ? colors.primaryMuted : colors.surface }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: splitType === s.key ? colors.primary : colors.textSecondary }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {splitType === 'people' && members.length > 0 && (
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {members.map(m => {
            const sel = splitMemberIds.includes(m.id);
            return (
              <Pressable key={m.id} onPress={() => toggleMember(m.id)} accessibilityLabel={nameOf(m)} accessibilityHint="Toggle this person in split"
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.secondaryMuted : colors.surface }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: sel ? colors.accent : colors.text }}>{nameOf(m)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {splitType === 'day' && (
        <View style={{ marginTop: 12 }}>
          <TextInput value={splitDate} onChangeText={onSplitDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
            style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.text, borderWidth: 1, borderColor: colors.border }} />
        </View>
      )}
    </Animated.View>
  );
}

import { TextInput } from 'react-native';
