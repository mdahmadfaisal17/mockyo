import { AnimatePresence, motion } from "motion/react";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { OPEN_AUTH_MODAL_EVENT, type AuthModalMode } from "../imports/authModalStore";
import { writeAuthUser } from "../imports/authStore";

export default function AuthModal() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const openHandler = (event: Event) => {
      const customEvent = event as CustomEvent<AuthModalMode>;
      setMode(customEvent.detail || "login");
      setIsOpen(true);
      setErrorMessage("");
      setSuccessMessage("");
    };

    const escapeHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener(OPEN_AUTH_MODAL_EVENT, openHandler as EventListener);
    window.addEventListener("keydown", escapeHandler);

    return () => {
      window.removeEventListener(OPEN_AUTH_MODAL_EVENT, openHandler as EventListener);
      window.removeEventListener("keydown", escapeHandler);
    };
  }, []);

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "forgot") {
        const forgotResponse = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });

        const forgotResult = await forgotResponse.json();
        if (!forgotResponse.ok || !forgotResult?.ok) {
          throw new Error(forgotResult?.message || "Password reset request failed.");
        }

        setSuccessMessage(forgotResult?.message || "Check your email for the reset link.");
        return;
      }

      if (mode === "signup" && !agreedToTerms) {
        throw new Error("Please agree to the Terms & Conditions.");
      }

      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        mode === "login"
          ? {
              email: email.trim(),
              password,
              rememberMe,
            }
          : {
              name: name.trim(),
              email: email.trim(),
              password,
            };

      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Authentication failed.");
      }

      if (mode === "signup") {
        if (!result?.requiresEmailVerification) {
          throw new Error("Verification service is not active yet. Please try again after backend restart.");
        }

        setPassword("");
        setConfirmPassword("");
        setAgreedToTerms(false);
        setRememberMe(false);
        setSuccessMessage(result?.message || "Verification email sent. Please check your inbox.");
        setMode("login");
        return;
      }

      if (!result?.user?.email) {
        throw new Error("Authentication failed.");
      }

      writeAuthUser({
        name: result.user.name || "User",
        email: result.user.email,
      });

      setPassword("");
      setConfirmPassword("");
      setAgreedToTerms(false);
      setRememberMe(false);
      setSuccessMessage("");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const credential = credentialResponse.credential;

    if (!credential) {
      setErrorMessage("Google sign-in failed. Please try again.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/google`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok || !result?.user) {
        throw new Error(result?.message || "Google authentication failed.");
      }

      writeAuthUser({
        name: result.user.name || "User",
        email: result.user.email,
      });

      setPassword("");
      setConfirmPassword("");
      setAgreedToTerms(false);
      setRememberMe(false);
      setSuccessMessage("");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101119] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Account</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
                  {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-white/12 p-2 text-zinc-300 transition-colors hover:bg-white/10"
                aria-label="Close auth modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-200">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                />
              </div>

              {mode !== "forgot" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-200">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 pr-11 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-100"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "signup" ? (
                <label className="flex items-start gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20"
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="/terms-conditions"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                    >
                      Terms &amp; Conditions
                    </a>
                  </span>
                </label>
              ) : null}

              {mode === "login" ? (
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-black/20"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {mode === "forgot" ? (
                <p className="text-xs text-zinc-400">
                  Enter your email address and we&apos;ll send you a secure link to reset your password.
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {successMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? mode === "forgot"
                    ? "Sending Reset Link..."
                    : mode === "login"
                    ? "Signing In..."
                    : "Creating Account..."
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
              </button>

                {mode === "login" ? (
                  <p className="text-center text-sm text-zinc-400">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      Sign up
                    </button>
                  </p>
                ) : null}

                {mode === "signup" ? (
                  <p className="text-center text-sm text-zinc-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      Log in
                    </button>
                  </p>
                ) : null}

              {mode !== "forgot" ? (
                <div className="pt-2">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/15" />
                    <span className="text-xs uppercase tracking-[0.15em] text-zinc-400">or</span>
                    <span className="h-px flex-1 bg-white/15" />
                  </div>
                  {googleClientId ? (
                    <div className="overflow-hidden rounded-lg border border-white/20 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setErrorMessage("Google sign-in failed. Please try again.")}
                        locale="en"
                        theme="outline"
                        shape="square"
                        text={mode === "login" ? "continue_with" : "signup_with"}
                        size="large"
                        width="100%"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-white/15 bg-black/20 px-4 py-3 text-sm font-medium text-zinc-300"
                    >
                      Google {mode === "login" ? "Sign In" : "Sign Up"} unavailable (missing client id)
                    </button>
                  )}
                </div>
              ) : null}

              {mode === "forgot" ? (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="w-full rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/10"
                >
                  Back to Login
                </button>
              ) : null}
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
