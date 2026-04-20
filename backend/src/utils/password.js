import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

export const hashPassword = (plainText) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainText, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (plainText, storedValue) => {
  if (!storedValue || !storedValue.includes(":")) return false;

  const [salt, hash] = storedValue.split(":");
  if (!salt || !hash) return false;

  const expected = crypto.scryptSync(plainText, salt, SCRYPT_KEYLEN);
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length) return false;

  return crypto.timingSafeEqual(expected, actual);
};
