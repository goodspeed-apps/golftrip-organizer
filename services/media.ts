/**
 * GAS Template, Media Upload Service
 *
 * Client-side image pick, resize, upload, and management via Supabase Storage.
 *
 * Dependencies: expo-image-picker, expo-image-manipulator, @supabase/supabase-js
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { gasConfig } from '../gas.config';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export interface PickImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface UploadImageOptions {
  uri: string;
  bucket?: string;
  path: string;
  contentType?: string;
}

export class MediaError extends Error {
  readonly code: number;
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MediaError';
    this.code = status;
    this.status = status;
  }
}

// ─── pickImage ─────────────────────────────────────────────────────────────────

/**
 * Launch the image library picker, resize to fit within the configured max
 * edge (or caller-supplied override), and re-encode as JPEG (strips EXIF).
 * Returns null if the user cancels or permission is denied.
 */
export async function pickImage(options?: PickImageOptions): Promise<ImageResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images' as any,
    allowsEditing: false,
    quality: options?.quality ?? 1,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];

  const maxEdge =
    options?.maxWidth ??
    options?.maxHeight ??
    gasConfig.media.maxImageEdge;

  const longestEdge = Math.max(asset.width, asset.height);
  const resizeWidth =
    longestEdge > maxEdge
      ? asset.width > asset.height
        ? maxEdge
        : Math.round((asset.width / asset.height) * maxEdge)
      : asset.width;

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: resizeWidth } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: options?.quality ?? 0.85 },
  );

  const sizeBytes = await fetchFileSize(manipulated.uri);

  return {
    uri: manipulated.uri,
    width: manipulated.width,
    height: manipulated.height,
    sizeBytes,
    mimeType: 'image/jpeg',
  };
}

async function fetchFileSize(uri: string): Promise<number> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

// ─── uploadImage ───────────────────────────────────────────────────────────────

/**
 * Upload an image URI to Supabase Storage.
 * Validates content-type and file size against gasConfig.media limits.
 * Throws MediaError(415) for unsupported content-type.
 * Throws MediaError(413) for files exceeding maxUploadBytes.
 */
export async function uploadImage(
  opts: UploadImageOptions,
): Promise<{ path: string; size: number }> {
  const contentType = opts.contentType ?? 'image/jpeg';
  const bucket = opts.bucket ?? gasConfig.media.defaultBucket;

  if (!gasConfig.media.allowedContentTypes.includes(contentType)) {
    throw new MediaError(
      415,
      `Unsupported content type: ${contentType}. Allowed: ${gasConfig.media.allowedContentTypes.join(', ')}`,
    );
  }

  const resp = await fetch(opts.uri);
  const blob = await resp.blob();

  if (blob.size > gasConfig.media.maxUploadBytes) {
    throw new MediaError(
      413,
      `File size ${blob.size} bytes exceeds limit of ${gasConfig.media.maxUploadBytes} bytes`,
    );
  }

  const arrayBuffer = await blob.arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(opts.path, arrayBuffer, { contentType, upsert: true });

  if (error) throw new Error(error.message);

  return { path: opts.path, size: blob.size };
}

// ─── signedUrlFor ──────────────────────────────────────────────────────────────

/**
 * Generate a signed URL for a stored object. Default TTL comes from
 * gasConfig.media.signedUrlTtlSeconds.
 */
export async function signedUrlFor(
  bucket: string,
  path: string,
  ttlSeconds?: number,
): Promise<string> {
  const ttl = ttlSeconds ?? gasConfig.media.signedUrlTtlSeconds;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttl);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Failed to create signed URL');
  }

  return data.signedUrl;
}

// ─── deleteImage ──────────────────────────────────────────────────────────────

/**
 * Remove an object from Supabase Storage.
 */
export async function deleteImage(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}