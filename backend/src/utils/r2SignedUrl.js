import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient = null;

const requiredEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
];

const readR2Config = () => {
  const config = {
    accountId: String(process.env.R2_ACCOUNT_ID || "").trim(),
    accessKeyId: String(process.env.R2_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: String(process.env.R2_SECRET_ACCESS_KEY || "").trim(),
    bucketName: String(process.env.R2_BUCKET_NAME || "").trim(),
    endpoint: String(process.env.R2_ENDPOINT || "").trim(),
    expiresSeconds: Number(process.env.R2_SIGNED_URL_EXPIRES_SECONDS || 120),
  };

  const missing = requiredEnv.filter((key) => !String(process.env[key] || "").trim());
  return { config, missing };
};

export const getR2EndpointHost = () => {
  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  if (!endpoint) return "";
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "";
  }
};

const getR2Client = () => {
  if (cachedClient) return cachedClient;

  const { config, missing } = readR2Config();
  if (missing.length > 0) {
    const error = new Error(`Missing R2 environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
};

const normalizeObjectKey = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  return decodeURIComponent(value.replace(/^\/+/, ""));
};

const isR2PublicHost = (host) => host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");

export const resolveR2ObjectKeyFromInput = (input) => {
  const value = String(input || "").trim();
  if (!value) return "";

  if (!/^https?:\/\//i.test(value)) {
    return normalizeObjectKey(value);
  }

  try {
    const parsed = new URL(value);
    if (!isR2PublicHost(parsed.hostname)) return "";
    return normalizeObjectKey(parsed.pathname);
  } catch {
    return "";
  }
};

export const getR2ObjectFromInput = async (input) => {
  const objectKey = resolveR2ObjectKeyFromInput(input);
  if (!objectKey) return null;

  const { config } = readR2Config();
  const client = getR2Client();
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucketName, Key: objectKey }),
  );

  return {
    stream: response.Body,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength ?? null,
    fileName: objectKey.split("/").pop() || objectKey,
  };
};

export const getR2PresignedUrl = async (input, fileName = null) => {
  const objectKey = resolveR2ObjectKeyFromInput(input);
  if (!objectKey) return null;

  const { config } = readR2Config();
  const client = getR2Client();
  
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
  });

  try {
    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: config.expiresSeconds,
    });
    
    return {
      url: presignedUrl,
      fileName: fileName || objectKey.split("/").pop() || objectKey,
    };
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return null;
  }
};
