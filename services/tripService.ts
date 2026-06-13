import { supabase } from '@/lib/supabase';
import { withCache, trackApiLatency } from '@/services/api';
import { captureException } from '@/lib/sentry';
import { Trip, TripWithMemberCount, TripMember, TeeTime, Expense, Score, Round, Message } from '@/types/app';

export async function fetchUserTrips(userId: string): Promise<{ upcoming: TripWithMemberCount[]; past: TripWithMemberCount[] }> {
  return withCache(`user_trips_${userId}`, async () => {
    const end = trackApiLatency('fetchUserTrips');
    try {
      const { data: memberRows, error: memberError } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', userId);
      if (memberError) throw memberError;

      const tripIds = (memberRows ?? []).map((r: { trip_id: string }) => r.trip_id);
      if (tripIds.length === 0) return { upcoming: [], past: [] };

      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('start_date', { ascending: true });
      if (error) throw error;

      const now = new Date();
      const enriched: TripWithMemberCount[] = await Promise.all(
        (trips ?? []).map(async (t: Trip) => {
          const { count } = await supabase
            .from('trip_members')
            .select('*', { count: 'exact', head: true })
            .eq('trip_id', t.id);
          const start = new Date(t.start_date);
          const days_until = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 86400000));
          return { ...t, member_count: count ?? 0, days_until };
        })
      );

      const upcoming = enriched.filter((t) => new Date(t.end_date) >= now);
      const past = enriched.filter((t) => new Date(t.end_date) < now);
      return { upcoming, past };
    } catch (e) {
      captureException(e as Error, { screen: 'dashboard', action: 'fetchUserTrips' });
      throw e;
    } finally {
      end();
    }
  }, 60);
}

export async function createTrip(payload: Partial<Trip>): Promise<Trip> {
  const end = trackApiLatency('createTrip');
  try {
    const { data, error } = await supabase.from('trips').insert(payload).select().single();
    if (error) throw error;
    return data as Trip;
  } catch (e) {
    captureException(e as Error, { screen: 'create-trip', action: 'createTrip' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchTripMembers(tripId: string): Promise<TripMember[]> {
  const end = trackApiLatency('fetchTripMembers');
  try {
    const { data, error } = await supabase.from('trip_members').select('*').eq('trip_id', tripId);
    if (error) throw error;
    return (data ?? []) as TripMember[];
  } catch (e) {
    captureException(e as Error, { screen: 'trip', action: 'fetchTripMembers' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchTeeTimes(tripId: string): Promise<TeeTime[]> {
  const end = trackApiLatency('fetchTeeTimes');
  try {
    const { data, error } = await supabase
      .from('tee_times')
      .select('*')
      .eq('trip_id', tripId)
      .order('tee_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TeeTime[];
  } catch (e) {
    captureException(e as Error, { screen: 'itinerary', action: 'fetchTeeTimes' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchExpenses(tripId: string): Promise<Expense[]> {
  const end = trackApiLatency('fetchExpenses');
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Expense[];
  } catch (e) {
    captureException(e as Error, { screen: 'expenses', action: 'fetchExpenses' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchRounds(tripId: string): Promise<Round[]> {
  const end = trackApiLatency('fetchRounds');
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('trip_id', tripId)
      .order('round_date', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Round[];
  } catch (e) {
    captureException(e as Error, { screen: 'scores', action: 'fetchRounds' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchScores(tripId: string): Promise<Score[]> {
  const end = trackApiLatency('fetchScores');
  try {
    const { data, error } = await supabase.from('scores').select('*').eq('trip_id', tripId);
    if (error) throw error;
    return (data ?? []) as Score[];
  } catch (e) {
    captureException(e as Error, { screen: 'scores', action: 'fetchScores' });
    throw e;
  } finally {
    end();
  }
}

export async function fetchMessages(tripId: string): Promise<Message[]> {
  const end = trackApiLatency('fetchMessages');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('trip_id', tripId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Message[];
  } catch (e) {
    captureException(e as Error, { screen: 'chat', action: 'fetchMessages' });
    throw e;
  } finally {
    end();
  }
}
