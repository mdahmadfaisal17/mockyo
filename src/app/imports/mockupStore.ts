import { type MockupItem } from "./mockupsData";

export type CustomMockupItem = MockupItem & {
  createdAt?: string;
  previewImages?: string[];
  thumbnails?: string[];
  blendLayers?: Partial<Record<"multiply" | "screen" | "overlay", string>>;
  designAreas?: string[];
  colorAreas?: string[];
  colorHex?: string;
  views?: {
    primary?: {
      baseMockup?: string;
      overlayImage?: string;
    };
    front?: {
      baseMockup?: string;
      overlayImage?: string;
    };
    back?: {
      baseMockup?: string;
      overlayImage?: string;
    };
  };
};

const STORAGE_KEY = "mockyo.custom-mockups";

const isBrowser = () => typeof window !== "undefined";

export function getCustomMockups(): CustomMockupItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomMockupItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAllMockups(): CustomMockupItem[] {
  return getCustomMockups();
}
