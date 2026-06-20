/**
 * GAS Template, usePermission Hook
 *
 * Check and request device permissions with openSettings fallback.
 */

import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { openAppSettings } from '../lib/linking';

export type PermissionType = 'camera' | 'mediaLibrary' | 'notifications';
export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

const permissionMap = {
  camera: {
    check: () => ImagePicker.getCameraPermissionsAsync(),
    request: () => ImagePicker.requestCameraPermissionsAsync(),
  },
  mediaLibrary: {
    check: () => ImagePicker.getMediaLibraryPermissionsAsync(),
    request: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
  },
  notifications: {
    check: () => Notifications.getPermissionsAsync(),
    request: () => Notifications.requestPermissionsAsync(),
  },
};

export function usePermission(type: PermissionType) {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');

  useEffect(() => {
    permissionMap[type].check().then(result => {
      setStatus(result.status as PermissionStatus);
    });
  }, [type]);

  const request = useCallback(async () => {
    const result = await permissionMap[type].request();
    const newStatus = result.status as PermissionStatus;
    setStatus(newStatus);
    return newStatus;
  }, [type]);

  return { status, request, openSettings: openAppSettings };
}
