// lib/att.ts
// App Tracking Transparency helpers. iOS-only.

import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';

let _requested = false;

export type ATTStatus = 'granted' | 'denied' | 'unavailable' | 'undetermined';

export async function requestATTOnce(): Promise<ATTStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  if (_requested) {
    const current = await getTrackingPermissionsAsync();
    return mapStatus(current.status);
  }
  _requested = true;
  const result = await requestTrackingPermissionsAsync();
  return mapStatus(result.status);
}

export async function getATTStatus(): Promise<ATTStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const r = await getTrackingPermissionsAsync();
  return mapStatus(r.status);
}

function mapStatus(s: string): ATTStatus {
  switch (s) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    case 'undetermined': return 'undetermined';
    default: return 'unavailable';
  }
}