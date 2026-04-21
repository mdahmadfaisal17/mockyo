import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Download, Edit3, FileImage, MonitorSmartphone, SquarePen } from "lucide-react";
import MockupCard from "../components/MockupCard";
import { getAllMockups } from "../imports/mockupStore";
import { fetchJsonWithRetry } from "../lib/apiRetry";
import { applySeo, removeJsonLdMany, toAbsoluteSeoUrl, upsertJsonLd } from "../lib/seo";

export default function ProductDetails() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const { id } = useParams();
  const navigate = useNavigate();
  const [mockups, setMockups] = useState(() => getAllMockups());
  const [productThumbnails, setProductThumbnails] = useState<string[]>([]);
  const [productDescription, setProductDescription] = useState<string>("");
  const [objectKey, setObjectKey] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);

  // Load all mockups for related section
  useEffect(() => {
    const loadMockups = async () => {
      try {
        const { response, json: result } = await fetchJsonWithRetry(
          `${apiBaseUrl}/mockups`,
          undefined,
          { retries: 2, retryDelayMs: 350 },
        );

        if (!response.ok || !result?.ok || !Array.isArray(result.items)) {
          throw new Error(result?.message || "Failed to load mockups.");
        }

        const mapped = result.items.map((item: any) => ({
          id: item._id,
          image:
            item.thumbnails?.[0]?.url ||
            item.views?.primary?.baseMockup?.url ||
            "https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80",
          title: item.title || "Untitled",
          category: item.category || "Uncategorized",
          mainCategory: item.mainCategory || "Apparel",
          downloads: Number(item.downloads) || 0,
        }));

        setMockups(mapped);
      } catch {
        // Keep existing items instead of clearing UI during temporary API errors.
      }
    };

    void loadMockups();
  }, [apiBaseUrl]);

  // Load full product detail to get all thumbnails
  useEffect(() => {
    if (!id) return;
    const loadProduct = async () => {
      try {
        const { response, json: result } = await fetchJsonWithRetry(
          `${apiBaseUrl}/mockups/${id}`,
          undefined,
          { retries: 2, retryDelayMs: 350 },
        );
        if (!response.ok || !result?.ok || !result.item) return;
        const thumbs: string[] = Array.isArray(result.item.thumbnails)
          ? result.item.thumbnails.map((t: any) => t.url).filter(Boolean)
          : [];
        if (thumbs.length > 0) setProductThumbnails(thumbs);
        if (result.item.description) setProductDescription(result.item.description);
        if (result.item.objectKey) setObjectKey(result.item.objectKey);
      } catch {
        // fall through — gallery will use product.image fallback
      }
    };
    void loadProduct();
  }, [apiBaseUrl, id]);

  const product = useMemo(() => mockups.find((item) => item.id === id), [id, mockups]);

  const gallery = useMemo(() => {
    if (!product) return [];
    if (productThumbnails.length > 0) return productThumbnails;
    return [product.image];
  }, [product, productThumbnails]);

  const [activeImage, setActiveImage] = useState<string>(gallery[0] ?? "");

  useEffect(() => {
    setActiveImage(gallery[0] ?? "");
  }, [gallery]);

  const related = useMemo(() => {
    if (!product) return [];
    return mockups
      .filter((item) => item.id !== product.id && item.mainCategory === product.mainCategory)
      .slice(0, 8);
  }, [mockups, product]);

  const relatedWithCurrent = useMemo(() => {
    if (!product) return [];
    return [product, ...related.slice(0, 7)];
  }, [product, related]);

  const displayDescription = product
    ? productDescription
    : productDescription;

  // Auto-generate smart tags from product data
  const tags = useMemo(() => {
    if (!product) return [];
    const base = new Set<string>();
    const titleWords = product.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    titleWords.forEach((w) => base.add(w));
    base.add(product.category.toLowerCase());
    base.add(product.mainCategory.toLowerCase());
    base.add("mockup");
    base.add("psd");
    base.add("smart object");
    base.add("free download");
    base.add("adobe photoshop");
    base.add("branding");
    return Array.from(base).slice(0, 10);
  }, [product]);

  // Inject SEO meta tags into document <head>
  useEffect(() => {
    if (!product) return;
    const seoTitle = `${product.title} - Free Mockup Download | Mockyo`;
    const seoDescription = (displayDescription || `Download ${product.title} mockup for free on Mockyo.`)
      .slice(0, 160);
    const seoKeywords = tags.join(", ");
    const productPath = `/mockups/${product.id}`;
    const productImage = gallery[0] || product.image;

    applySeo({
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      pathname: productPath,
      robots: "index,follow",
      ogType: "product",
      image: productImage,
    });

    upsertJsonLd("product", {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      image: gallery.length > 0 ? gallery.map((img) => toAbsoluteSeoUrl(img)) : [toAbsoluteSeoUrl(product.image)],
      description: seoDescription,
      category: product.category,
      brand: {
        "@type": "Brand",
        name: "Mockyo",
      },
      url: toAbsoluteSeoUrl(productPath),
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        price: "0",
        priceCurrency: "USD",
        url: toAbsoluteSeoUrl(productPath),
      },
    });

    upsertJsonLd("breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: toAbsoluteSeoUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Mockups",
          item: toAbsoluteSeoUrl("/mockups"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: product.title,
          item: toAbsoluteSeoUrl(productPath),
        },
      ],
    });

    return () => {
      removeJsonLdMany(["product", "breadcrumb"]);
    };
  }, [product, displayDescription, tags, gallery]);

  if (!product) {
    return (
      <section className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto max-w-5xl rounded-2xl border border-border/60 bg-card p-8 text-center">
          <h1 className="text-3xl font-bold">Product not found</h1>
          <p className="mt-3 text-muted-foreground">The mockup you requested does not exist.</p>
          <button
            type="button"
            onClick={() => navigate("/mockups")}
            className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Back to Mockups
          </button>
        </div>
      </section>
    );
  }
  
  const handleDownload = async () => {
    if (!objectKey.trim()) {
      alert("No object key configured for this product.");
      return;
    }
    
    setIsDownloading(true);
    try {
      const presignedUrlEndpoint = `${apiBaseUrl}/mockups/download/presigned-url?mockupId=${encodeURIComponent(id ?? "")}`;
      const response = await fetch(presignedUrlEndpoint, { credentials: "include" });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get download link");
      }
      
      const data = await response.json();
      if (!data.ok || !data.url) throw new Error("Invalid download URL");
      
      // Direct download via presigned URL
      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Reflect the successful download instantly in UI.
      setMockups((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, downloads: (Number(item.downloads) || 0) + 1 }
            : item,
        ),
      );
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const mockupDetails = [
    { label: "File format", value: "PSD" , icon: FileImage},
    { label: "Resolution", value: "4000 x 4000 px" , icon: MonitorSmartphone},
    { label: "Software", value: "Adobe Photoshop CC+" , icon: Edit3},
  ];

  return (
    <div className="min-h-screen bg-background py-6 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 text-sm text-muted-foreground">
          <Link to="/mockups" className="transition hover:text-primary">Mockups</Link> / <span>{product.title}</span>
        </div>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_420px] lg:items-start">
          <aside className="order-1 lg:order-2 lg:self-start lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(25,28,36,0.98),rgba(13,15,21,0.98))] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.18),transparent_52%)] p-6 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
                  {product.mainCategory}
                </p>
                <p className="mt-3 text-sm font-medium text-slate-400">
                  {product.downloads.toLocaleString()} downloads
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {product.title}
                </h1>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Link
                    to={`/editor/${product.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_35px_rgba(255,107,53,0.28)] transition hover:brightness-105"
                  >
                    <SquarePen className="h-4 w-4" />
                    Upload Design
                  </Link>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/[0.02] px-5 py-3.5 text-sm font-semibold text-white transition hover:border-primary/60 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDownloading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-8 p-6 sm:p-7">
                <div>
                  <h2 className="text-base font-semibold text-white">Mockup Details</h2>
                  <div className="mt-4 space-y-3">
                    {mockupDetails.map(({ label, value, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>{label}</span>
                        </div>
                        <span className="text-right text-sm font-medium text-slate-100">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="order-2 space-y-6 lg:order-1">
            <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,20,27,0.92),rgba(12,14,18,0.98))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:p-6">
              <div className="aspect-[1.15/1] overflow-hidden rounded-[24px] border border-white/8 bg-[#0c1016]">
                <img
                  src={activeImage || product.image}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {gallery.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`group relative aspect-[1.08/1] overflow-hidden rounded-2xl border transition ${
                      (activeImage || product.image) === img
                        ? "border-primary shadow-[0_12px_30px_rgba(255,107,53,0.24)]"
                        : "border-white/8 hover:border-white/20"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.title} preview ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[28px] border border-white/8 bg-card/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
                <h2 className="text-2xl font-bold text-white">Product Description</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  {displayDescription}
                </p>
              </div>

              <div className="rounded-[28px] border border-white/8 bg-card/80 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
                <h2 className="text-lg font-semibold text-white">Related Tags</h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium tracking-wide text-slate-300 transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <section className="pt-2">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">More To Explore</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Related Mockups</h2>
                </div>
                <Link to="/mockups" className="text-sm font-medium text-slate-400 transition hover:text-primary">
                  Browse all
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
                {relatedWithCurrent.slice(0, 8).map((item) => (
                  <MockupCard
                    key={item.id}
                    id={item.id}
                    image={item.image}
                    title={item.title}
                    category={item.category}
                    downloads={item.downloads}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
