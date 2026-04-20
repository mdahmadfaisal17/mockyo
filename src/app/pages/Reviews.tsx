import { AnimatePresence, motion } from "motion/react";
import { Quote, Star, X } from "lucide-react";
import { FormEvent, useMemo, useState, useEffect } from "react";
import { readAuthUser } from "../imports/authStore";
import { openAuthModal } from "../imports/authModalStore";

type ReviewItem = {
  id: string;
  name: string;
  email?: string;
  rating: number;
  text: string;
  approved: boolean;
};

const LAST_REVIEW_TS_KEY = "mockyo.last-review-submit-ts";
const MIN_REVIEW_GAP_MS = 20_000;

const isBrowser = () => typeof window !== "undefined";

const readLastSubmitTimestamp = (): number => {
  if (!isBrowser()) return 0;
  const raw = window.localStorage.getItem(LAST_REVIEW_TS_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeLastSubmitTimestamp = (value: number) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(LAST_REVIEW_TS_KEY, String(value));
};

export default function Reviews() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [website, setWebsite] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState(readAuthUser());
  const [approvedReviews, setApprovedReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    setCurrentUser(readAuthUser());
  }, [isModalOpen]);

  useEffect(() => {
    const loadApprovedReviews = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/reviews`);
        const result = await response.json().catch(() => null);
        if (response.ok && result?.ok && Array.isArray(result.items)) {
          const mapped = result.items.map((item: any) => ({
            id: String(item._id || item.id || ""),
            name: String(item.name || "Unknown"),
            email: String(item.email || ""),
            rating: Number(item.rating) || 0,
            text: String(item.text || ""),
            approved: Boolean(item.approved),
          }));
          setApprovedReviews(mapped);
          return;
        }
      } catch {
        setApprovedReviews([]);
      }
    };

    const handleFocus = () => {
      void loadApprovedReviews();
    };

    void loadApprovedReviews();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [apiBaseUrl]);

  const ratingSummary = useMemo(() => {
    if (approvedReviews.length === 0) return "0.0";
    const total = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / approvedReviews.length).toFixed(1);
  }, [approvedReviews]);

  const resetForm = () => {
    setName("");
    setRating(0);
    setReviewText("");
    setWebsite("");
    setFormError("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const openModal = () => {
    const user = readAuthUser();
    if (!user) {
      openAuthModal("login");
      return;
    }
    setFormSuccess("");
    setName(user.name || "");
    setCurrentUser(user);
    setIsModalOpen(true);
  };

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!currentUser) {
      setFormError("You must be signed in to submit a review.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedText = reviewText.trim();

    if (website.trim()) {
      setFormError("Spam detected. Please try again.");
      return;
    }

    if (trimmedName.length < 2) {
      setFormError("Please enter your name.");
      return;
    }

    if (rating < 1 || rating > 5) {
      setFormError("Please choose a rating.");
      return;
    }

    if (trimmedText.length < 10) {
      setFormError("Please write at least 10 characters.");
      return;
    }

    // Check if user already has 5 approved reviews
    const userApprovedCount = approvedReviews.filter(
      (r) => r.email === currentUser.email
    ).length;
    if (userApprovedCount >= 5) {
      setFormError("You can only submit up to 5 reviews.");
      return;
    }

    const now = Date.now();
    const lastSubmit = readLastSubmitTimestamp();
    if (now - lastSubmit < MIN_REVIEW_GAP_MS) {
      setFormError("Please wait a few seconds before submitting again.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          rating,
          text: trimmedText,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Failed to submit review.");
      }

      // Keep last submit guard locally to reduce spammy retries.
      writeLastSubmitTimestamp(now);
      setFormSuccess("Thanks. Your review was submitted and is waiting for approval.");
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit review.");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.09),_transparent_28%),linear-gradient(180deg,#09090d_0%,#0d0d13_100%)]">
      <section className="border-b border-white/8 px-4 sm:px-6 py-12 sm:py-20">
        <div className="mx-auto max-w-6xl flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Reviews</p>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Client Reviews</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Real feedback from creators and teams who use Mockyo to build and ship better product visuals.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <div className="inline-flex items-center gap-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-primary">{ratingSummary}</span>
                  <span className="text-sm font-semibold text-foreground/90">/5</span>
                </div>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const rating = parseFloat(ratingSummary);
                      const isFilled = i < Math.floor(rating);
                      return (
                        <svg key={i} viewBox="0 0 16 16" className={`h-3 w-3 ${isFilled ? "text-amber-400" : "text-zinc-700"}`} fill="currentColor">
                          <path d="M8 1.25l1.74 3.53 3.89.57-2.82 2.74.67 3.87L8 10.01l-3.48 1.95.67-3.87L2.37 5.35l3.89-.57z" />
                        </svg>
                      );
                    })}
                  </div>
                  <span className="text-xs font-medium text-foreground/80">Average Rating</span>
                </div>
              </div>

              <button
                type="button"
                onClick={openModal}
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_16px_30px_rgba(255,107,53,0.28)] transition-colors hover:bg-primary/90"
              >
                Add Your Review
              </button>
            </div>

            {formSuccess ? (
              <p className="mt-4 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                {formSuccess}
              </p>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section className="py-14 overflow-hidden">
        <style>{`
          @keyframes marquee-left {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marquee-right {
            0%   { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .marquee-left  { animation: marquee-left  40s linear infinite; }
          .marquee-right { animation: marquee-right 40s linear infinite; }
          .marquee-track:hover .marquee-left,
          .marquee-track:hover .marquee-right { animation-play-state: paused; }
        `}</style>

        {(() => {
          const ReviewCard = ({ review }: { review: ReviewItem }) => (
            <article className="group relative flex h-[220px] sm:h-[250px] w-[300px] sm:w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 sm:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-[2px] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_24px_60px_rgba(255,107,53,0.18)]">
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
                    <svg key={i} viewBox="0 0 16 16" className={`h-4 w-4 ${i < review.rating ? "text-amber-400" : "text-zinc-700"}`} fill="currentColor">
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
          );

          if (approvedReviews.length <= 1) {
            const single = approvedReviews[0];
            return (
              <div className="mx-auto max-w-7xl px-6">
                <div className="flex justify-center">
                  {single ? <ReviewCard review={single} /> : null}
                </div>
              </div>
            );
          }

          const half = Math.ceil(approvedReviews.length / 2);
          const rail1 = approvedReviews.slice(0, half);
          const rail2 = approvedReviews.slice(half);

          const filledRail1 = rail1.length > 0 ? rail1 : approvedReviews;
          const filledRail2 = rail2.length > 0 ? rail2 : approvedReviews;

          return (
            <div className="space-y-4">
              {/* Rail 1: right → left */}
              <div className="marquee-track flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div className="marquee-left flex gap-4">
                  {[...filledRail1, ...filledRail1].map((review, i) => (
                    <ReviewCard key={`r1-${review.id}-${i}`} review={review} />
                  ))}
                </div>
              </div>

              {/* Rail 2: left → right */}
              <div className="marquee-track flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div className="marquee-right flex gap-4">
                  {[...filledRail2, ...filledRail2].map((review, i) => (
                    <ReviewCard key={`r2-${review.id}-${i}`} review={review} />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#101119] p-6 shadow-[0_28px_55px_rgba(0,0,0,0.45)]"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-100">Add Your Review</h2>
                  <p className="mt-1 text-sm text-zinc-400">Your review will be visible after approval.</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-white/12 p-2 text-zinc-300 transition-colors hover:bg-white/10"
                  aria-label="Close review form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-4">
                <input
                  type="text"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div>
                  <label htmlFor="review-name" className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Name
                  </label>
                  <input
                    id="review-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <p className="mb-1.5 block text-sm font-medium text-zinc-200">Rating</p>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const starValue = index + 1;
                      const isActive = starValue <= rating;
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setRating(starValue)}
                          className={`rounded-md p-1 transition-colors ${
                            isActive ? "text-primary" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                          aria-label={`Rate ${starValue} star`}
                        >
                          <Star className="h-6 w-6" fill={isActive ? "currentColor" : "none"} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-text" className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Review
                  </label>
                  <textarea
                    id="review-text"
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="Share your experience"
                    className="h-32 w-full resize-none rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                    required
                  />
                </div>

                {formError ? (
                  <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Submit Review
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
