import { motion } from "motion/react";
import { Download, Edit } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { markGuestDownloadUsed, requireSigninForExtraDownload } from "../lib/guestDownloadAccess";

interface MockupCardProps {
  id: string;
  image: string;
  title: string;
  category: string;
  mainCategory?: string;
  downloads: number;
  downloadEnabled?: boolean;
}

export default function MockupCard({ id, image, title, category, mainCategory, downloadEnabled = true }: MockupCardProps) {
  const parts = [mainCategory, category].filter(Boolean);
  const categoryLabel = parts.length > 0 ? parts.join(" / ") : category;
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (requireSigninForExtraDownload()) {
      return;
    }

    if (!downloadEnabled) {
      alert("Download is disabled for this product.");
      return;
    }

    setIsDownloading(true);
    try {
      const presignedUrlEndpoint = `${apiBaseUrl}/mockups/download/presigned-url?mockupId=${encodeURIComponent(id)}`;
      const response = await fetch(presignedUrlEndpoint, { credentials: "include" });
      
      if (!response.ok) {
        let message = "Failed to get download link";
        try {
          const error = await response.json();
          message = error?.message || message;
        } catch {
          // Keep default message when response is not JSON.
        }
        throw new Error(message);
      }
      
      const data = await response.json();
      if (!data.ok || !data.url) throw new Error("Invalid download URL");
      
      // Direct download via presigned URL
      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.fileName || "download";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      markGuestDownloadUsed();
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(23,25,31,0.95),rgba(15,17,22,0.95))] shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:border-white/14"
    >
      <Link to={`/mockups/${id}`} className="relative block overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
        />
        {downloadEnabled && (
          <div
            className="absolute left-0 top-8 flex items-center pl-1.5 pr-2.5 h-5"
            style={{
              backgroundColor: "#001833",
              clipPath: "polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)",
            }}
          >
            <span className="text-[9px] font-bold tracking-wide leading-none" style={{ color: "#2da9ff" }}>
              PSD
            </span>
          </div>
        )}
        {/* Editor bookmark ribbon */}
        <div
          className="absolute left-0 top-[3.5rem] flex items-center pl-1.5 pr-2.5 h-5"
          style={{
            backgroundColor: "#FF6B35",
            clipPath: "polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)",
          }}
        >
          <span className="text-white text-[9px] font-bold tracking-wide leading-none">
            EDITOR
          </span>
        </div>
      </Link>

      <div className="p-5">
        <span className="text-[11px] font-medium tracking-wide text-primary/85">
          {categoryLabel}
        </span>
        <h3 className="mb-4 mt-3 text-lg font-semibold leading-snug text-white">
          <Link
            to={`/mockups/${id}`}
            className="transition-colors hover:text-primary"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </Link>
        </h3>

        <div className="flex flex-col gap-2">
          {downloadEnabled ? (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDownloading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download
                </>
              )}
            </button>
          ) : (
            <div
              aria-hidden="true"
              className="pointer-events-none flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground opacity-0"
            >
              <Download className="w-4 h-4" />
              Download
            </div>
          )}
          <Link
            to={`/editor/${id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-white/90"
          >
            <Edit className="w-4 h-4" />
            Upload Design
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
