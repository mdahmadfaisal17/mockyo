import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShieldCheck, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { writeAdminSession } from "../imports/adminAuthStore";
import mockyoLogo from "../../assets/mockyo-logo.svg";

export default function AdminLogin() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/admin/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || !result?.admin) {
        throw new Error(result?.message || "Admin login failed.");
      }

      writeAdminSession({
        id: String(result.admin.id || ""),
        name: String(result.admin.name || "Admin"),
        email: String(result.admin.email || email.trim().toLowerCase()),
        role: "Admin",
      });

      navigate("/admin", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Admin login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.14),transparent_48%),#070811] px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#121422] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <img src={mockyoLogo} alt="Mockyo" className="h-10 w-auto rounded-none" />
            <p className="text-2xl font-bold tracking-tight text-zinc-100">Mockyo</p>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-100">Admin Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-200">Admin Email</span>
            <div className="flex items-center gap-2 rounded-lg border border-white/14 bg-black/25 px-3 py-2.5">
              <Mail className="h-4 w-4 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email"
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-200">Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-white/14 bg-black/25 px-3 py-2.5">
              <Lock className="h-4 w-4 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-zinc-400 hover:text-zinc-200 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {errorMessage ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-lg bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-[#1B0E08] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in to Admin"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-400">
          Back to <Link to="/" className="text-[#FF6B35] hover:underline">Website</Link>
        </p>
      </div>
    </div>
  );
}
