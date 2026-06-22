import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Clock, MapPin, DollarSign, Plus } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface TeeTime {
  id: string;
  course_name: string;
  tee_time: string;
  holes: number;
  cost_per_player?: number | null;
  notes?: string | null;
}

export interface ItineraryEvent {
  id: string;
  title: string;
  event_time?: string | null;
  location?: string | null;
  notes?: string | null;
  event_type: 'activity' | 'meal' | 'travel' | 'other';
}

export interface TripDay {
  date: string;
  day_label: string;
  tee_times: TeeTime[];
  events: ItineraryEvent[];
}

interface TripDaySectionProps {
  day: TripDay;
  index: number;
  onAddTeeTime?: () => void;
  onAddEvent?: () => void;
  onPressTeeTime?: (t: TeeTime) => void;
  onPressEvent?: (e: ItineraryEvent) => void;
}

const EVENT_EMOJI: Record<string, string> = {
  activity: '🏌️',
  meal: '🍽️',
  travel: '✈️',
  other: '📌',
};

export function TripDaySection({
  day,
  index,
  onAddTeeTime,
  onAddEvent,
  onPressTeeTime,
  onPressEvent,
}: TripDaySectionProps) {
  const colors = useThemeColors();

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* Day header */}
      <View style={[styles.dayHeader, { backgroundColor: colors.primary }]}>
        <Text style={[styles.dayNum, { color: colors.textOnPrimary }]}>{day.day_label}</Text>
        <Text style={[styles.dayDate, { color: colors.textOnPrimary }]}>
          {formatDayLabel(day.date)}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Tee Times */}
        {day.tee_times.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>⛳ Tee Times</Text>
            {day.tee_times.map((tt) => (
              <TeeTimeCard
                key={tt.id}
                teeTime={tt}
                colors={colors}
                formatTime={formatTime}
                onPress={() => onPressTeeTime?.(tt)}
              />
            ))}
          </View>
        )}

        {/* Events */}
        {day.events.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>📋 Schedule</Text>
            {day.events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                colors={colors}
                formatTime={formatTime}
                onPress={() => onPressEvent?.(ev)}
              />
            ))}
          </View>
        )}

        {day.tee_times.length === 0 && day.events.length === 0 && (
          <Text style={[styles.emptyDay, { color: colors.textMuted }]}>
            Nothing planned yet, add a tee time or activity!
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <AddButton
            label="Tee Time"
            icon={<Clock size={13} color={colors.primary} />}
            onPress={onAddTeeTime}
            colors={colors}
          />
          <AddButton
            label="Activity"
            icon={<Plus size={13} color={colors.secondary} />}
            onPress={onAddEvent}
            colors={colors}
            secondary
          />
        </View>
      </View>
    </Animated.View>
  );
}

function TeeTimeCard({
  teeTime,
  colors,
  formatTime,
  onPress,
}: {
  teeTime: TeeTime;
  colors: ReturnType<typeof useThemeColors>;
  formatTime: (s: string) => string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`Tee time at ${teeTime.course_name}`}
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.primaryMuted, borderColor: colors.borderAccent }]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.courseName, { color: colors.primary }]} numberOfLines={1}>
            {teeTime.course_name}
          </Text>
          <View style={styles.cardMeta}>
            <Clock size={12} color={colors.primary} />
            <Text style={[styles.cardMetaText, { color: colors.primary }]}>
              {formatTime(teeTime.tee_time)}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={[styles.holes, { color: colors.textSecondary }]}>
            {teeTime.holes} holes
          </Text>
          {(teeTime.cost_per_player ?? 0) > 0 && (
            <View style={styles.cardMeta}>
              <DollarSign size={12} color={colors.success} />
              <Text style={[styles.cardMetaText, { color: colors.success }]}>
                {(teeTime.cost_per_player ?? 0).toFixed(0)}/player
              </Text>
            </View>
          )}
        </View>
        {teeTime.notes ? (
          <Text style={[styles.notes, { color: colors.textMuted }]} numberOfLines={2}>
            {teeTime.notes}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function EventCard({
  event,
  colors,
  formatTime,
  onPress,
}: {
  event: ItineraryEvent;
  colors: ReturnType<typeof useThemeColors>;
  formatTime: (s: string) => string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`Event: ${event.title}`}
        accessibilityRole="button"
        style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      >
        <View style={styles.cardTop}>
          <Text style={styles.eventEmoji}>{EVENT_EMOJI[event.event_type] ?? '📌'}</Text>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
        </View>
        <View style={styles.eventMeta}>
          {event.event_time && (
            <View style={styles.cardMeta}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: colors.textMuted }]}>
                {formatTime(event.event_time)}
              </Text>
            </View>
          )}
          {event.location && (
            <View style={styles.cardMeta}>
              <MapPin size={12} color={colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AddButton({
  label,
  icon,
  onPress,
  colors,
  secondary,
}: {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  secondary?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[anim, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityLabel={`Add ${label}`}
        accessibilityRole="button"
        style={[
          styles.addBtn,
          {
            borderColor: secondary ? colors.secondary : colors.primary,
            backgroundColor: secondary ? colors.secondaryMuted : colors.primaryMuted,
          },
        ]}
      >
        {icon}
        <Text style={[styles.addBtnText, { color: secondary ? colors.secondary : colors.primary }]}>
          + {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dayHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayDate: {
    fontSize: 13,
    opacity: 0.85,
  },
  body: {
    padding: 14,
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  holes: {
    fontSize: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notes: {
    fontSize: 12,
    lineHeight: 16,
  },
  eventEmoji: {
    fontSize: 16,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emptyDay: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 44,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
