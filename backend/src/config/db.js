import mongoose from 'mongoose';
// ─── Connection state tracker ─────────────────────────────────────────────────
let isConnected = false;

const connectDB = async () => {
  // Prevent duplicate connections 
  if (isConnected) {
    console.log(' MongoDB already connected');
    return;
  }

  const uri = process.env.MONGO_URI;

  if (!uri) {    
    console.error(' MONGO_URI is not defined in .env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      // These are the recommended options for Mongoose 7+
      serverSelectionTimeoutMS: 5000,  // Fail fast if DB is unreachable
      socketTimeoutMS:          45000, // Close sockets after 45s of inactivity
    });

    isConnected = true;

    console.log(` MongoDB connected: ${conn.connection.host}`);
    console.log(` Database:          ${conn.connection.name}`);

  } catch (error) {
    console.error(' MongoDB connection failed:', error.message);
    process.exit(1); // Exit process so the server doesn't start with no DB
  }
};

// ─── Connection lifecycle events ──────────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log(' MongoDB reconnected');
});

// Graceful shutdown — close connection when Node process exits
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log(' MongoDB connection closed (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  console.log(' MongoDB connection closed (SIGTERM)');
  process.exit(0);
});

export default connectDB;