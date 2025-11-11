import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) {
    console.error('Mongo connect failed: Missing MONGO_URI');
    return;
  }
  if (mongoose.connection.readyState === 1) return;

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
  });

  console.log('✅ Mongo connected');
}
