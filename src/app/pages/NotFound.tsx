import { Link } from "react-router";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 text-center">
      {/* Large 404 text */}
      <h1 className="text-[8rem] sm:text-[12rem] font-black leading-none tracking-tighter text-white/[0.04] select-none">
        404
      </h1>

      {/* Overlay content */}
      <div className="-mt-16 sm:-mt-24 relative z-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-widest text-primary">
          Page Not Found
        </div>

        <h2 className="mb-3 text-2xl sm:text-4xl font-bold text-foreground">
          Oops! Lost in the mockups
        </h2>
        <p className="mx-auto mb-8 max-w-md text-base text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-primary to-secondary px-6 py-3 font-semibold text-primary-foreground transition-all hover:scale-105 hover:brightness-105 shadow-lg shadow-primary/20"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-6 py-3 font-semibold text-foreground transition-all hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
