import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, Download, Edit, Mail, Palette, Quote, Search, Star, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import MockupCard from "../components/MockupCard";

const ADMIN_CATEGORY_STORAGE_KEY = "mockyo.admin.category-config";

type CategoryHierarchy = Record<string, Record<string, string[]>>;

type ApprovedReview = {
  id: string;
  name: string;
  rating: number;
  text: string;
  submittedAt: number;
};

const countCategoriesFromHierarchy = (hierarchy: CategoryHierarchy): number => {
  const uniqueCategoryKeys = new Set<string>();

  Object.entries(hierarchy || {}).forEach(([mainCategory, categoryMap]) => {
    if (!categoryMap || typeof categoryMap !== "object") return;
    Object.keys(categoryMap).forEach((category) => {
      const main = String(mainCategory || "").trim().toLowerCase();
      const name = String(category || "").trim().toLowerCase();
      if (!name) return;
      uniqueCategoryKeys.add(`${main}::${name}`);
    });
  });

  return uniqueCategoryKeys.size;
};

const readAdminCategoryCount = () => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(ADMIN_CATEGORY_STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as { hierarchy?: CategoryHierarchy; categories?: string[] };
    const hierarchy = parsed?.hierarchy;
    const uniqueCategoryKeys = new Set<string>();

    if (hierarchy && typeof hierarchy === "object") {
      Object.entries(hierarchy).forEach(([mainCategory, categoryMap]) => {
        if (!categoryMap || typeof categoryMap !== "object") return;
        Object.keys(categoryMap).forEach((category) => {
          const main = String(mainCategory || "").trim().toLowerCase();
          const name = String(category || "").trim().toLowerCase();
          if (!name) return;
          uniqueCategoryKeys.add(`${main}::${name}`);
        });
      });
    }

    // Backward-compatibility for older flat category storage.
    if (Array.isArray(parsed?.categories)) {
      parsed.categories.forEach((category) => {
        const name = String(category || "").trim().toLowerCase();
        if (!name) return;
        uniqueCategoryKeys.add(`legacy::${name}`);
      });
    }

    return uniqueCategoryKeys.size;
  } catch {
    return 0;
  }
};



