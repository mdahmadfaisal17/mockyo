import { motion } from "motion/react";
import { Mail, Lock, Clock, Eye, EyeOff, X, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readAuthUser, writeAuthUser } from "../imports/authStore";
import type { AuthUser } from "../imports/authStore";

export default function AccountSettings() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // Modal step: null = closed, "otp" = verify code, "password" = change password
  const [modalStep, setModalStep] = useState<null | "otp" | "password">(null);

  // OTP step
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password step
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    const user = readAuthUser();
    setCurrentUser(user);
    setEditedName(user?.name || "");
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const initials = (currentUser?.name || currentUser?.email || "U").trim().charAt(0).toUpperCase();

  const closeModal = () => {
    setModalStep(null);
    setOtp(["", "", "", "", "", ""]);
    setOtpMessage("");
    setOtpError("");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("");
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setMessage("Name cannot be empty.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");

      if (currentUser) {
        const updated = { ...currentUser, name: editedName.trim() };
        writeAuthUser(updated);
        setCurrentUser(updated);
        setIsEditingName(false);
        setMessage("Name updated successfully.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update name.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChangePassword = async () => {
    setOtpError("");
    setOtpMessage("");
    setOtp(["", "", "", "", "", ""]);
    setModalStep("otp");
    await sendOtp();
  };

  const sendOtp = async () => {
    setIsSendingOtp(true);
    setOtpError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/send-change-password-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser?.email }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Failed to send code.");
      setOtpMessage("A 6-digit code has been sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/verify-change-password-otp`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser?.email, otp: code }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Invalid code.");
      setModalStep("password");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage("New password must be at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setPasswordMessage("");

      const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: currentUser?.email,
          oldPassword,
          newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Password change failed.");
      }

      setPasswordMessage("Password changed successfully.");
      setTimeout(() => closeModal(), 1500);
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Password change failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.09),_transparent_26%),linear-gradient(180deg,#09090d_0%,#0d0d13_100%)] px-4 sm:px-6 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Account</p>
          <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-100">Profile Settings</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            Manage your profile information, security settings, and account preferences.
          </p>
        </motion.section>

        {/* Profile Information */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
        >
          <h2 className="text-lg font-semibold text-zinc-100">Profile Information</h2>
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">Profile Avatar</p>
                <p className="mt-1 text-xs text-zinc-500">Initials from your name</p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-4">
              <label className="block text-sm font-medium text-zinc-200">Full Name</label>
              {isEditingName ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full rounded-lg border border-white/14 bg-black/25 px-4 py-2.5 text-sm text-zinc-100 focus:border-primary/50 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveName}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(currentUser?.name || "");
                      }}
                      className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={currentUser?.name || ""}
                    disabled
                    className="mt-2 w-full rounded-lg border border-white/14 bg-black/25 px-4 py-2.5 text-sm text-zinc-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="mt-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Edit name
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.section>

        {/* Contact & Email */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-zinc-100">Email Address</h2>
          </div>
          <div className="mt-4">
            <input
              type="email"
              value={currentUser?.email || ""}
              disabled
              className="w-full rounded-lg border border-white/14 bg-black/25 px-4 py-2.5 text-sm text-zinc-100 disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Your verified email address. Contact support to change your email.
            </p>
          </div>
        </motion.section>

        {/* Security */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-zinc-100">Security</h2>
          </div>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={handleOpenChangePassword}
              disabled={isSendingOtp}
              className="w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
            >
              {isSendingOtp ? "Sending code..." : "Change Password"}
            </button>
            <p className="text-xs text-zinc-500">
              Update your password regularly to keep your account secure.
            </p>
          </div>
        </motion.section>

        {/* Account Information */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-zinc-100">Account Information</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-sm text-zinc-400">Account Status</span>
              <span className="text-sm font-medium text-emerald-400">Active</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-sm text-zinc-400">Member Since</span>
              <span className="text-sm font-medium text-zinc-300">2026</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* OTP Verification Modal */}
      {modalStep === "otp" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101119] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Security</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Verify It's You</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Enter the 6-digit code sent to{" "}
                  <span className="text-zinc-200">{currentUser?.email}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-white/12 p-2 text-zinc-300 transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-14 w-12 rounded-xl border border-white/14 bg-black/30 text-center text-xl font-bold text-zinc-100 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                ))}
              </div>

              {otpMessage ? (
                <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-200">
                  {otpMessage}
                </p>
              ) : null}

              {otpError ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
                  {otpError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otp.join("").length < 6}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifyingOtp ? "Verifying..." : "Verify Code"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={isSendingOtp || resendCooldown > 0}
                  className="text-sm text-zinc-400 underline-offset-2 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSendingOtp
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Change Password Modal */}
      {modalStep === "password" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101119] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Security</p>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Change Password</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-white/12 p-2 text-zinc-300 transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">Current Password</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 pr-11 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 pr-11 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">Confirm New Password</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/14 bg-black/25 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary/50 focus:outline-none"
                />
              </div>

              {passwordMessage ? (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    passwordMessage.includes("successfully")
                      ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border border-red-400/30 bg-red-500/10 text-red-200"
                  }`}
                >
                  {passwordMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleChangePassword}
                disabled={isSubmitting}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Updating..." : "Change Password"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
