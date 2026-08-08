import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';

/* ---------------------------------------------------------------------------
 * Runs before each test file, and crucially BEFORE the file imports the app —
 * so these env vars win over anything dotenv later reads from server/.env
 * (dotenv never overwrites an existing variable).
 * ------------------------------------------------------------------------- */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-do-not-use-in-production';
process.env.CLIENT_ORIGIN = '';

// Uploads go to a throwaway directory so the suite never touches server/uploads.
const TEST_UPLOAD_DIR = path.join(os.tmpdir(), 'campusnest-test-uploads');
fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

const TEST_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/campusnest_test';

// Hard guard: this suite calls dropDatabase(). Never let it point at a real database.
const dbName = TEST_URI.split('/').pop().split('?')[0];
if (!/_test$/.test(dbName)) {
  throw new Error(
    `Refusing to run tests against database "${dbName}" — the name must end in "_test". ` +
      'Set MONGODB_URI_TEST to something like mongodb://127.0.0.1:27017/campusnest_test'
  );
}

beforeAll(async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
  // Build the unique indexes (users.email, reviews {listing, author}) up front so
  // duplicate-detection tests are deterministic on a fresh database.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes())
  );
});

beforeEach(async () => {
  // Wipe documents but keep indexes, so every test starts from a known-empty state.
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));

  for (const entry of fs.readdirSync(TEST_UPLOAD_DIR)) {
    fs.rmSync(path.join(TEST_UPLOAD_DIR, entry), { force: true });
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
});
