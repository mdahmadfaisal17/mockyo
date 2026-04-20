export type AuthUser = {
  name: string;
  email: string;
};

const AUTH_STORAGE_KEY = "mockyo.auth.user";
const AUTH_EVENT = "mockyo-auth-change";

const isBrowser = () => typeof window !== "undefined";

export const readAuthUser = (): AuthUser | null => {
  if (!isBrowser()) return null;

  try {
    let raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      // One-time migration from older localStorage-based cache.
      raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        window.sessionStorage.setItem(AUTH_STORAGE_KEY, raw);
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
};

const notifyAuthChange = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const writeAuthUser = (user: AuthUser) => {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthChange();
};

export const clearAuthUser = () => {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthChange();
};

export const authChangeEventName = AUTH_EVENT;
