import mongoose from "mongoose";

const globalCache = globalThis.__mockyoMongooseCache || {
  connection: null,
  promise: null,
};

globalThis.__mockyoMongooseCache = globalCache;

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const maxRetries = Number(
    process.env.MONGODB_CONNECT_RETRIES || (process.env.VERCEL ? 1 : 3),
  );
  const serverSelectionTimeoutMS = Number(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || (process.env.VERCEL ? 3000 : 5000),
  );

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in backend/.env");
  }

  if (mongoose.connection.readyState === 1) {
    globalCache.connection = mongoose.connection;
    return globalCache.connection;
  }

  if (globalCache.connection?.readyState === 1) {
    return globalCache.connection;
  }

  if (globalCache.promise) {
    return globalCache.promise;
  }

  let lastError;

  globalCache.promise = (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const instance = await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS,
          family: 4,
          maxPoolSize: 5,
        });
        globalCache.connection = instance.connection;
        console.log("MongoDB connected.");
        return globalCache.connection;
      } catch (error) {
        lastError = error;
        const message = error?.message || "Unknown MongoDB error";
        console.error(`MongoDB connection attempt ${attempt}/${maxRetries} failed: ${message}`);

        if (message.includes("querySrv ETIMEOUT")) {
          console.error(
            "Atlas SRV lookup timed out. Check network/DNS, whitelist current IP in Atlas, or use a non-SRV MONGODB_URI.",
          );
        }
      }
    }

    throw lastError;
  })();

  try {
    return await globalCache.promise;
  } catch (error) {
    globalCache.promise = null;
    throw error;
  }
};

export default connectDatabase;
