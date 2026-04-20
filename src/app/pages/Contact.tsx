import { motion } from "motion/react";
import { Bug, Clock3, Download, HelpCircle, Lightbulb, Mail, MessageSquareMore } from "lucide-react";

const contactTopics = [
  {
    icon: Bug,
    title: "Bug Reports",
    desc: "Found something broken? Let us know and we will fix it quickly.",
  },
  {
    icon: Lightbulb,
    title: "Feature Requests",
    desc: "Have an idea to improve Mockyo? We would love to hear it.",
  },
  {
    icon: Download,
    title: "Download Issues",
    desc: "Trouble downloading a mockup? We are here to help.",
  },
  {
    icon: HelpCircle,
    title: "General Questions",
    desc: "Anything else on your mind? Do not hesitate to reach out.",
  },
];

const faqItems = [
  {
    q: "Do I need an account to download mockups?",
    a: "Yes, a free account is required. You can sign up instantly with your email or through Google.",
  },
  {
    q: "Are the mockups completely free?",
    a: "Yes — all mockups are currently free to download for both personal and commercial use.",
  },
  {
    q: "Can I use Mockyo mockups in client projects?",
    a: "Absolutely. You may use them in client work, marketing materials, and product showcases.",
  },
  {
    q: "What file format will I receive?",
    a: "Mockups are provided as high-quality PNG or JPEG files ready for professional use.",
  },
  {
    q: "Does Mockyo store my uploaded designs?",
    a: "No. Designs you upload in the editor are only used to generate a preview and are not stored on our servers.",
  },
  {
    q: "How do I report an issue or request a new mockup?",
    a: "Simply email us at mockyo.official@gmail.com with as much detail as possible and we will get back to you.",
  },
];

export default function Contact() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,107,53,0.09),_transparent_28%),linear-gradient(180deg,#09090d_0%,#0d0d13_100%)]">
      <section className="border-b border-white/8 px-4 sm:px-6 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
              Contact
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Contact Us</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Have a question or need help? We&apos;re here for you.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">Contact Info</h2>
            <p className="mt-3 text-muted-foreground">Email:</p>
            <a
              href="mailto:mockyo.official@gmail.com"
              className="mt-2 inline-block text-lg font-medium text-primary transition-colors hover:text-primary/85"
            >
              mockyo.official@gmail.com
            </a>

            <div className="mt-8 flex items-start gap-4 rounded-2xl border border-white/8 bg-background/50 p-5">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-7 text-foreground/76">We usually respond within 24-48 hours.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/14 text-primary">
              <MessageSquareMore className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold">Message</h2>
            <p className="mt-4 text-[15px] leading-8 text-foreground/74">
              If you have any questions about mockups, downloads, or using the editor, feel free to
              reach out. We&apos;re always happy to help.
            </p>
            <p className="mt-8 rounded-2xl border border-primary/18 bg-primary/[0.06] px-5 py-4 text-[15px] leading-7 text-foreground/82">
              We&apos;re building Mockyo to make your workflow easier - your feedback matters.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-14 sm:pb-20">
        <div className="mx-auto max-w-5xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <h2 className="text-2xl font-semibold">What can you write to us about?</h2>
            <p className="mt-3 text-[15px] leading-7 text-foreground/65">
              Here are a few common reasons people reach out to us.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contactTopics.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-background/55 p-5">
                  <Icon className="mb-3 h-5 w-5 text-primary" />
                  <p className="font-semibold text-zinc-100">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-foreground/65">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.36 }}
            className="rounded-2xl sm:rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.22)]"
          >
            <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
            <div className="mt-6 space-y-3">
              {faqItems.map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-white/8 bg-background/55 px-5 py-5">
                  <p className="font-medium text-zinc-100">{q}</p>
                  <p className="mt-2 text-sm leading-7 text-foreground/68">{a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
