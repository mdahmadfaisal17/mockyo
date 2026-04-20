export type AdminSession = {
  id: string;
  name: string;
  email: string;
  role: "Admin";
  token?: string;
  csrfToken?: string;
};

const ADMIN_AUTH_STORAGE_KEY = "mockyo.admin.auth";

const isBrowser = () => typeof window !== "undefined";

export const readAdminSession = (): AdminSession | null => {
  if (!isBrowser()) return null;

  try {
    let raw = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
      if (raw) {
        window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, raw);
        window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.email || parsed.role !== "Admin") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeAdminSession = (session: AdminSession) => {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(session));
  window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
};

export const clearAdminSession = () => {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
};
