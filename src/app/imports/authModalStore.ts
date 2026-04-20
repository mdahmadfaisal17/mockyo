export type AuthModalMode = "login" | "signup" | "forgot";

export const OPEN_AUTH_MODAL_EVENT = "mockyo-open-auth-modal";

export const openAuthModal = (mode: AuthModalMode = "login") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthModalMode>(OPEN_AUTH_MODAL_EVENT, { detail: mode }));
};
