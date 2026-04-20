import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  useEffect(() => {
    const runVerification = async () => {
      if (!email || !token) {
        setStatus("error");
        setMessage("Invalid verification link. Please request a new verification email.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.message || "Email verification failed.");
        }

        setStatus("success");
        setMessage(result?.message || "Email verified successfully. You can sign in now.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Email verification failed.");
      }
    };

    runVerification();
  }, [apiBaseUrl, email, token]);

  return (
    <section className="min-h-[70vh] bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.12),transparent_52%),#070811] px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#121422] p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-black/25">
          {status === "success" ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          ) : status === "error" ? (
            <XCircle className="h-8 w-8 text-red-400" />
          ) : (
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
          )}
        </div>

        <h1 className="text-2xl font-semibold text-zinc-100">Email Verification</h1>
        <p className="mt-3 text-sm text-zinc-300">{message}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="rounded-lg bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-[#1B0E08] transition hover:brightness-105"
          >
            Go to Login
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-white/12 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
