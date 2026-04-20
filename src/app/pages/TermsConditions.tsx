import { motion } from "motion/react";
import { AlertTriangle, Download, FileText, Fingerprint, Shield, Sparkles, UserRound } from "lucide-react";

const restrictionItems = [
  "Resell mockups as standalone products",
  "Claim mockups as your original creation",
];

export default function TermsConditions() {
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
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Terms & Conditions</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              By using Mockyo, you agree to the following terms and conditions.
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
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">Use of Mockups</h2>
            <p className="mt-4 text-[15px] leading-8 text-foreground/74">
              All mockups are provided for personal and commercial use, and you may use them to
              showcase your designs.
            </p>
            <p className="mt-6 rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm leading-7 text-foreground/78">
              However, you cannot resell or redistribute mockups as your own.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Download className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Downloads</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                Mockups are free to download, but login is required before downloading.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Editor Usage</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                You can upload your design and apply it to mockups. Exported images in PNG or JPEG
                format are for your use.
              </p>
              <p className="mt-5 rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm leading-7 text-foreground/78">
                We do not store your designs permanently.
              </p>
            </motion.div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <h2 className="text-2xl font-semibold">Restrictions</h2>
              <div className="mt-6 space-y-3">
                {restrictionItems.map((item) => (
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
              transition={{ duration: 0.5, delay: 0.3 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <UserRound className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Accounts</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                You are responsible for your account and should keep your login details secure.
              </p>
              <h3 className="mt-8 text-lg font-semibold">Future Updates</h3>
              <p className="mt-3 text-[15px] leading-8 text-foreground/74">
                Mockyo may introduce premium features in the future, and some features may become
                paid.
              </p>
            </motion.div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Fingerprint className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Intellectual Property</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                All mockup assets, website content, and branding on Mockyo are the exclusive property
                of Mockyo and are protected by applicable intellectual property laws.
              </p>
              <p className="mt-6 rounded-2xl border border-white/8 bg-background/55 px-5 py-4 text-sm leading-7 text-foreground/78">
                Unauthorized reproduction, distribution, or use of our content without permission is
                strictly prohibited.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Limitation of Liability</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                Mockyo is provided as-is without any warranties, express or implied. We are not
                responsible for any damages or losses — direct or indirect — resulting from your use
                of our platform, downloads, or editor tools.
              </p>
            </motion.div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.34 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Changes</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/74">
                We may update these terms at any time without prior notice.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-primary/[0.06] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
            >
              <h2 className="text-2xl font-semibold">Contact</h2>
              <p className="mt-4 text-[15px] leading-8 text-foreground/78">For any questions:</p>
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
