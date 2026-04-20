import { Link } from "react-router";
import { Mail } from "lucide-react";
import mockyoLogo from "../../assets/mockyo-logo.svg";

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.98 1.35a1.12 1.12 0 1 1 0 2.24 1.12 1.12 0 0 1 0-2.24ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.28 21v-7.2h2.42l.36-2.8h-2.78V9.2c0-.81.23-1.36 1.39-1.36H16.2V5.33A18.73 18.73 0 0 0 13.95 5c-2.23 0-3.75 1.36-3.75 3.86V11H7.8v2.8h2.4V21h3.08Z" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.3 8.1a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM4.8 9.6h3V19h-3V9.6Zm4.88 0h2.87v1.28h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6V19h-3v-4.47c0-1.06-.02-2.43-1.48-2.43-1.48 0-1.7 1.16-1.7 2.35V19h-3V9.6Z" />
  </svg>
);

const BehanceIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.2 7.2H3V17h4.56c1.54 0 2.8-.42 3.59-1.18.67-.64 1.05-1.54 1.05-2.53 0-1.53-.79-2.64-2.22-3.13 1.04-.48 1.63-1.38 1.63-2.55 0-.94-.37-1.74-1.03-2.29C10.8 4.44 9.72 4 8.32 4H3v1.8h4.2c1.52 0 2.26.48 2.26 1.48 0 1.08-.79 1.58-2.5 1.58Zm0 4.74c1.95 0 2.84.52 2.84 1.7 0 1.22-.88 1.76-2.85 1.76H5.12v-3.46H7.2ZM21 7.1h-5.1v1.4H21V7.1Zm-2.56 2.01c-2.96 0-4.74 1.92-4.74 4.09 0 2.45 1.81 4 4.67 4 2.39 0 3.95-1.11 4.42-2.94h-2.16c-.31.66-.98 1.07-2.12 1.07-1.47 0-2.39-.84-2.45-2.19H23c.02-.22.03-.44.03-.64 0-2.05-1.49-3.39-4.59-3.39Zm-2.28 3.09c.18-1.15.98-1.79 2.26-1.79 1.35 0 2.08.65 2.17 1.79h-4.43Z" />
  </svg>
);

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "Mockups", to: "/mockups" },
  { label: "Editor", to: "/editor" },
  { label: "Reviews", to: "/reviews" },
];

const supportLinks = [
  { label: "Contact Us", to: "/contact" },
  { label: "Help Center", to: "/help-center" },
];

const legalLinks = [
  { label: "Terms & Conditions", to: "/terms-conditions" },
  { label: "Privacy Policy", to: "/privacy-policy" },
];

const socialLinks = [
  { label: "Instagram", href: "#", icon: InstagramIcon },
  { label: "Facebook", href: "#", icon: FacebookIcon },
  { label: "LinkedIn", href: "#", icon: LinkedinIcon },
  { label: "Behance", href: "#", icon: BehanceIcon },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/6 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-0">
        <div className="grid gap-8 sm:gap-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.95fr_0.9fr]">
          <div className="max-w-sm">
            <div className="mb-6 flex items-center gap-3">
              <img src={mockyoLogo} alt="Mockyo" className="h-10 w-auto rounded-none" />
              <p className="text-2xl font-bold tracking-tight text-foreground">Mockyo</p>
            </div>

            <p className="mb-6 text-[15px] leading-7 text-foreground/68">
              Helping creators present designs through clean, professional mockups that are ready to use right away.
            </p>

            <a
              href="mailto:mockyo.official@gmail.com"
              className="inline-flex items-center gap-3 text-[15px] text-foreground/72 transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4" />
              mockyo.official@gmail.com
            </a>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/45">
              Quick Links
            </h4>
            <ul className="space-y-4 text-[15px] font-light">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-foreground/72 transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/45">
              Support
            </h4>
            <ul className="space-y-4 text-[15px] font-light">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-foreground/72 transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground/45">
              Legal
            </h4>
            <ul className="mb-8 space-y-4 text-[15px] font-light">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-foreground/72 transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/3 text-foreground/72 transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/6 py-6 text-sm text-foreground/40 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Mockyo. All rights reserved.</p>
          <p>your design, instantly on mockups.</p>
        </div>
      </div>
    </footer>
  );
}
