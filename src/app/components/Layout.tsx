import { Outlet, useLocation } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import AuthModal from "./AuthModal";
import GuestAccessModal from "./GuestAccessModal";
import { Suspense, useEffect } from "react";
import PageLoader from "./PageLoader";
import {
  applySeo,
  getDefaultOgImagePath,
  getSiteUrl,
  removeJsonLd,
  upsertJsonLd,
} from "../lib/seo";

const pageSeo: Record<string, { title: string; description: string; keywords?: string }> = {
  "/": {
    title: "Mockyo - Free Mockup Editor and Downloads",
    description: "Browse free professional mockups and apply your own designs instantly using Mockyo's built-in editor.",
    keywords: "free mockups, mockup editor, tshirt mockup, branding mockup, mockyo",
  },
  "/mockups": {
    title: "Browse Mockups - Mockyo",
    description: "Explore high-quality free mockups by category and start editing in seconds.",
    keywords: "mockup library, mockup categories, free mockup download",
  },
  "/editor": {
    title: "Mockup Editor - Mockyo",
    description: "Customize mockups online with your design, colors, and text using the Mockyo editor.",
  },
  "/contact": {
    title: "Contact - Mockyo",
    description: "Get in touch with Mockyo for support, partnerships, and product questions.",
  },
  "/reviews": {
    title: "Reviews - Mockyo",
    description: "Read user feedback and reviews about the Mockyo mockup platform.",
  },
  "/help-center": {
    title: "Help Center - Mockyo",
    description: "Find answers to frequently asked questions about using Mockyo and its editor.",
  },
  "/privacy-policy": {
    title: "Privacy Policy - Mockyo",
    description: "Read Mockyo's privacy policy to understand how we collect and use data.",
  },
  "/terms-conditions": {
    title: "Terms and Conditions - Mockyo",
    description: "Read the terms and conditions for using Mockyo services.",
  },
  "/login": {
    title: "Login - Mockyo",
    description: "Sign in to your Mockyo account.",
  },
  "/signup": {
    title: "Sign Up - Mockyo",
    description: "Create your Mockyo account and start designing with mockups.",
  },
  "/verify-email": {
    title: "Verify Email - Mockyo",
    description: "Verify your email address to complete your Mockyo account setup.",
  },
  "/reset-password": {
    title: "Reset Password - Mockyo",
    description: "Reset your Mockyo account password securely.",
  },
  "/account-settings": {
    title: "Account Settings - Mockyo",
    description: "Manage your profile, account preferences, and security settings.",
  },
  "/admin": {
    title: "Admin Dashboard - Mockyo",
    description: "Manage mockups, categories, and subscribers from the admin dashboard.",
  },
  "/admin-login": {
    title: "Admin Login - Mockyo",
    description: "Sign in to the Mockyo admin panel.",
  },
};

const breadcrumbLabelBySegment: Record<string, string> = {
  mockups: "Mockups",
  editor: "Editor",
  contact: "Contact",
  reviews: "Reviews",
  "help-center": "Help Center",
  "privacy-policy": "Privacy Policy",
  "terms-conditions": "Terms and Conditions",
  login: "Login",
  signup: "Sign Up",
  "verify-email": "Verify Email",
  "reset-password": "Reset Password",
};

export default function Layout() {
  const { pathname } = useLocation();
  const showFooter = !pathname.startsWith("/editor");

  useEffect(() => {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    const isProductDetailsPath = /^\/mockups\/[^/]+$/i.test(normalizedPath);
    if (isProductDetailsPath) return;

    const isNoIndexPath =
      normalizedPath.startsWith("/admin") ||
      normalizedPath === "/account-settings" ||
      normalizedPath.startsWith("/editor") ||
      normalizedPath === "/login" ||
      normalizedPath === "/signup" ||
      normalizedPath === "/verify-email" ||
      normalizedPath === "/reset-password";

    const seo =
      pageSeo[normalizedPath] || {
        title: "Mockyo - Free Mockup Editor and Downloads",
        description: "Browse free mockups and customize them instantly with Mockyo.",
      };

    applySeo({
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      pathname: normalizedPath,
      robots: isNoIndexPath ? "noindex,nofollow" : "index,follow",
      image: getDefaultOgImagePath(),
      ogType: "website",
    });

    const siteUrl = getSiteUrl();

    upsertJsonLd("organization", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Mockyo",
      url: siteUrl,
      logo: `${siteUrl}${getDefaultOgImagePath()}`,
      sameAs: [],
    });

    upsertJsonLd("website", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Mockyo",
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/mockups?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    });

    if (normalizedPath === "/") {
      removeJsonLd("breadcrumb");
      return;
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    const breadcrumbItems = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      ...segments.map((segment, index) => {
        const partialPath = `/${segments.slice(0, index + 1).join("/")}`;
        const label =
          breadcrumbLabelBySegment[segment] ||
          segment
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        return {
          "@type": "ListItem",
          position: index + 2,
          name: label,
          item: `${siteUrl}${partialPath}`,
        };
      }),
    ];

    upsertJsonLd("breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems,
    });
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {showFooter ? <Footer /> : null}
      <AuthModal />
      <GuestAccessModal />
    </div>
  );
}
