import mongoose from "mongoose";

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const maxRetries = Number(process.env.MONGODB_CONNECT_RETRIES || 3);
  const serverSelectionTimeoutMS = Number(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000,
  );

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in backend/.env");
  }

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS,
        family: 4,
      });
      console.log("MongoDB connected.");
      return;
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
};

export default connectDatabase;
