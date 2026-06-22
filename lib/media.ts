/**
 * GAS Template, Media Picker Utilities
 *
 * Image picker, camera, and document picker with permission handling.
 *
 * Dependencies: expo-image-picker, expo-document-picker
 */

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { captureException } from './sentry';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export interface PickedDocument {
  uri: string;
  name: string;
  size: number | undefined;
  mimeType: string | undefined;
}

export interface ImagePickerOptions {
  allowsEditing?: boolean;
  quality?: number;
  base64?: boolean;
  aspect?: [number, number];
}

/** Pick an image from the library. Returns null if cancelled or denied. */
export async function pickImage(options?: ImagePickerOptions): Promise<PickedImage | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: options?.allowsEditing ?? true,
      quality: options?.quality ?? 0.8,
      base64: options?.base64 ?? false,
      aspect: options?.aspect,
    });

    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, width: asset.width, height: asset.height, base64: asset.base64 ?? undefined };
  } catch (err) {
    captureException(err, { component: 'media', action: 'pickImage' });
    return null;
  }
}

/** Take a photo with the camera. Returns null if cancelled or denied. */
export async function takePhoto(options?: ImagePickerOptions): Promise<PickedImage | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: options?.allowsEditing ?? true,
      quality: options?.quality ?? 0.8,
      base64: options?.base64 ?? false,
      aspect: options?.aspect,
    });

    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, width: asset.width, height: asset.height, base64: asset.base64 ?? undefined };
  } catch (err) {
    captureException(err, { component: 'media', action: 'takePhoto' });
    return null;
  }
}

/** Pick a document file. Returns null if cancelled. */
export async function pickDocument(options?: { type?: string[] }): Promise<PickedDocument | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: options?.type ?? ['*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.name, size: asset.size, mimeType: asset.mimeType };
  } catch (err) {
    captureException(err, { component: 'media', action: 'pickDocument' });
    return null;
  }
}
