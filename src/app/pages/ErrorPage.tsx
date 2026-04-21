import { useRouteError, isRouteErrorResponse } from "react-router";
import { AlertTriangle, Home } from "lucide-react";

export default function ErrorPage() {
  const error = useRouteError();

  let errorMessage = "An unexpected error occurred";
  let errorCode = "500";

  if (isRouteErrorResponse(error)) {
    errorCode = String(error.status);
    errorMessage = error.statusText || "Error";
    
    if (error.status === 404) {
      errorMessage = "Page not found";
    } else if (error.status === 500) {
      errorMessage = "Server error";
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <AlertTriangle className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="mb-2 text-5xl font-bold text-destructive">{errorCode}</h1>
        <h2 className="mb-4 text-2xl font-bold">{errorMessage}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {errorCode === "404"
            ? "The page you're looking for doesn't exist."
            : errorCode === "503"
            ? "The website is currently under maintenance. Please try again later."
            : "We encountered an unexpected error. Our team has been notified."}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </a>
      </div>
    </div>
  );
}
