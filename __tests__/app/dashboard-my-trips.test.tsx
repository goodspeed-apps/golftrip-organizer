
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import DashboardScreen from '../../app/(tabs)/dashboard';

// ── External module mocks ────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: any) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('lucide-react-native', () => ({
  Plus: () => null,
  Flag: () => null,
}));

jest.mock('@/context/ThemeContext', () => ({
  useThemeColors: () => ({
    colors: {
      background: '#fff',
      text: '#000',
      primary: '#007AFF',
      error: '#FF3B30',
    },
  }),
}));

const mockTrack = jest.fn();
jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', displayName: 'Alice' } }),
}));

jest.mock('@/lib/sentry', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/performance', () => ({
  trackScreenLoad: jest.fn(),
  trackApiLatency: jest.fn(() => jest.fn()),
}));

// ── Component mocks ──────────────────────────────────────────────────────────

jest.mock('@/components/ui/EmptyState', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    EmptyState: ({ title, subtitle }: { title: string; subtitle: string }) =>
      React.createElement(
        View,
        { testID: 'empty-state' },
        React.createElement(Text, null, title),
        React.createElement(Text, null, subtitle)
      ),
  };
});

jest.mock('@/components/ui/LoadingSkeleton', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LoadingSkeleton: ({ variant }: { variant: string }) =>
      React.createElement(View, { testID: `loading-skeleton-${variant}` }),
  };
});

jest.mock('@/components/trips/TripHeroCard', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    TripHeroCard: ({ trip, onPress }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID: `hero-card-${trip.id}`, onPress },
        React.createElement(Text, null, trip.name)
      ),
  };
});

jest.mock('@/components/trips/PastTripRow', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    PastTripRow: ({ trip, onPress }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID: `past-row-${trip.id}`, onPress },
        React.createElement(Text, null, trip.name)
      ),
  };
});

jest.mock('@/lib/theme', () => ({
  Spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  BorderRadius: { sm: 4, md: 8, lg: 16 },
}));

// ── Supabase mock ────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const futureDate = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

const pastDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const upcomingTrip: any = {
  id: 'trip-upcoming-1',
  name: 'Pebble Beach Escape',
  destination: 'Pebble Beach, CA',
  start_date: futureDate(10),
  end_date: futureDate(14),
  cover_image_url: null,
  status: 'active',
  member_limit: 8,
  invite_code: 'ABC123',
  organizer_id: 'user-1',
  recap_unlocked: false,
  created_at: new Date().toISOString(),
};

const pastTrip: any = {
  id: 'trip-past-1',
  name: 'Augusta Masters Trip',
  destination: 'Augusta, GA',
  start_date: pastDate(20),
  end_date: pastDate(16),
  cover_image_url: null,
  status: 'completed',
  member_limit: 4,
  invite_code: 'XYZ789',
  organizer_id: 'user-1',
  recap_unlocked: true,
  created_at: new Date().toISOString(),
};

function setupSupabaseMock({ trips = [upcomingTrip, pastTrip] }: { trips?: any[] } = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'trip_members') {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: trips.map((t) => ({ trip_id: t.id })),
          error: null,
        }),
      });

      // For member count queries (head: true)
      const selectCountFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 4, error: null }),
      });

      return {
        select: (fields: string, opts?: any) => {
          if (opts?.head) return selectCountFn(fields, opts);
          return selectFn(fields, opts);
        },
      };
    }

    if (table === 'trips') {
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: trips, error: null }),
          }),
        }),
      };
    }

    return {};
  });
}

