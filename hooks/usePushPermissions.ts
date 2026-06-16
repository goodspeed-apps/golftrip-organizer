import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { requestPermission } from '../services/push';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface UsePushPermissionsResult {
  status: PushPermissionStatus;
  requestPermission: () => Promise<PushPermissionStatus>;
  isLoading: boolean;
}

export function usePushPermissions(): UsePushPermissionsResult {
  const [status, setStatus] = useState<PushPermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(true);
  // Tracks mount state so async callbacks don't update state after unmount (I6).
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Notifications.getPermissionsAsync()
      .then(result => {
        if (active) setStatus(result.status as PushPermissionStatus);
      })
      .catch(() => {
        if (active) setStatus('undetermined');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleRequestPermission = useCallback(async (): Promise<PushPermissionStatus> => {
    if (!isMountedRef.current) return 'undetermined';
    setIsLoading(true);
    try {
      const newStatus = await requestPermission();
      if (isMountedRef.current) setStatus(newStatus);
      return newStatus;
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  return {
    status,
    requestPermission: handleRequestPermission,
    isLoading,
  };
}