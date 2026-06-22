/**
 * Tests for lib/media.ts
 */

const mockMediaPerms = jest.fn(async () => ({ status: 'granted' }));
const mockCameraPerms = jest.fn(async () => ({ status: 'granted' }));
const mockLaunchLibrary = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: 'file://img.jpg', width: 200, height: 200, base64: null }],
}));
const mockLaunchCamera = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: 'file://photo.jpg', width: 300, height: 300, base64: null }],
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: mockMediaPerms,
  requestCameraPermissionsAsync: mockCameraPerms,
  launchImageLibraryAsync: mockLaunchLibrary,
  launchCameraAsync: mockLaunchCamera,
}));
const mockGetDoc = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: 'file://doc.pdf', name: 'doc.pdf', size: 1024, mimeType: 'application/pdf' }],
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: mockGetDoc }));
jest.mock('../../lib/sentry', () => ({ captureException: jest.fn() }));

import { pickImage, takePhoto, pickDocument } from '../../lib/media';

beforeEach(() => jest.clearAllMocks());

describe('pickImage', () => {
  test('returns image on success', async () => {
    const result = await pickImage();
    expect(result).toEqual({ uri: 'file://img.jpg', width: 200, height: 200, base64: undefined });
  });

  test('returns null when cancelled', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });
    expect(await pickImage()).toBeNull();
  });

  test('returns null when permission denied', async () => {
    mockMediaPerms.mockResolvedValueOnce({ status: 'denied' });
    expect(await pickImage()).toBeNull();
  });

  test('returns null on error', async () => {
    mockMediaPerms.mockRejectedValueOnce(new Error('crash'));
    expect(await pickImage()).toBeNull();
  });
});

describe('takePhoto', () => {
  test('returns photo on success', async () => {
    const result = await takePhoto();
    expect(result).toEqual({ uri: 'file://photo.jpg', width: 300, height: 300, base64: undefined });
  });

  test('returns null when cancelled', async () => {
    mockLaunchCamera.mockResolvedValueOnce({ canceled: true, assets: [] });
    expect(await takePhoto()).toBeNull();
  });

  test('returns null when permission denied', async () => {
    mockCameraPerms.mockResolvedValueOnce({ status: 'denied' });
    expect(await takePhoto()).toBeNull();
  });
});

describe('pickDocument', () => {
  test('returns document on success', async () => {
    const result = await pickDocument();
    expect(result).toEqual({ uri: 'file://doc.pdf', name: 'doc.pdf', size: 1024, mimeType: 'application/pdf' });
  });

  test('returns null when cancelled', async () => {
    mockGetDoc.mockResolvedValueOnce({ canceled: true, assets: [] });
    expect(await pickDocument()).toBeNull();
  });
});
