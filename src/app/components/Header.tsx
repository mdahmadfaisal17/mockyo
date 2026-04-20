import { Link, useLocation } from "react-router";
import { LogOut, Menu, Settings, User, ChevronDown, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { authChangeEventName, clearAuthUser, readAuthUser, type AuthUser } from "../imports/authStore";
import { openAuthModal } from "../imports/authModalStore";
import mockyoLogo from "../../assets/mockyo-logo.svg";

const headerEntranceTransition = {
  y: {
    type: "spring",
    stiffness: 170,
    damping: 24,
    mass: 0.9,
  },
  opacity: {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1],
  },
  filter: {
    duration: 0.5,
    ease: [0.22, 1, 0.36, 1],
  },
};

const activeTabTransition = {
  type: "spring",
  stiffness: 360,
  damping: 30,
  mass: 0.8,
};

export default function Header() {
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readAuthUser());
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  useEffect(() => {
    const syncUser = () => setCurrentUser(readAuthUser());
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener("storage", syncUser);
    window.addEventListener(authChangeEventName, syncUser);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener(authChangeEventName, syncUser);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Keep local sign-out even if API logout fails.
    }

    clearAuthUser();
    setIsProfileMenuOpen(false);
  };

  const initials = (currentUser?.name || currentUser?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <motion.header
      initial={{ y: -28, opacity: 0, filter: "blur(10px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={headerEntranceTransition}
      className="sticky top-0 z-50 backdrop-blur-2xl bg-background/90 border-b border-border/50 shadow-sm"
      style={{ willChange: "transform, opacity, filter" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between">
        <Link to="/" className="group inline-flex items-center gap-2 sm:gap-3">
          <img
            src={mockyoLogo}
            alt="Mockyo"
            className="h-9 sm:h-10 w-auto rounded-none transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Mockyo</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`relative px-4 py-2 rounded-md transition-[color,background-color] duration-300 ease-out ${
              isActive("/")
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Home
            {isActive("/") && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-primary rounded-full"
                transition={activeTabTransition}
              />
            )}
          </Link>
          <Link
            to="/mockups"
            className={`relative px-4 py-2 rounded-md transition-[color,background-color] duration-300 ease-out ${
              isActive("/mockups")
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Mockups
            {isActive("/mockups") && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-primary rounded-full"
                transition={activeTabTransition}
              />
            )}
          </Link>
          <Link
            to="/editor"
            className={`relative px-4 py-2 rounded-md transition-[color,background-color] duration-300 ease-out ${
              isActive("/editor")
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Editor
            {isActive("/editor") && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-primary rounded-full"
                transition={activeTabTransition}
              />
            )}
          </Link>
          <Link
            to="/contact"
            className={`relative px-4 py-2 rounded-md transition-[color,background-color] duration-300 ease-out ${
              isActive("/contact")
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Contact
            {isActive("/contact") && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-primary rounded-full"
                transition={activeTabTransition}
              />
            )}
          </Link>
          <Link
            to="/reviews"
            className={`relative px-4 py-2 rounded-md transition-[color,background-color] duration-300 ease-out ${
              isActive("/reviews")
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Reviews
            {isActive("/reviews") && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-primary rounded-full"
                transition={activeTabTransition}
              />
            )}
          </Link>
        </nav>

        {currentUser ? (
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((p) => !p)}
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-primary transition-[background-color,border-color] duration-300 hover:bg-primary/20 hover:border-primary/35"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {isProfileMenuOpen ? (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border/70 bg-card p-1.5 shadow-xl">
                <div className="px-2.5 py-2">
                  <p className="text-sm font-semibold text-foreground truncate">{currentUser.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                </div>
                <Link
                  to="/account-settings"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-muted/60"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((p) => !p)}
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/30 transition-[background-color,border-color,transform] duration-300 ease-out font-medium text-sm sm:text-base"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Login</span>
          </button>
          </div>
        )}
      </div>

      {/* Mobile navigation menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {[
              { to: "/", label: "Home" },
              { to: "/mockups", label: "Mockups" },
              { to: "/editor", label: "Editor" },
              { to: "/contact", label: "Contact" },
              { to: "/reviews", label: "Reviews" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </motion.header>
  );
}
