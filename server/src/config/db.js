const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Works with a local mongod or a MongoDB Atlas SRV string —
 * the only thing that changes between them is MONGODB_URI.
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.'
    );
  }

  // Fail fast instead of buffering queries forever when the cluster is unreachable.
  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[db] connected to ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
