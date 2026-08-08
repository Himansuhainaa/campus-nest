import { describe, expect, it } from 'vitest';
import { publicIdFromUrl, cloudinaryConfigured, USE_CLOUDINARY } from '../src/middleware/upload.js';

/**
 * The storage backend itself needs a real Cloudinary account to exercise, but
 * the two pure functions that decide *which* backend runs and *what* gets
 * deleted are testable — and both fail silently if they regress, which is the
 * worst kind of bug for a delete path.
 */

describe('publicIdFromUrl', () => {
  it('extracts the folder-qualified id from a standard delivery URL', () => {
    expect(
      publicIdFromUrl(
        'https://res.cloudinary.com/demo/image/upload/v1712345678/campus-nest/1712345678-abc123.jpg'
      )
    ).toBe('campus-nest/1712345678-abc123');
  });

  it('works without a version segment', () => {
    expect(
      publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/campus-nest/photo.png')
    ).toBe('campus-nest/photo');
  });

  it('strips transformation segments', () => {
    expect(
      publicIdFromUrl(
        'https://res.cloudinary.com/demo/image/upload/w_800,h_600/v1712345678/campus-nest/photo.webp'
      )
    ).toBe('campus-nest/photo');
  });

  it('handles nested folders', () => {
    expect(
      publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/a/b/c/photo.jpg')
    ).toBe('a/b/c/photo');
  });

  it('returns null for anything that is not a Cloudinary upload URL', () => {
    expect(publicIdFromUrl('/uploads/local-file.png')).toBeNull();
    expect(publicIdFromUrl('https://example.com/image.png')).toBeNull();
    expect(publicIdFromUrl(undefined)).toBeNull();
    expect(publicIdFromUrl('')).toBeNull();
  });
});

describe('backend selection', () => {
  it('falls back to local disk when nothing is configured', () => {
    // The test environment sets no CLOUDINARY_* variables, so the suite must be
    // exercising the disk backend — otherwise the upload tests prove nothing.
    expect(USE_CLOUDINARY).toBe(false);
  });

  it('detects the single-variable CLOUDINARY_URL form', () => {
    const previous = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloudname';
    expect(cloudinaryConfigured()).toBe(true);
    if (previous === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = previous;
  });

  it('detects the split-variable form', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'cloudname';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';
    expect(cloudinaryConfigured()).toBe(true);
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  it('does not activate on a partial split configuration', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'cloudname';
    expect(cloudinaryConfigured()).toBe(false);
    delete process.env.CLOUDINARY_CLOUD_NAME;
  });
});