export default function Home() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const initialAdminCategoryCount = readAdminCategoryCount();
  const [email, setEmail] = useState("");
  const [trendingMockups, setTrendingMockups] = useState<any[]>([]);
  const [approvedReviews, setApprovedReviews] = useState<ApprovedReview[]>([]);
  const [heroStats, setHeroStats] = useState({
    mockups: 0,
    downloads: 0,
    categories: initialAdminCategoryCount || 0,
  });

  const heroRating = useMemo(() => {
    if (approvedReviews.length === 0) return "0.0";
    const total = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / approvedReviews.length).toFixed(1);
  }, [approvedReviews]);

  const reviewPreviewItems = useMemo(
    () => [...approvedReviews].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 12),
    [approvedReviews],
  );

  useEffect(() => {
    const loadApprovedReviews = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/reviews`);
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok || !Array.isArray(result.items)) {
          setApprovedReviews([]);
          return;
        }

        const mapped = result.items.map((item: any) => ({
          id: String(item._id || item.id || ""),
          name: String(item.name || "Unknown"),
          rating: Number(item.rating) || 0,
          text: String(item.text || ""),
          submittedAt: new Date(item.submittedAt || item.createdAt || Date.now()).getTime(),
        }));

        setApprovedReviews(mapped);
      } catch {
        setApprovedReviews([]);
      }
    };

    void loadApprovedReviews();
  }, [apiBaseUrl]);

  useEffect(() => {
    const loadHeroStats = async () => {
      try {
        // Fetch all mockups to get all unique categories
        const response = await fetch(`${apiBaseUrl}/mockups?limit=1000`);
        const result = await response.json();

        if (!response.ok || !result?.ok || !Array.isArray(result.items)) {
          return;
        }

        const mapped = result.items.map((item: any) => ({
          id: item._id,
          image:
            item.thumbnails?.[0]?.url ||
            item.views?.primary?.baseMockup?.url ||
            "https://images.unsplash.com/photo-1634032188532-f11af97817ab?auto=format&fit=crop&w=1080&q=80",
          title: item.title || "Untitled",
          mainCategory: item.mainCategory || "",
          category: item.category || "Uncategorized",
          downloads: Number(item.downloads) || 0,
        }));

        const mockups = mapped.length;
        const downloads = mapped.reduce(
          (sum: number, item: any) => sum + (Number(item.downloads) || 0),
          0,
        );
        // Use whichever source reports more categories to avoid undercounting.
        let categoriesFromAdmin = readAdminCategoryCount();
        try {
          const categoryResponse = await fetch(`${apiBaseUrl}/categories/config`);
          const categoryResult = await categoryResponse.json().catch(() => null);
          if (categoryResponse.ok && categoryResult?.ok && categoryResult.hierarchy) {
            const remoteCount = countCategoriesFromHierarchy(categoryResult.hierarchy as CategoryHierarchy);
            categoriesFromAdmin = Math.max(categoriesFromAdmin, remoteCount);
          }
        } catch {
          // Ignore category config API errors and keep local fallback.
        }

        const categoriesFromMockups = new Set(
          mapped.map((item: any) => {
            const main = String(item.mainCategory || "").trim().toLowerCase();
            const category = String(item.category || "").trim().toLowerCase();
            return `${main}::${category}`;
          }),
        ).size;
        const categories = Math.max(categoriesFromAdmin, categoriesFromMockups);

        setHeroStats((prev) => ({ ...prev, mockups, downloads, categories }));
        setTrendingMockups(
          mapped
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 6),
        );
      } catch {
        // Keep fallback stats from featured list.
      }
    };

    void loadHeroStats();
  }, [apiBaseUrl]);

  const formattedMockupCount = useMemo(
    () => heroStats.mockups.toLocaleString(),
    [heroStats.mockups],
  );

  const formattedDownloadCount = useMemo(
    () => heroStats.downloads.toLocaleString(),
    [heroStats.downloads],
  );

  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [newsletterMsg, setNewsletterMsg] = useState("");

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterStatus("loading");
    setNewsletterMsg("");
    try {
      const res = await fetch(`${apiBaseUrl}/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Subscription failed.");
      setNewsletterStatus("success");
      setNewsletterMsg(data.message || "You are now subscribed!");
      setEmail("");
    } catch (err) {
      setNewsletterStatus("error");
      setNewsletterMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div>
      <section className="relative min-h-[calc(100vh-73px)] flex items-center overflow-hidden bg-background">
        <div className="absolute inset-0 hero-bg" />
        <div className="absolute inset-0 hero-grid-bg" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-normal text-primary">100% Free Mockups</span>
            </div>

            <h1 className="mb-6 text-3xl sm:text-5xl lg:text-[4.55rem] leading-[1.1] lg:leading-[1.05]">
              Create Professional Mockups in Seconds
            </h1>

            <p className="text-base sm:text-xl font-[300] text-foreground/90 mb-8 max-w-2xl mx-auto">
              Upload your design, customize mockups, and download high-quality images all in one place.
            </p>

            <div className="flex flex-wrap gap-3 sm:gap-4 mb-12 justify-center">
              <Link
                to="/mockups"
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-md bg-gradient-to-br from-primary via-primary to-secondary hover:brightness-105 text-white font-semibold transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-primary/20 text-sm sm:text-base"
              >
                Browse Mockups
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/editor"
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-white hover:bg-white/90 text-background font-semibold transition-all hover:scale-105 flex items-center gap-2 text-sm sm:text-base"
              >
                <Edit className="w-5 h-5" />
                Upload Design
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-sm justify-center">
              <div>
                <div className="text-xl sm:text-3xl font-bold text-foreground mb-1">{formattedMockupCount}+</div>
                <div className="text-muted-foreground text-xs sm:text-sm">Mockups</div>
              </div>
              <div className="h-8 sm:h-12 w-px bg-border" />
              <div>
                <div className="text-xl sm:text-3xl font-bold text-foreground mb-1">{formattedDownloadCount}+</div>
                <div className="text-muted-foreground text-xs sm:text-sm">Downloads</div>
              </div>
              <div className="h-8 sm:h-12 w-px bg-border" />
              <div>
                <div className="text-xl sm:text-3xl font-bold text-foreground mb-1">{heroStats.categories}+</div>
                <div className="text-muted-foreground text-xs sm:text-sm">Categories</div>
              </div>
              <div className="h-8 sm:h-12 w-px bg-border" />
              <div>
                <div className="text-xl sm:text-3xl font-bold text-foreground mb-1">{heroRating}</div>
                <div className="text-muted-foreground text-xs sm:text-sm">Rating</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8 sm:mb-12">
            <div>
              <h2 className="mb-4">Trending Mockups</h2>
              <p className="text-lg text-muted-foreground">Sorted by most downloads</p>
            </div>
            <Link
              to="/mockups"
              className="hidden md:flex items-center gap-2 text-primary hover:gap-3 transition-all font-semibold"
            >
              View All
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingMockups.map((mockup, index) => (
              <motion.div
                key={mockup.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <MockupCard {...mockup} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground">Pick a mockup, customize it, and export in seconds</p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Search className="w-10 h-10 text-background" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Choose a Mockup</h3>
              <p className="text-muted-foreground">
                Browse the library and open the mockup that fits your product, brand, or concept
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Upload className="w-10 h-10 text-background" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Upload & Customize</h3>
              <p className="text-muted-foreground">
                Add your design, then adjust colors, text, position, and background in the editor
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Download className="w-10 h-10 text-background" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Export Ready-to-Share</h3>
              <p className="text-muted-foreground">
                Download a polished PNG or JPEG that is ready for clients, stores, or social posts
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 bg-muted/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-12 grid items-end gap-4 md:grid-cols-3">
            <div className="hidden md:block" />
            <div className="mx-auto max-w-2xl text-center md:col-span-1">
              <h2 className="mb-4">What Clients Say</h2>
              <p className="text-lg text-muted-foreground">Real feedback from users who build with Mockyo.</p>
            </div>
            <div className="mt-5 hidden md:flex justify-end">
              <Link
                to="/reviews"
                className="inline-flex items-center gap-2 text-primary hover:gap-3 transition-all font-semibold"
              >
                See All Reviews
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="home-review-rail-wrapper overflow-x-hidden overflow-y-visible py-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="home-review-rail-track flex w-max items-stretch gap-6">
              {(reviewPreviewItems.length > 1 ? [...reviewPreviewItems, ...reviewPreviewItems] : reviewPreviewItems).map((review, index) => (
                <article
                  key={`${review.id}-${index}`}
                  className="group relative flex h-[220px] sm:h-[250px] w-[300px] sm:w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 sm:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-[2px] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_24px_60px_rgba(255,107,53,0.18)]"
                >
                  <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/12 blur-2xl transition-opacity duration-300 group-hover:opacity-90" />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/14 text-sm font-semibold text-primary">
                        {(review.name || "U").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-zinc-100">{review.name}</h3>
                        <p className="mt-0.5 text-xs text-zinc-400">Verified Customer</p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-black/25 px-2.5 py-1 text-xs font-medium text-zinc-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {review.rating}/5
                    </div>
                  </div>

                  <div className="relative mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={`${review.id}-star-${i}-${index}`}
                          viewBox="0 0 16 16"
                          className={`h-4 w-4 ${i < review.rating ? "text-amber-400" : "text-zinc-700"}`}
                          fill="currentColor"
                        >
                          <path d="M8 1.25l1.74 3.53 3.89.57-2.82 2.74.67 3.87L8 10.01l-3.48 1.95.67-3.87L2.37 5.35l3.89-.57z" />
                        </svg>
                      ))}
                    </div>
                    <Quote className="h-4 w-4 text-primary/65" />
                  </div>

                  <p
                    className="relative mt-4 min-h-[112px] overflow-hidden text-sm leading-7 text-foreground/80"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {review.text}
                  </p>

                  <div className="relative mt-auto h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />

                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-center md:hidden">
            <Link
              to="/reviews"
              className="inline-flex items-center gap-2 text-primary font-semibold"
            >
              See All Reviews
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top,_rgba(255,179,71,0.18),_transparent_38%),linear-gradient(135deg,rgba(255,107,53,0.12),rgba(10,10,15,0.96)_46%,rgba(10,10,15,1)_100%)] px-5 py-10 sm:px-8 sm:py-12 text-center shadow-[0_30px_80px_rgba(0,0,0,0.28)] md:px-14">
            <div className="mb-5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                <Star className="h-3.5 w-3.5" />
                Weekly Drop Alert
              </div>
            </div>

            <h2 className="mb-4 text-2xl sm:text-4xl leading-tight md:text-5xl">Get new mockups every week</h2>
            <p className="mx-auto mb-8 max-w-2xl text-base text-foreground/68 md:text-lg">
              Subscribe to get fresh mockup releases, curated picks, and new design-ready scenes before everyone else.
            </p>

            <form
              onSubmit={handleNewsletterSubmit}
              className="mx-auto flex max-w-2xl flex-col gap-3 md:flex-row"
            >
              <div className="flex flex-1 items-center gap-3 rounded-[1rem] border border-white/6 bg-background/85 px-5">
                <Mail className="h-5 w-5 text-primary/85" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={newsletterStatus === "loading" || newsletterStatus === "success"}
                  className="h-14 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/85 focus:outline-none disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={newsletterStatus === "loading" || newsletterStatus === "success"}
                className="h-14 rounded-[1rem] bg-gradient-to-br from-primary to-secondary px-8 text-primary-foreground font-semibold transition-all hover:scale-[1.01] hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {newsletterStatus === "loading" ? "Subscribing..." : newsletterStatus === "success" ? "Subscribed ✓" : "Subscribe"}
              </button>
            </form>
            {newsletterMsg ? (
              <p className={`mt-4 text-sm font-medium ${newsletterStatus === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {newsletterMsg}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
