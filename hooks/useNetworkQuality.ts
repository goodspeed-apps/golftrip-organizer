/**
 * GAS Template, useNetworkQuality Hook
 *
 * Maps NetInfo connection type to quality tiers.
 */

import { useState, useEffect } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline';

function mapQuality(state: NetInfoState): NetworkQuality {
  if (!state.isConnected) return 'offline';
  const type = state.type;
  if (type === 'wifi' || type === 'ethernet') return 'excellent';
  if (type === 'cellular') {
    const gen = (state.details as { cellularGeneration?: string })?.cellularGeneration;
    if (gen === '4g' || gen === '5g') return 'good';
    return 'poor';
  }
  return 'good';
}

export function useNetworkQuality() {
  const [state, setState] = useState<NetInfoState | null>(null);
  const [quality, setQuality] = useState<NetworkQuality>('good');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState(netState);
      setQuality(mapQuality(netState));
    });
    return () => unsubscribe();
  }, []);

  return {
    type: state?.type ?? 'unknown',
    isConnected: state?.isConnected ?? true,
    isInternetReachable: state?.isInternetReachable ?? true,
    quality,
  };
}
