import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import MockupCard from "../components/MockupCard";
import CategoryDropdown from "../components/CategoryDropdown";
import SortDropdown from "../components/SortDropdown";
import { getAllMockups } from "../imports/mockupStore";
import { fetchJsonWithRetry } from "../lib/apiRetry";

type CategoryHierarchy = Record<string, Record<string, string[]>>;

const defaultCategoryHierarchy: CategoryHierarchy = {
  Apparel: {
    "T-Shirt": ["Oversized", "Sleeve", "Sleeve Less"],
    Hoodie: ["Oversized", "Sleeve", "Sleeve Less", "Hood"],
  },
};

const adminCategoryStorageKey = "mockyo.admin.category-config";

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const normalizeCompare = (value: string) => normalizeLabel(value).toLowerCase();

const mergeUniqueLabels = (...groups: Array<string[] | undefined>) => {
  const next: string[] = [];
  const seen = new Set<string>();

  groups.forEach((group) => {
    (group || []).forEach((rawItem) => {
      const item = normalizeLabel(rawItem || "");
      if (!item) return;
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      next.push(item);
    });
  });

  return next;
};

const mergeHierarchy = (
  base: CategoryHierarchy,
  incoming?: CategoryHierarchy,
): CategoryHierarchy => {
  const next: CategoryHierarchy = JSON.parse(JSON.stringify(base));
  if (!incoming || typeof incoming !== "object") return next;

  Object.entries(incoming).forEach(([mainCategory, categoryMap]) => {
    const main = normalizeLabel(mainCategory);
    if (!main) return;
    if (!next[main]) next[main] = {};

    if (!categoryMap || typeof categoryMap !== "object") return;

    Object.entries(categoryMap).forEach(([category, subList]) => {
      const cat = normalizeLabel(category);
      if (!cat) return;
      next[main][cat] = mergeUniqueLabels(next[main][cat], Array.isArray(subList) ? subList : []);
    });
  });

  return next;
};

export default function Mockups() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("all");
  const [mockups, setMockups] = useState(() => getAllMockups());
  const [categoryHierarchy, setCategoryHierarchy] = useState<CategoryHierarchy>(
    defaultCategoryHierarchy,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(adminCategoryStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { hierarchy?: CategoryHierarchy };
      if (parsed?.hierarchy) {
        setCategoryHierarchy((prev) => mergeHierarchy(prev, parsed.hierarchy));
      }
    } catch {
      // Keep defaults if storage is unavailable or malformed.
    }
  }, []);

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
          downloads: item.downloads ?? 0,
          createdAt: item.createdAt,
        }));

        const fetchedHierarchy = result.items.reduce((acc: CategoryHierarchy, item: any) => {
          const main = normalizeLabel(String(item?.mainCategory || ""));
          const cat = normalizeLabel(String(item?.category || ""));

          if (!main || !cat) return acc;
          if (!acc[main]) acc[main] = {};
          if (!acc[main][cat]) acc[main][cat] = [];

          return acc;
        }, {});

        setCategoryHierarchy((prev) => mergeHierarchy(prev, fetchedHierarchy));

        setMockups(mapped);
      } catch {
        // Keep existing items instead of clearing UI during temporary API errors.
      }
    };

    void loadMockups();
  }, [apiBaseUrl]);

  const categoryOptions = Object.entries(categoryHierarchy).map(([main, categoryMap]) => {
    const subcategories = Object.entries(categoryMap).map(([cat]) => {
      return {
        name: cat,
        value: `category:${main}::${cat}`,
      };
    });

    return {
      name: main,
      value: `main:${main}`,
      subcategories,
    };
  });

  const matchesSelectedCategory = (item: { mainCategory?: string; category?: string }) => {
    if (category === "all") return true;

    if (category.startsWith("main:")) {
      const selectedMain = category.slice(5);
      return normalizeCompare(item.mainCategory || "") === normalizeCompare(selectedMain);
    }

    if (category.startsWith("category:")) {
      const payload = category.slice(9);
      const [selectedMain = "", selectedCategory = ""] = payload.split("::");
      return (
        normalizeCompare(item.mainCategory || "") === normalizeCompare(selectedMain) &&
        normalizeCompare(item.category || "") === normalizeCompare(selectedCategory)
      );
    }

    return false;
  };

  const filteredMockups = mockups
    .filter((mockup) => {
      const matchesSearch = mockup.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = matchesSelectedCategory(mockup);
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "all") return 0;
      if (sortBy === "popular") return b.downloads - a.downloads;
      if (sortBy === "latest") {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }
      if (sortBy === "downloads") return b.downloads - a.downloads;
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 sm:py-20 bg-background border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-8 sm:mb-12"
          >
            <h1 className="mb-4 text-3xl sm:text-4xl md:text-5xl">Browse Mockups</h1>
            <p className="text-lg text-muted-foreground">
              Explore high-quality mockups and start editing instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mockups..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <CategoryDropdown value={category} onChange={setCategory} categories={categoryOptions} />
                <SortDropdown value={sortBy} onChange={setSortBy} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {filteredMockups.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMockups.map((mockup, index) => (
                  <motion.div
                    key={mockup.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <MockupCard {...mockup} />
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-12 text-center"
              >
                <button className="px-8 py-4 rounded-md bg-muted hover:bg-muted/80 text-foreground font-semibold transition-colors">
                  Load More
                </button>
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted flex items-center justify-center">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No mockups found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
