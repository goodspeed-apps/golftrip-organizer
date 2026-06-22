import { supabase } from '@/lib/supabase';
import { withCache, trackApiLatency } from '@/services/api';
import { captureException } from '@/lib/sentry';
import type { TripWithMemberCount } from '@/types/golf';

export async function fetchMyTrips(userId: string): Promise<{
  upcoming: TripWithMemberCount[];
  past: TripWithMemberCount[];
  error: string | null;
}> {
  const end = trackApiLatency('fetchMyTrips');
  try {
    const { data: memberRows, error: memberError } = await supabase
      .from('trip_members')
      .select('trip_id, rsvp_status')
      .eq('user_id', userId);

    if (memberError) throw memberError;
    if (!memberRows?.length) return { upcoming: [], past: [], error: null };

    const tripIds = memberRows.map((r) => r.trip_id);

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .in('id', tripIds)
      .neq('status', 'archived')
      .order('start_date', { ascending: true });

    if (tripsError) throw tripsError;

    const { data: counts } = await supabase
      .from('trip_members')
      .select('trip_id')
      .in('trip_id', tripIds)
      .eq('rsvp_status', 'accepted');

    const today = new Date().toISOString().split('T')[0];
    const result: TripWithMemberCount[] = (trips ?? []).map((t) => {
      const memberRow = memberRows.find((m) => m.trip_id === t.id);
      const memberCount = (counts ?? []).filter((c) => c.trip_id === t.id).length;
      return { ...t, member_count: memberCount, my_rsvp: memberRow?.rsvp_status ?? null };
    });

    const upcoming = result.filter((t) => t.end_date >= today);
    const past = result.filter((t) => t.end_date < today);

    return { upcoming, past, error: null };
  } catch (err) {
    captureException(err as Error, { screen: 'dashboard', action: 'fetchMyTrips' });
    return { upcoming: [], past: [], error: 'Could not load your trips.' };
  } finally {
    end();
  }
}

export async function deleteTrip(tripId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) {
    captureException(error, { screen: 'dashboard', action: 'deleteTrip' });
    return { error: error.message };
  }
  return { error: null };
}
