
import { GoogleOAuthProvider } from "@react-oauth/google";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const CHUNK_RELOAD_KEY = "mockyo.chunk_reload_once";

function shouldReloadForChunkError(reason: unknown) {
  const message =
    typeof reason === "string"
      ? reason
      : (reason as any)?.message
        ? String((reason as any).message)
        : String(reason || "");

  // Common Vite/ESM chunk load failures (usually during deploy or transient network/CDN hiccups).
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError")
  );
}

function installChunkErrorRecovery() {
  if (typeof window === "undefined") return;

  const reloadOnce = () => {
    try {
      if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } catch {
      // If storage is unavailable, still attempt a single reload.
    }
    window.location.reload();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (shouldReloadForChunkError((event as PromiseRejectionEvent).reason)) {
      reloadOnce();
    }
  });

  window.addEventListener("error", (event) => {
    if (shouldReloadForChunkError((event as ErrorEvent).error || (event as ErrorEvent).message)) {
      reloadOnce();
    }
  });
}

installChunkErrorRecovery();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const app = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId} locale="en">
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

createRoot(document.getElementById("root")!).render(app);
  
