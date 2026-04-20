import { AnimatePresence, motion } from "motion/react";
import { Lock, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { openAuthModal } from "../imports/authModalStore";
import { OPEN_GUEST_ACCESS_MODAL_EVENT } from "../imports/guestAccessModalStore";

export default function GuestAccessModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    const escapeHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener(OPEN_GUEST_ACCESS_MODAL_EVENT, openHandler);
    window.addEventListener("keydown", escapeHandler);

    return () => {
      window.removeEventListener(OPEN_GUEST_ACCESS_MODAL_EVENT, openHandler);
      window.removeEventListener("keydown", escapeHandler);
    };
  }, []);

  const closeModal = () => setIsOpen(false);

  const handleSignin = () => {
    setIsOpen(false);
    openAuthModal("login");
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/72 p-4"
          onClick={closeModal}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.16),transparent_28%),linear-gradient(180deg,#13131b_0%,#0f1016_100%)] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.48)]"
          >
            <div className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full bg-primary/16 blur-2xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Daily limit reached</p>
                  <h2 className="mt-1 text-2xl font-semibold text-zinc-100">Sign in to continue</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-white/12 p-2 text-zinc-300 transition-colors hover:bg-white/10"
                aria-label="Close guest access modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="relative mt-5 text-sm leading-7 text-zinc-300">
              You've reached today's free download limit.
              Sign in to continue downloading without waiting.
            </p>

            <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-primary/16 bg-primary/8 px-4 py-3 text-sm text-zinc-200">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>Your limit resets every day, or unlock instant access by signing in.</p>
            </div>

            <div className="relative mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
              >
                Maybe Later
              </button>
              <button
                type="button"
                onClick={handleSignin}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in & continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}