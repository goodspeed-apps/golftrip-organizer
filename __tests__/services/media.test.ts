jest.mock('../../lib/supabase', () => {
  const upload = jest.fn();
  const createSignedUrl = jest.fn();
  const remove = jest.fn();
  const from = jest.fn(() => ({ upload, createSignedUrl, remove }));
  return {
    __storage: { upload, createSignedUrl, remove, from },
    supabase: {
      storage: { from },
    },
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

// Pin gas.config to the template media limits the assertions below expect, so a
// generated app that customizes gasConfig (e.g. maxUploadBytes: 10MB, extra
// allowedContentTypes, a different defaultBucket) cannot break these tests.
// Only the fields services/media.ts actually reads are provided.
jest.mock('../../gas.config', () => {
  const gasConfig = {
    media: {
      maxUploadBytes: 5 * 1024 * 1024,
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
      defaultBucket: 'attachments',
      maxImageEdge: 2048,
      signedUrlTtlSeconds: 3600,
    },
  };
  return { __esModule: true, gasConfig, default: gasConfig, colors: {} };
});

import { uploadImage, signedUrlFor, deleteImage, MediaError } from '../../services/media';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMod = require('../../lib/supabase');
const storage = supabaseMod.__storage;

// Helper: mock fetch with a blob of given size and type
function mockFetch(size: number, type = 'image/jpeg') {
  const blob = { size, type, arrayBuffer: async () => new ArrayBuffer(size) };
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    blob: async () => blob,
  });
  return blob;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset storage.from to return fresh mock methods each call
  storage.from.mockReturnValue({
    upload: storage.upload,
    createSignedUrl: storage.createSignedUrl,
    remove: storage.remove,
  });
});

describe('uploadImage', () => {
  it('rejects unsupported content-type with MediaError(415)', async () => {
    await expect(
      uploadImage({ uri: 'file://x.bmp', path: 'user/x.bmp', contentType: 'image/bmp' }),
    ).rejects.toMatchObject({ code: 415 });
  });

  it('rejects file exceeding maxUploadBytes with MediaError(413)', async () => {
    const oversize = 6 * 1024 * 1024; // 6 MB > 5 MB limit
    mockFetch(oversize, 'image/jpeg');

    await expect(
      uploadImage({ uri: 'file://big.jpg', path: 'user/big.jpg', contentType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 413 });
  });

  it('uploads successfully and returns path + size', async () => {
    const size = 1024;
    mockFetch(size, 'image/jpeg');
    storage.upload.mockResolvedValueOnce({ data: { path: 'user/ok.jpg' }, error: null });

    const result = await uploadImage({
      uri: 'file://ok.jpg',
      path: 'user/ok.jpg',
      contentType: 'image/jpeg',
    });

    expect(result).toEqual({ path: 'user/ok.jpg', size });
    expect(storage.upload).toHaveBeenCalledWith(
      'user/ok.jpg',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });

  it('throws on Supabase storage error', async () => {
    mockFetch(512, 'image/jpeg');
    storage.upload.mockResolvedValueOnce({ error: { message: 'storage failure' } });

    await expect(
      uploadImage({ uri: 'file://err.jpg', path: 'user/err.jpg' }),
    ).rejects.toThrow('storage failure');
  });
});

describe('signedUrlFor', () => {
  it('returns the signed URL from Supabase', async () => {
    storage.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://cdn.example.com/signed' },
      error: null,
    });

    const url = await signedUrlFor('attachments', 'user/photo.jpg', 300);

    expect(url).toBe('https://cdn.example.com/signed');
    expect(storage.createSignedUrl).toHaveBeenCalledWith('user/photo.jpg', 300);
  });

  it('throws when Supabase returns an error', async () => {
    storage.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    await expect(signedUrlFor('attachments', 'user/missing.jpg')).rejects.toThrow('not found');
  });
});

describe('deleteImage', () => {
  it('calls storage.remove with the path array', async () => {
    storage.remove.mockResolvedValueOnce({ error: null });

    await deleteImage('attachments', 'user/photo.jpg');

    expect(storage.remove).toHaveBeenCalledWith(['user/photo.jpg']);
  });

  it('throws when Supabase returns an error', async () => {
    storage.remove.mockResolvedValueOnce({ error: { message: 'delete failed' } });

    await expect(deleteImage('attachments', 'user/gone.jpg')).rejects.toThrow('delete failed');
  });
});