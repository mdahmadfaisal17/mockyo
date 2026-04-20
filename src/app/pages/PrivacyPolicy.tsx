import { motion } from "motion/react";
import { Cookie, Database, Lock, ShieldCheck, UserCheck } from "lucide-react";

const collectedInfo = ["Name", "Email address", "Login details"];
const usageItems = [
  "Provide access to mockups",
  "Improve our platform",
  "Communicate updates or support",
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.09),_transparent_28%),linear-gradient(180deg,#09090d_0%,#0d0d13_100%)]">
      <section className="border-b border-white/8 px-4 sm:px-6 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              Legal
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              At Mockyo, we respect your privacy and are committed to protecting your personal
              information.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-10 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">Information We Collect</h2>
            <p className="mt-4 text-[15px] leading-8 text-foreground/74">
              We may collect the following information only when you create an account or contact us.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {collectedInfo.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm text-foreground/80"
                >
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <h2 className="text-2xl font-semibold">How We Use Your Information</h2>
              <div className="mt-6 space-y-3">
                {usageItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm text-foreground/80"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Design & Upload Data</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                We do not store your uploaded designs permanently. Your design uploads are used only
                for generating mockup previews.
              </p>
            </motion.div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Cookie className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Cookies & Local Storage</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                We use session cookies and browser local storage to keep you signed in and remember
                your preferences. We do not use third-party advertising or tracking cookies.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <UserCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Your Rights</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                You have the right to access, correct, or request deletion of your personal data at
                any time by contacting us.
              </p>
              <div className="mt-6 space-y-3">
                {["Request a copy of your stored data", "Correct inaccurate personal information", "Delete your account and associated data"].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm text-foreground/80"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Data Protection</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                We take reasonable measures to protect your data and keep it secure.
              </p>
              <h3 className="mt-8 text-lg font-semibold">Third-Party Services</h3>
              <p className="mt-3 text-[15px] leading-8 text-foreground/74">
                We may use third-party services, such as Google login, for authentication.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-primary/[0.06] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <h2 className="text-2xl font-semibold">Contact</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/78">
                If you have any questions about this Privacy Policy, contact us at:
              </p>
              <a
                href="mailto:mockyo.official@gmail.com"
                className="mt-6 inline-block text-lg font-medium text-primary transition-colors hover:text-primary/85"
              >
                mockyo.official@gmail.com
              </a>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
