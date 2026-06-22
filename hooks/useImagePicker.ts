/**
 * GAS Template, useImagePicker Hook
 *
 * React state wrapper for lib/media.ts image picking.
 */

import { useState, useCallback } from 'react';
import { pickImage, takePhoto, type PickedImage, type ImagePickerOptions } from '../lib/media';

export function useImagePicker() {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(async (options?: ImagePickerOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await pickImage(options);
      setImage(result);
      return result;
    } catch (err) {
      setError('Failed to pick image');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const capture = useCallback(async (options?: ImagePickerOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await takePhoto(options);
      setImage(result);
      return result;
    } catch (err) {
      setError('Failed to take photo');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return { pickImage: pick, takePhoto: capture, image, loading, error, clear };
}
