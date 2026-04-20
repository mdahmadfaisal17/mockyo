import jwt from "jsonwebtoken";

const ADMIN_AUTH_COOKIE = "mockyo_admin_token";
const ADMIN_CSRF_COOKIE = "mockyo_admin_csrf";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const readCookie = (cookieHeader, key) => {
  const target = `${key}=`;
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length) || "";
};

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "").toLowerCase();
const localDevOriginPattern = /^https?:\/\/(?:(?:localhost|127(?:\.\d{1,3}){3})|(?:10(?:\.\d{1,3}){3})|(?:192\.168(?:\.\d{1,3}){2})|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}))(?::\d+)?$/;
const isAllowedLocalDevOrigin = (origin) =>
  process.env.NODE_ENV !== "production" && localDevOriginPattern.test(normalizeOrigin(origin));

const getAllowedOrigins = () => {
  const fromEnv = String(process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (!fromEnv.includes("http://localhost:5174")) {
    fromEnv.push("http://localhost:5174");
  }

  return fromEnv;
};

const assertValidOriginForMutation = (req) => {
  if (!MUTATING_METHODS.has(String(req.method || "").toUpperCase())) return;

  const origin = normalizeOrigin(req.headers.origin || "");
  if (!origin) {
    const error = new Error("Missing request origin. Potential CSRF request blocked.");
    error.statusCode = 403;
    throw error;
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.includes(origin) && !isAllowedLocalDevOrigin(origin)) {
    const error = new Error("Invalid request origin. Potential CSRF request blocked.");
    error.statusCode = 403;
    throw error;
  }
};

const assertValidCsrfForMutation = (req) => {
  if (!MUTATING_METHODS.has(String(req.method || "").toUpperCase())) return;

  const cookieToken = readCookie(req.headers.cookie, ADMIN_CSRF_COOKIE);
  const headerToken = String(req.headers["x-csrf-token"] || "").trim();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    const error = new Error("Invalid CSRF token.");
    error.statusCode = 403;
    throw error;
  }
};

const requireAdminAccess = async (req, res, next) => {
  try {
    assertValidOriginForMutation(req);
    assertValidCsrfForMutation(req);

    const authHeader = String(req.headers["authorization"] || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const cookieToken = readCookie(req.headers.cookie, ADMIN_AUTH_COOKIE);
    const token = bearerToken || cookieToken;

    if (!token) {
      const error = new Error("Admin authentication is required.");
      error.statusCode = 401;
      throw error;
    }

    const jwtSecret = String(process.env.JWT_SECRET || "");
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      const error = new Error("Invalid or expired admin session. Please log in again.");
      error.statusCode = 401;
      throw error;
    }

    if (decoded.role !== "Admin") {
      const error = new Error("You are not allowed to access admin panel.");
      error.statusCode = 403;
      throw error;
    }

    req.adminUser = {
      id: decoded.id,
      email: decoded.email,
      role: "Admin",
    };

    next();
  } catch (error) {
    next(error);
  }
};

export default requireAdminAccess;
