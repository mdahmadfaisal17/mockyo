export const OPEN_GUEST_ACCESS_MODAL_EVENT = "mockyo-open-guest-access-modal";

export const openGuestAccessModal = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_GUEST_ACCESS_MODAL_EVENT));
};