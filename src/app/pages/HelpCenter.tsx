import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ImagePlay,
  LifeBuoy,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";

const categories = [
  { id: "getting-started", icon: Zap, label: "Getting Started" },
  { id: "downloads", icon: Download, label: "Downloads" },
  { id: "editor", icon: ImagePlay, label: "Editor" },
  { id: "account", icon: UserRound, label: "Account" },
  { id: "security", icon: ShieldCheck, label: "Security" },
  { id: "general", icon: BookOpen, label: "General" },
];

type FaqItem = { q: string; a: string };

const faqData: Record<string, FaqItem[]> = {
  "getting-started": [
    {
      q: "What is Mockyo?",
      a: "Mockyo is a free platform where you can browse professional mockups and apply your own designs to them using the built-in editor — no design software required.",
    },
    {
      q: "Do I need an account to use Mockyo?",
      a: "You can browse mockups without an account. However, downloading files and using the editor requires a free account. Sign up takes less than a minute.",
    },
    {
      q: "Is Mockyo free?",
      a: "Yes. All mockups and editor features are currently completely free. We may introduce optional premium tiers in the future, but core features will always be accessible.",
    },
    {
      q: "How do I get started?",
      a: "Create a free account, browse the Mockups page, find one you like, open it in the Editor, upload your design image, and export the final result in seconds.",
    },
  ],
  downloads: [
    {
      q: "Do I need to log in to download mockups?",
      a: "Yes. A free account is required before you can download any mockup files. This helps us keep the platform free and prevents abuse.",
    },
    {
      q: "What format are the downloaded mockups in?",
      a: "Mockups are available as high-resolution PNG or JPEG files, ready for professional use in presentations, portfolios, and marketing materials.",
    },
    {
      q: "Is there a download limit?",
      a: "There is currently no strict download limit. You can download as many mockups as you need for your projects.",
    },
    {
      q: "Why is my download not starting?",
      a: "Make sure you are logged in and your internet connection is stable. If the issue persists, try a different browser or clear your browser cache, then contact us if it still fails.",
    },
    {
      q: "Can I use downloaded mockups for commercial projects?",
      a: "Yes. All mockups on Mockyo may be used in both personal and commercial projects — including client work, marketing, and social media. You may not resell them as standalone files.",
    },
  ],
  editor: [
    {
      q: "How does the Mockyo editor work?",
      a: "Open any mockup detail page and click 'Open in Editor'. Upload your design image and it will be automatically placed onto the mockup surface. You can adjust position, scale, and rotation, then export the result.",
    },
    {
      q: "What file types can I upload as my design?",
      a: "The editor accepts common image formats including PNG, JPEG, and WebP. For best results, use a PNG with a transparent background.",
    },
    {
      q: "Are my uploaded designs stored on your servers?",
      a: "No. Your uploaded design images are used only for the current session to generate the mockup preview. They are not saved or stored on our servers.",
    },
    {
      q: "What export options are available?",
      a: "You can export your final mockup as a PNG or JPEG. High-resolution exports are supported for print and professional use.",
    },
    {
      q: "My design looks distorted on the mockup. How do I fix it?",
      a: "Use the transform controls in the editor to adjust scale, position, and rotation. For perspective mockups, the warp handles let you fit your design precisely to the mockup surface.",
    },
  ],
  account: [
    {
      q: "How do I create an account?",
      a: "Click 'Sign Up' in the header, enter your name, email and password, then verify your email address via the link we send you. You can also sign up instantly with Google.",
    },
    {
      q: "How do I change my password?",
      a: "Go to Account Settings, scroll to the Security section, and click 'Change Password'. A 6-digit verification code will be sent to your email. Enter the code, then set your new password.",
    },
    {
      q: "I forgot my password. How do I reset it?",
      a: "On the login page, click 'Forgot Password', enter your email address, and we will send you a secure reset link. The link expires after 1 hour.",
    },
    {
      q: "How do I update my name?",
      a: "Go to Account Settings and click 'Edit name' next to your full name. Enter the new name and save.",
    },
    {
      q: "Can I sign in with Google?",
      a: "Yes. You can use Google Sign-In to create or access your Mockyo account without a password. On the login or sign-up page, click 'Continue with Google'.",
    },
    {
      q: "How do I delete my account?",
      a: "To delete your account and all associated data, contact us at mockyo.official@gmail.com with your request and we will process it promptly.",
    },
  ],
  security: [
    {
      q: "Is my password stored securely?",
      a: "Yes. Passwords are never stored in plain text. We use bcrypt hashing to protect your password with a secure one-way algorithm.",
    },
    {
      q: "Why do I need to verify my email?",
      a: "Email verification confirms that you own the address you signed up with and helps keep your account secure against unauthorized registrations.",
    },
    {
      q: "Does Mockyo share my data with third parties?",
      a: "No. We do not sell or share your personal data with third parties. We may use Google for authentication, but no personal data is shared for advertising purposes.",
    },
    {
      q: "What should I do if I think my account was compromised?",
      a: "Immediately change your password from Account Settings using the 2-step email verification flow. If you cannot log in, use the 'Forgot Password' option or contact us at mockyo.official@gmail.com.",
    },
  ],
  general: [
    {
      q: "Can I request a specific mockup?",
      a: "Absolutely. Email us at mockyo.official@gmail.com with a description of the mockup type you need and we will do our best to add it.",
    },
    {
      q: "How often are new mockups added?",
      a: "We regularly add new mockups. You can check the Mockups page for the latest additions, sorted by newest.",
    },
    {
      q: "I found a bug. How do I report it?",
      a: "Please email mockyo.official@gmail.com with a description of the issue, the page or feature where it occurred, and if possible, a screenshot. We appreciate every report.",
    },
    {
      q: "How can I leave a review?",
      a: "Visit the Reviews page and submit your feedback. Reviews help us improve and are visible to the community once approved.",
    },
  ],
};

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? "border-primary/30 bg-primary/[0.05]" : "border-white/8 bg-background/55"}`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[15px] font-medium text-zinc-100">{item.q}</span>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50" />
              )}
            </button>
            {isOpen ? (
              <div className="border-t border-white/8 px-5 pb-4 pt-3">
                <p className="text-[14px] leading-7 text-foreground/68">{item.a}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function HelpCenter() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const searchLower = search.trim().toLowerCase();

  const visibleCategories = categories.filter(({ id }) => {
    if (activeCategory && activeCategory !== id) return false;
    if (!searchLower) return true;
    return faqData[id].some(
      (item) =>
        item.q.toLowerCase().includes(searchLower) ||
        item.a.toLowerCase().includes(searchLower),
    );
  });

  const filteredFaq = (id: string): FaqItem[] => {
    if (!searchLower) return faqData[id];
    return faqData[id].filter(
      (item) =>
        item.q.toLowerCase().includes(searchLower) ||
        item.a.toLowerCase().includes(searchLower),
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.09),_transparent_28%),linear-gradient(180deg,#09090d_0%,#0d0d13_100%)]">
      {/* Hero */}
      <section className="border-b border-white/8 px-4 sm:px-6 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full"
          >
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <LifeBuoy className="h-7 w-7" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              Help Center
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">How can we help?</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Find answers to common questions about Mockyo.
            </p>

            {/* Search */}
            <div className="relative mt-8">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for a question..."
                className="w-full rounded-2xl border border-white/12 bg-white/[0.04] py-3.5 pl-11 pr-5 text-sm text-zinc-100 placeholder:text-foreground/38 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category filter */}
      <section className="border-b border-white/8 px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === null
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-foreground/60 hover:border-white/20 hover:text-foreground/90"
              }`}
            >
              All
            </button>
            {categories.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveCategory(activeCategory === id ? null : id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-white/[0.03] text-foreground/60 hover:border-white/20 hover:text-foreground/90"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ sections */}
      <section className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl space-y-10">
          {visibleCategories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center text-foreground/50"
            >
              <Search className="mx-auto mb-4 h-8 w-8 opacity-40" />
              <p className="text-lg font-medium text-foreground/60">No results found</p>
              <p className="mt-2 text-sm">
                Try a different search term or{" "}
                <Link to="/contact" className="text-primary hover:underline">
                  contact us
                </Link>{" "}
                directly.
              </p>
            </motion.div>
          ) : (
            visibleCategories.map(({ id, icon: Icon, label }, idx) => {
              const items = filteredFaq(id);
              if (items.length === 0) return null;
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 + idx * 0.06 }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/14 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-100">{label}</h2>
                  </div>
                  <FaqAccordion items={items} />
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* Still need help CTA */}
      <section className="px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center gap-6 rounded-2xl sm:rounded-[2rem] border border-primary/18 bg-primary/[0.05] p-6 sm:p-10 text-center shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100">Still need help?</h2>
              <p className="mt-3 max-w-md text-[15px] leading-7 text-foreground/68">
                Can't find what you're looking for? Our team is happy to help. Reach out directly and
                we'll get back to you within 24–48 hours.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="mailto:mockyo.official@gmail.com"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Mail className="h-4 w-4" />
                Email Us
              </a>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-white/[0.08]"
              >
                <Settings className="h-4 w-4" />
                Contact Page
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
