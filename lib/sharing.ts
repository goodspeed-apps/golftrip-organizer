/**
 * GAS Template, Social Sharing
 *
 * expo-sharing wrapper for sharing content from the app. Provides a
 * unified interface for sharing text, URLs, and files via the native
 * share sheet.
 *
 * Web: Uses navigator.share() if available, otherwise falls back to
 * clipboard copy. File sharing is not supported on web.
 *
 * Config: gasConfig.features.socialSharing controls what content types
 * and platforms are available.
 *
 * Dependencies: expo-sharing, expo-file-system (for file-based sharing)
 */

import { Share, Platform } from 'react-native';
import { isWeb } from './platform';
import { gasConfig } from '../gas.config';
import { captureException } from './sentry';

// Conditionally import native-only modules
let Sharing: typeof import('expo-sharing') | null = null;
let FileSystem: typeof import('expo-file-system') | null = null;
if (!isWeb) {
  try {
    Sharing = require('expo-sharing');
    FileSystem = require('expo-file-system');
  } catch {
    // Modules not available
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShareContent {
  title?: string;
  message: string;
  url?: string;
}

export interface ShareFileOptions {
  mimeType?: string;
  dialogTitle?: string;
  UTI?: string; // iOS Uniform Type Identifier
}

export interface ShareResult {
  success: boolean;
  error?: string;
}

// ─── Text / URL Sharing ──────────────────────────────────────────────────────

/**
 * Share text and/or a URL via the native share sheet.
 *
 * On web, uses navigator.share() if available, otherwise copies to clipboard.
 * On native, uses React Native's built-in Share API.
 *
 * @returns ShareResult with success flag and optional error message.
 */
export async function shareContent(content: ShareContent): Promise<ShareResult> {
  try {
    // Web: use navigator.share or clipboard fallback
    if (isWeb) {
      const shareText = content.url
        ? `${content.message}\n\n${content.url}`
        : content.message;

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: content.title,
          text: content.message,
          url: content.url,
        });
        return { success: true };
      }

      // Clipboard fallback
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        return { success: true };
      }

      return { success: false, error: 'Sharing is not supported in this browser' };
    }

    // Native: use React Native Share API
    const result = await Share.share(
      {
        title: content.title,
        message: content.url
          ? `${content.message}\n\n${content.url}`
          : content.message,
        ...(Platform.OS === 'ios' && content.url ? { url: content.url } : {}),
      },
      {
        dialogTitle: content.title ?? gasConfig.app.name,
      }
    );

    return { success: result.action === Share.sharedAction };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Share failed';
    captureException(e, { component: 'sharing', action: 'shareContent' });
    return { success: false, error };
  }
}

// ─── File Sharing ────────────────────────────────────────────────────────────

/**
 * Check if file sharing is available on this device.
 * Always returns false on web.
 */
export async function isSharingAvailable(): Promise<boolean> {
  if (isWeb || !Sharing) return false;
  return Sharing.isAvailableAsync();
}

/**
 * Share a local file via the native share sheet (e.g., exported CSV,
 * generated image, PDF report).
 *
 * Not supported on web, returns an error result.
 *
 * @param fileUri - Local file URI (e.g., from FileSystem.documentDirectory)
 * @param options - MIME type, dialog title, iOS UTI
 */
export async function shareFile(
  fileUri: string,
  options?: ShareFileOptions
): Promise<ShareResult> {
  if (isWeb || !Sharing) {
    return { success: false, error: 'File sharing is not available on web' };
  }
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: options?.mimeType,
      dialogTitle: options?.dialogTitle ?? `Share from ${gasConfig.app.name}`,
      UTI: options?.UTI,
    });
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Share failed';
    captureException(e, { component: 'sharing', action: 'shareFile' });
    return { success: false, error };
  }
}

/**
 * Share text content as a temporary file (useful for large text, CSVs, etc.).
 *
 * Creates a temp file in the cache directory, shares it, then cleans up.
 * Not supported on web, falls back to clipboard copy.
 *
 * @param content - The text content to share
 * @param filename - File name with extension (e.g., "export.csv")
 * @param mimeType - MIME type (e.g., "text/csv")
 */
export async function shareTextAsFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): Promise<ShareResult> {
  if (isWeb || !FileSystem) {
    // Web fallback: copy text to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(content);
        return { success: true };
      } catch (e) {
        return { success: false, error: 'Failed to copy to clipboard' };
      }
    }
    return { success: false, error: 'File sharing is not available on web' };
  }

  const cacheDir = FileSystem.Paths.cache.uri;
  const fileUri = `${cacheDir}${cacheDir.endsWith('/') ? '' : '/'}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, content);
    return await shareFile(fileUri, { mimeType, dialogTitle: filename });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Share failed';
    captureException(e, { component: 'sharing', action: 'shareTextAsFile' });
    return { success: false, error };
  } finally {
    // Clean up temp file
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // Non-critical: temp files will be cleaned by OS eventually
    }
  }
}