function setupSupabaseMockEmpty() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'trip_members') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    return {};
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardScreen — My Trips', () => {
  const { router } = require('expo-router');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  it('renders loading skeleton while data is being fetched', async () => {
    // Never resolve so we stay in loading state
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn(() => new Promise(() => {})),
      }),
    });

    const { getByTestId } = await render(<DashboardScreen />);
    expect(getByTestId('loading-skeleton-card')).toBeTruthy();
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  it('renders the "My Trips" heading after loading', async () => {
    setupSupabaseMock();
    const { findByText } = await render(<DashboardScreen />);
    await findByText('My Trips');
  });

  // ── Upcoming trip cards ────────────────────────────────────────────────────
  it('renders upcoming trip hero cards with trip name', async () => {
    setupSupabaseMock();
    const { findByTestId, findByText } = await render(<DashboardScreen />);
    await findByTestId(`hero-card-${upcomingTrip.id}`);
    await findByText(upcomingTrip.name);
  });

  // ── Past trips section ─────────────────────────────────────────────────────
  it('renders Past Trips section header and past trip rows', async () => {
    setupSupabaseMock();
    const { findByText, findByTestId } = await render(<DashboardScreen />);
    await findByText('Past Trips');
    await findByTestId(`past-row-${pastTrip.id}`);
    await findByText(pastTrip.name);
  });

  // ── Empty state ────────────────────────────────────────────────────────────
  it('renders empty state when there are no upcoming trips', async () => {
    setupSupabaseMockEmpty();
    const { findByTestId, findByText } = await render(<DashboardScreen />);
    await findByTestId('empty-state');
    await findByText('No Upcoming Trips');
    await findByText('Create your first trip to get started!');
  });

  // ── FAB ────────────────────────────────────────────────────────────────────
  it('renders the Create New Trip FAB with correct accessibility label', async () => {
    setupSupabaseMock();
    const { findByLabelText } = await render(<DashboardScreen />);
    const fab = await findByLabelText('Create new trip');
    expect(fab).toBeTruthy();
  });

  it('navigates to /(modal)/create-trip when FAB is pressed', async () => {
    setupSupabaseMock();
    const { findByLabelText } = await render(<DashboardScreen />);
    const fab = await findByLabelText('Create new trip');
    fireEvent.press(fab);
    expect(router.push).toHaveBeenCalledWith('/(modal)/create-trip');
  });

  // ── Trip card navigation ───────────────────────────────────────────────────
  it('navigates to the itinerary when an upcoming trip card is pressed', async () => {
    setupSupabaseMock();
    const { findByTestId } = await render(<DashboardScreen />);
    const card = await findByTestId(`hero-card-${upcomingTrip.id}`);
    fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith(
      `/(tabs)/trip/${upcomingTrip.id}/itinerary`
    );
  });

  it('tracks tap_trip_card analytics event when a trip card is pressed', async () => {
    setupSupabaseMock();
    const { findByTestId } = await render(<DashboardScreen />);
    const card = await findByTestId(`hero-card-${upcomingTrip.id}`);
    fireEvent.press(card);
    expect(mockTrack).toHaveBeenCalledWith('tap_trip_card', {
      trip_id: upcomingTrip.id,
    });
  });

  it('navigates to the itinerary when a past trip row is pressed', async () => {
    setupSupabaseMock();
    const { findByTestId } = await render(<DashboardScreen />);
    const row = await findByTestId(`past-row-${pastTrip.id}`);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith(
      `/(tabs)/trip/${pastTrip.id}/itinerary`
    );
  });

  // ── Analytics on mount ─────────────────────────────────────────────────────
  it('tracks screen_view_dashboard on mount', async () => {
    setupSupabaseMock();
    render(<DashboardScreen />);
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('screen_view_dashboard')
    );
  });

  // ── Error state ────────────────────────────────────────────────────────────
  it('shows error message when data fetch fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'trip_members') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Network error'),
            }),
          }),
        };
      }
      return {};
    });

    const { findByText } = await render(<DashboardScreen />);
    await findByText("Couldn't load your trips. Pull down to try again.");
  });

  // ── No past trips — no section ─────────────────────────────────────────────
  it('does not render Past Trips section when there are no past trips', async () => {
    setupSupabaseMock({ trips: [upcomingTrip] });
    const { queryByText, findByText } = await render(<DashboardScreen />);
    await findByText('My Trips'); // wait for load
    await findByText(upcomingTrip.name);
    expect(queryByText('Past Trips')).toBeNull();
  });
});
