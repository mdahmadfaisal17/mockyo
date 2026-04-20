import jwt from "jsonwebtoken";

const USER_AUTH_COOKIE = "mockyo_user_token";

const readCookie = (cookieHeader, key) => {
  const target = `${key}=`;
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length) || "";
};

const requireUserAccess = (req, _res, next) => {
  try {
    const token = readCookie(req.headers.cookie, USER_AUTH_COOKIE);

    if (!token) {
      const error = new Error("Please sign in to continue.");
      error.statusCode = 401;
      throw error;
    }

    const jwtSecret = String(process.env.JWT_SECRET || "");
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      const error = new Error("Session expired. Please sign in again.");
      error.statusCode = 401;
      throw error;
    }

    req.authUser = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || "User",
    };

    next();
  } catch (error) {
    next(error);
  }
};

export default requireUserAccess;
