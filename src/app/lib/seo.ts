type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

const SITE_URL = (import.meta.env.VITE_SITE_URL?.trim() || "https://mockyo.com").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE_PATH = "/og-image.svg";

const toAbsoluteUrl = (inputPath: string) => {
  if (!inputPath) return SITE_URL;
  if (/^https?:\/\//i.test(inputPath)) return inputPath;
  return `${SITE_URL}${inputPath.startsWith("/") ? "" : "/"}${inputPath}`;
};

const upsertMeta = (attr: "name" | "property", key: string, content: string) => {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
};

export const setCanonical = (pathname: string) => {
  const href = toAbsoluteUrl(pathname || "/");
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
};

export const upsertJsonLd = (id: string, data: JsonLdValue) => {
  let script = document.head.querySelector<HTMLScriptElement>(`script[data-seo-jsonld="${id}"]`);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", id);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
};

export const removeJsonLd = (id: string) => {
  const script = document.head.querySelector<HTMLScriptElement>(`script[data-seo-jsonld="${id}"]`);
  script?.remove();
};

export const removeJsonLdMany = (ids: string[]) => {
  ids.forEach((id) => removeJsonLd(id));
};

export type SeoPayload = {
  title: string;
  description: string;
  pathname: string;
  keywords?: string;
  robots?: string;
  ogType?: "website" | "article" | "product";
  image?: string;
};

export const applySeo = ({
  title,
  description,
  pathname,
  keywords,
  robots = "index,follow",
  ogType = "website",
  image = DEFAULT_OG_IMAGE_PATH,
}: SeoPayload) => {
  const absoluteUrl = toAbsoluteUrl(pathname || "/");
  const absoluteImage = toAbsoluteUrl(image);

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", robots);
  if (keywords) {
    upsertMeta("name", "keywords", keywords);
  }

  upsertMeta("property", "og:type", ogType);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", absoluteUrl);
  upsertMeta("property", "og:image", absoluteImage);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", absoluteImage);

  setCanonical(pathname);
};

export const getSiteUrl = () => SITE_URL;
export const getDefaultOgImagePath = () => DEFAULT_OG_IMAGE_PATH;
export const toAbsoluteSeoUrl = (inputPath: string) => toAbsoluteUrl(inputPath);
