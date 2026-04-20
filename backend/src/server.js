import "dotenv/config";
import app from "./app.js";
import connectDatabase from "./config/db.js";
import { connectCloudinary } from "./config/cloudinary.js";

const PORT = process.env.PORT || 5000;

const assertSecurityConfiguration = () => {
  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing.");
  }

  if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }

  const gaEmail = String(process.env.GA4_CLIENT_EMAIL || "").trim();
  const gaKey = String(process.env.GA4_PRIVATE_KEY || "").trim();
  if ((gaEmail && !gaKey) || (!gaEmail && gaKey)) {
    throw new Error("GA4 credentials are partially configured. Set both GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY.");
  }
};

const listenWithFallback = (startPort, maxAttempts = 10) =>
  new Promise((resolve, reject) => {
    let attempts = 0;

    const tryListen = (portToTry) => {
      attempts += 1;
      const server = app.listen(portToTry, () => {
        if (attempts > 1) {
          console.warn(`Port ${startPort} was busy. Using port ${portToTry} instead.`);
        }
        console.log(`Mockyo backend running on http://localhost:${portToTry}`);
        resolve(server);
      });

      server.once("error", (error) => {
        if (error?.code === "EADDRINUSE" && attempts < maxAttempts) {
          tryListen(Number(portToTry) + 1);
          return;
        }
        reject(error);
      });
    };

    tryListen(Number(startPort));
  });

const startServer = async () => {
  try {
    assertSecurityConfiguration();
    connectCloudinary();
    await connectDatabase();
    await listenWithFallback(PORT);
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();
