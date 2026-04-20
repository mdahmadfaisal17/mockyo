import { readAuthUser } from "../imports/authStore";
import { openGuestAccessModal } from "../imports/guestAccessModalStore";

const GUEST_DOWNLOAD_ACCESS_KEY = "mockyo.guest-download-access";

type GuestDownloadAccessRecord = {
  date: string;
  count: number;
};

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const readGuestDownloadAccess = (): GuestDownloadAccessRecord => {
  if (typeof window === "undefined") {
    return { date: getTodayKey(), count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(GUEST_DOWNLOAD_ACCESS_KEY);
    if (!raw) {
      return { date: getTodayKey(), count: 0 };
    }

    const parsed = JSON.parse(raw) as GuestDownloadAccessRecord;
    if (!parsed?.date || typeof parsed.count !== "number") {
      return { date: getTodayKey(), count: 0 };
    }

    return parsed;
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
};

const writeGuestDownloadAccess = (record: GuestDownloadAccessRecord) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_DOWNLOAD_ACCESS_KEY, JSON.stringify(record));
};

export const canUseGuestDownloadToday = () => {
  if (readAuthUser()) return true;

  const today = getTodayKey();
  const record = readGuestDownloadAccess();
  if (record.date !== today) {
    return true;
  }

  return record.count < 1;
};

export const markGuestDownloadUsed = () => {
  if (readAuthUser()) return;

  const today = getTodayKey();
  const record = readGuestDownloadAccess();
  const nextRecord = record.date === today
    ? { date: today, count: record.count + 1 }
    : { date: today, count: 1 };

  writeGuestDownloadAccess(nextRecord);
};

export const requireSigninForExtraDownload = () => {
  if (readAuthUser()) return false;
  if (canUseGuestDownloadToday()) return false;

  openGuestAccessModal();
  return true;
};