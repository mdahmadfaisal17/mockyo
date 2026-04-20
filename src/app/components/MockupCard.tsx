import { motion } from "motion/react";
import { Download, Edit } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { markGuestDownloadUsed, requireSigninForExtraDownload } from "../lib/guestDownloadAccess";

interface MockupCardProps {
  id: string;
  image: string;
  title: string;
  category: string;
  mainCategory?: string;
  downloads: number;
}

export default function MockupCard({ id, image, title, category, mainCategory }: MockupCardProps) {
  const parts = [mainCategory, category].filter(Boolean);
  const categoryLabel = parts.length > 0 ? parts.join(" / ") : category;
  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:5000/api`
      : "http://localhost:5000/api");
  const [objectKey, setObjectKey] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchDownloadSource = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/mockups/${id}`);
        const result = await response.json();
        if (!response.ok || !result?.ok || !result.item) return;
        if (result.item.objectKey) {
          setObjectKey(result.item.objectKey);
        }
      } catch {
        // silently fail
      }
    };
    void fetchDownloadSource();
  }, [id, apiBaseUrl]);

  const handleDownload = async () => {
    if (requireSigninForExtraDownload()) {
      return;
    }

    if (!objectKey.trim()) {
      alert("No object key configured for this product.");
      return;
    }

    setIsDownloading(true);
    try {
      const presignedUrlEndpoint = `${apiBaseUrl}/mockups/download/presigned-url?mockupId=${encodeURIComponent(id)}`;
      const response = await fetch(presignedUrlEndpoint, { credentials: "include" });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get download link");
      }
      
      const data = await response.json();
      if (!data.ok || !data.url) throw new Error("Invalid download URL");
      
      // Direct download via presigned URL
      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.fileName || "download";
      link.target = "_blank";
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
      <Link to={`/mockups/${id}`} className="block aspect-[1.12/1] overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="p-5">
        <span className="text-[11px] font-medium tracking-wide text-primary/85">
          {categoryLabel}
        </span>
        <h3 className="mb-4 mt-3 text-xl font-semibold text-white">
          <Link to={`/mockups/${id}`} className="transition-colors hover:text-primary">
            {title}
          </Link>
        </h3>

        <div className="flex gap-2">
          <Link
            to={`/editor/${id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Edit className="w-4 h-4" />
            Upload Design
          </Link>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      </div>
    </motion.div>
  );
}
